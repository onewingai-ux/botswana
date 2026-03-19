import './style.css';

const app = document.getElementById('app')!;

const EMOJIS: Record<string, string> = {
  Lion: "🦁",
  Rhino: "🦏",
  Elephant: "🐘",
  Leopard: "🐆",
  Zebra: "🦓"
};

let ws: WebSocket;
let roomId = "";
let playerName = localStorage.getItem("botswanaName") || "";
let playerId = "";
let state: any = null;
let selectedCard: { animal: string, value: number } | null = null;
let isHost = false; 
let sortBy: "animal" | "value" = "animal";
let pingInterval: number;

function getInviteLink(room: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', room);
  return url.toString();
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  
  playerId = `${playerName}-${Math.random().toString(36).substring(2, 8)}`;
  
  const wsUrl = `${protocol}//${host}/ws/${roomId}/${playerId}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected to Room:", roomId);
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000) as unknown as number;
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "state") {
      state = msg.data;
      if (state.players.length > 0 && state.players[0] === playerId) {
        isHost = true;
      }
      render();
    }
  };

  ws.onclose = () => {
    clearInterval(pingInterval);
    alert("Connection lost to server. Please refresh the page to reconnect.");
  };
}

function handlePlayToken(tokenAnimal: string) {
  if (!selectedCard) {
    alert("Select a card from your hand first!");
    return;
  }
  
  ws.send(JSON.stringify({
    type: "play",
    payload: {
      card_animal: selectedCard.animal,
      card_value: selectedCard.value,
      token_animal: tokenAnimal
    }
  }));
  selectedCard = null;
}

function displayName(id: string) {
  if (id.startsWith("Bot ")) return id;
  const parts = id.split("-");
  return parts.slice(0, -1).join("-") || id;
}

function renderLobbyJoin() {
  app.innerHTML = `
    <div class="hero">
      <h1>Botswana 🦁</h1>
      <p>A real-time multiplayer board game of Wild Safari strategy.</p>
      
      <button id="how-to-play-btn" class="text-link-btn">📖 How to Play</button>

      <div class="name-entry-card">
        <h3>Choose your name</h3>
        <input id="name-input" type="text" placeholder="Enter your name" value="${playerName}" maxlength="15" />
      </div>

      <div class="lobby-actions">
        <div class="action-card">
          <h3>Start a New Game</h3>
          <button id="create-btn" class="primary-btn">Create Room</button>
        </div>
        
        <div class="action-separator">OR</div>

        <div class="action-card">
          <h3>Join Existing Game</h3>
          <input id="room-input" type="text" placeholder="Room Code (e.g. A1B2C)" maxlength="6" />
          <button id="join-btn" class="secondary-btn">Join Room</button>
        </div>
      </div>
    </div>
    
    <div id="rules-modal" class="modal-overlay hidden">
      <div class="modal-content">
        <span class="close-btn" id="close-modal">&times;</span>
        <h2>How to Play Botswana 🌍</h2>
        <div class="rules-text">
          <p><strong>Goal:</strong> Collect animal tokens and manipulate their final values to score the most points.</p>
          
          <h3>On Your Turn (2 Steps):</h3>
          <ol>
            <li><strong>Play 1 Card:</strong> Choose any card from your hand to play onto the corresponding animal's stack in the center. The value on the card you play becomes the <em>current value</em> of that entire animal species.</li>
            <li><strong>Take 1 Token:</strong> Take exactly one token of <em>any</em> available animal species. (Crucially, the token you take does <strong>not</strong> have to match the card you just played!)</li>
          </ol>

          <h3>Ending the Round:</h3>
          <p>The round ends <strong>immediately</strong> the exact moment the 6th card of any single animal species is played. The game pauses, and the remaining cards in your hand are ignored.</p>

          <h3>Scoring:</h3>
          <p>At the end of the round, you reveal the tokens you collected. Each token is worth the value of the <strong>topmost card</strong> on that animal's stack.</p>
          <ul>
            <li><em>Example:</em> If the Zebra stack has a '4' on top when the round ends, every Zebra token you collected is worth 4 points!</li>
            <li><em>Warning:</em> If an animal has a '0' on top, its tokens are entirely worthless! If no cards were played on an animal, its tokens are also worth 0.</li>
          </ul>
          
          <h3>Multi-Round Game:</h3>
          <p>A full game consists of as many rounds as there are players. Your scores carry over from round to round. The player with the highest total score at the end wins!</p>
        </div>
      </div>
    </div>
  `;

  // Rules Modal Handlers
  document.getElementById('how-to-play-btn')!.onclick = () => {
    document.getElementById('rules-modal')!.classList.remove('hidden');
  };
  document.getElementById('close-modal')!.onclick = () => {
    document.getElementById('rules-modal')!.classList.add('hidden');
  };
  // Close on outside click
  document.getElementById('rules-modal')!.onclick = (e) => {
    if (e.target === document.getElementById('rules-modal')) {
      document.getElementById('rules-modal')!.classList.add('hidden');
    }
  };

  const validateName = () => {
    const input = (document.getElementById('name-input') as HTMLInputElement).value.trim();
    if (!input) {
      alert("Please enter a name first!");
      return false;
    }
    playerName = input;
    localStorage.setItem("botswanaName", playerName);
    return true;
  };

  document.getElementById('create-btn')!.onclick = () => {
    if (!validateName()) return;
    roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
    connect();
  };

  document.getElementById('join-btn')!.onclick = () => {
    if (!validateName()) return;
    const input = (document.getElementById('room-input') as HTMLInputElement).value.trim();
    if (input) {
      roomId = input.toUpperCase();
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      window.history.pushState({}, '', url);
      connect();
    } else {
      alert("Please enter a valid room code.");
    }
  };
}

function animateScoreboard() {
  const breakdownElements = document.querySelectorAll('.animate-row');
  let delay = 0;
  
  breakdownElements.forEach((el) => {
    setTimeout(() => {
      (el as HTMLElement).style.opacity = "1";
      (el as HTMLElement).style.transform = "translateX(0)";
    }, delay);
    delay += 200;
  });

  setTimeout(() => {
    const totalElements = document.querySelectorAll('.animate-total');
    totalElements.forEach((el) => {
      (el as HTMLElement).style.opacity = "1";
      (el as HTMLElement).style.transform = "scale(1)";
    });
  }, delay + 500);
}

function renderScoreboard() {
  const bd = state.score_breakdown || {};
  
  const sortedPlayers = [...state.players].sort((a, b) => {
    const scoreA = bd[a]?.total || 0;
    const scoreB = bd[b]?.total || 0;
    return scoreB - scoreA;
  });

  let html = `
    <div class="scoreboard-container">
      <h2>${state.status === 'game_over' ? 'Final Game Results' : `Round ${state.current_round} Complete!`}</h2>
      <p style="font-size:1.2em; color:var(--secondary-color);">Let's count the tokens...</p>
      
      <div class="score-cards">
  `;

  for (const p of sortedPlayers) {
    const pData = bd[p] || { total: 0, animals: {} };
    
    html += `
        <div class="score-card ${p === playerId ? 'my-score-card' : ''}">
          <h3 class="score-name">${displayName(p)}</h3>
          <div class="score-breakdown-list">
    `;
    
    for (const a of Object.keys(EMOJIS)) {
      const aData = pData.animals[a] || { tokens: 0, value: 0, pts: 0 };
      if (aData.tokens > 0) {
        html += `
            <div class="breakdown-row animate-row">
              <span class="bd-animal">${EMOJIS[a]} ${a}</span>
              <span class="bd-math">${aData.tokens} x ${aData.value}</span>
              <span class="bd-pts">+${aData.pts} pts</span>
            </div>
        `;
      }
    }
    
    html += `
          </div>
          <div class="score-total-box animate-total">
            <span>Round Score:</span>
            <strong style="font-size:1.5em; color:var(--primary-color);">${pData.total}</strong>
          </div>
          <div class="score-global">
            <small>Total Game Score: <strong>${state.my_id === p ? state.my_score : state.opponents.find((o:any) => o.id === p)?.score || 0}</strong></small>
          </div>
        </div>
    `;
  }
  
  html += `
      </div>
      
      <div class="scoreboard-actions">
  `;
  
  if (state.status === 'game_over') {
    html += `
      <h1 style="color:var(--primary-color); font-size:3em; margin:20px 0;">🏆 ${displayName(sortedPlayers[0])} Wins! 🏆</h1>
      <button class="primary-btn" onclick="window.location.reload()">Play Again (New Room)</button>
    `;
  } else {
    if (isHost) {
      html += `<button id="next-round-btn" class="primary-btn">Start Round ${state.current_round + 1} of ${state.max_rounds}</button>`;
    } else {
      html += `<p style="font-style:italic; color:#666;">Waiting for Host to start the next round...</p>`;
    }
  }
  
  html += `
      </div>
    </div>
  `;
  
  app.innerHTML = html;
  
  if (isHost && document.getElementById('next-round-btn')) {
    document.getElementById('next-round-btn')!.onclick = () => {
      ws.send(JSON.stringify({ type: "next_round" }));
    };
  }

  setTimeout(animateScoreboard, 100);
}

function render() {
  if (!state) {
    renderLobbyJoin();
    return;
  }

  if (state.status === "waiting") {
    const inviteLink = getInviteLink(state.room_id);
    app.innerHTML = `
      <div class="waiting-room">
        <h2>Game Lobby</h2>
        <div class="room-code-display">Room Code: <strong>${state.room_id}</strong></div>
        
        <div class="invite-section">
          <p>Send this link to friends to invite them:</p>
          <div class="invite-link-box">
            <input type="text" readonly value="${inviteLink}" id="invite-link-input" />
            <button id="copy-btn">Copy</button>
          </div>
        </div>

        <div class="players-list-section">
          <h3>Players (${state.players.length}/6)</h3>
          <ul class="players-list">
            ${state.players.map((p: string, idx: number) => `
              <li>
                <span class="player-avatar">${idx === 0 ? '👑' : '👤'}</span> 
                ${displayName(p)} ${p === playerId ? '(You)' : ''}
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="lobby-controls">
          ${isHost ? `
            <button id="add-bot-btn" class="secondary-btn">🤖 Add AI Bot</button>
            <button id="start-btn" class="primary-btn" ${state.players.length < 2 ? 'disabled' : ''}>
              ${state.players.length < 2 ? 'Waiting for players...' : 'Start Game'}
            </button>
          ` : `
            <p style="color: #666; font-style: italic;">Waiting for the host to start the game...</p>
          `}
        </div>
      </div>
    `;
    
    document.getElementById('copy-btn')!.onclick = () => {
      const copyText = document.getElementById("invite-link-input") as HTMLInputElement;
      copyText.select();
      document.execCommand("copy");
      document.getElementById('copy-btn')!.innerText = "Copied!";
      setTimeout(() => document.getElementById('copy-btn')!.innerText = "Copy", 2000);
    };

    if (isHost) {
      document.getElementById('add-bot-btn')!.onclick = () => ws.send(JSON.stringify({type: "add_bot"}));
      document.getElementById('start-btn')!.onclick = () => ws.send(JSON.stringify({type: "start"}));
    }
    return;
  }

  if (state.status === "round_ended" || state.status === "game_over") {
    renderScoreboard();
    return;
  }

  const isMyTurn = state.current_player === playerId && state.status === "playing";
  
  let hand = [...state.my_hand];
  if (sortBy === "animal") {
    hand.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  } else {
    hand.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  }
  
  let html = `
    <div class="game-header">
      <div class="room-badge">Room: ${state.room_id}</div>
      <div class="status-badge">Round ${state.current_round} of ${state.max_rounds}</div>
    </div>
    
    <div class="opponents-area">
      <div class="opponents-grid">
        ${state.opponents.map((o: any) => `
          <div class="opponent-card ${state.current_player === o.id ? 'active-opponent' : ''}">
            <div class="opponent-name">${displayName(o.id)}</div>
            <div class="opponent-stats">Total Score: <strong>${o.score}</strong> | Cards: ${o.hand_count}</div>
            <div class="opponent-tokens">
              ${Object.keys(EMOJIS).map(a => `<span title="${a}">${EMOJIS[a]} ${o.tokens[a] || 0}</span>`).join(" ")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="board-area">
      <div class="board">
  `;

  for (const a of Object.keys(EMOJIS)) {
    const stack: number[] = state.board[a] || []; 
    const availableTokens = state.pool[a];
    const canTakeToken = isMyTurn && selectedCard !== null && availableTokens > 0;
    
    html += `
      <div class="animal-stack-container">
        <h4 class="animal-title">${a}</h4>
        
        <div class="stack-visual-area">
          ${stack.length === 0 ? `
            <div class="empty-stack-placeholder">
              <div class="emoji-faded">${EMOJIS[a]}</div>
            </div>
          ` : `
            <div class="card-stack-visual">
              ${stack.map((val, idx) => {
                const isTop = idx === stack.length - 1;
                const topOffset = idx * 25; 
                const zIdx = idx;
                
                return `
                  <div class="played-card ${isTop ? 'top-card' : ''}" style="top: ${topOffset}px; z-index: ${zIdx};">
                    <div class="pc-corner-val">${val}</div>
                    <div class="pc-center">
                      <div class="pc-emoji">${EMOJIS[a]}</div>
                      ${isTop ? `<div class="pc-val">${val}</div>` : ''}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
        
        <div class="token-pill ${canTakeToken ? 'token-clickable' : ''} ${availableTokens === 0 ? 'token-empty' : ''}" data-animal="${a}">
          <span class="token-icon">${EMOJIS[a]}</span>
          <span class="token-count">${availableTokens} left</span>
        </div>
      </div>
    `;
  }
  
  html += `</div></div>`;

  html += `
    <div class="player-area ${isMyTurn ? 'active-player-area' : ''}">
      ${state.status === "playing" ? `
        <div class="turn-instruction ${isMyTurn ? 'my-turn-instruction' : ''}">
          ${isMyTurn 
            ? (selectedCard ? "Step 2: Select a token to take from the board above." : "Step 1: Select a card from your hand to play.") 
            : `Waiting for ${displayName(state.current_player)}...`}
        </div>
      ` : ''}
      
      <div class="player-top-row">
        <div class="my-tokens-display">
          <strong>Tokens:</strong>
          <div class="tokens-list">
            ${Object.keys(EMOJIS).map(a => `
              <div class="token-item" title="${a}">
                ${EMOJIS[a]} <span class="t-count">${state.my_tokens[a] || 0}</span>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="my-score">Game Score: <strong>${state.my_score}</strong></div>
      </div>
      
      <div class="hand-header">
        <h4>My Hand</h4>
        <div class="sort-controls">
          Sort by: 
          <button id="sort-animal" class="sort-btn ${sortBy === 'animal' ? 'active-sort' : ''}">Animal</button>
          <button id="sort-value" class="sort-btn ${sortBy === 'value' ? 'active-sort' : ''}">Value</button>
        </div>
      </div>

      <div class="hand ${!isMyTurn ? 'hand-disabled' : ''}">
        ${hand.map((card: [string, number], i: number) => {
          const isSelected = selectedCard?.animal === card[0] && selectedCard?.value === card[1];
          return `
            <div class="card ${isSelected ? 'selected' : ''}" data-idx="${i}" data-a="${card[0]}" data-v="${card[1]}">
              <div class="card-emoji">${EMOJIS[card[0]]}</div>
              <div class="card-value">${card[1]}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  app.innerHTML = html;

  if (document.getElementById('sort-animal')) {
    document.getElementById('sort-animal')!.onclick = () => { sortBy = 'animal'; render(); };
    document.getElementById('sort-value')!.onclick = () => { sortBy = 'value'; render(); };
  }

  document.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!isMyTurn) return;
      const target = e.currentTarget as HTMLElement;
      
      if (selectedCard?.animal === target.getAttribute('data-a') && selectedCard?.value === parseInt(target.getAttribute('data-v')!)) {
        selectedCard = null;
      } else {
        selectedCard = {
          animal: target.getAttribute('data-a')!,
          value: parseInt(target.getAttribute('data-v')!)
        };
      }
      render(); 
    });
  });

  document.querySelectorAll('.token-clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      const animal = (e.currentTarget as HTMLElement).getAttribute('data-animal')!;
      handlePlayToken(animal);
    });
  });
}

window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    roomId = roomParam.toUpperCase();
    if (playerName) {
      connect();
    } else {
      renderLobbyJoin();
      setTimeout(() => {
        const joinInput = document.getElementById('room-input') as HTMLInputElement;
        if (joinInput) joinInput.value = roomId;
      }, 50);
    }
  } else {
    render();
  }
};
