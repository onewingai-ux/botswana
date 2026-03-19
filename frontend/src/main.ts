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

function getInviteLink(room: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', room);
  return url.toString();
}

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  
  // Format ID to ensure uniqueness but keep name parseable: "Name-1A2B3C"
  playerId = `${playerName}-${Math.random().toString(36).substring(2, 8)}`;
  
  const wsUrl = `${protocol}//${host}/ws/${roomId}/${playerId}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected to Room:", roomId);
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
    alert("Connection lost to server. Please refresh.");
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

// Helper to strip the "-1A2B3C" unique hash for UI display
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
  `;

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

function render() {
  if (!state) {
    renderLobbyJoin();
    return;
  }

  // Waiting Room
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

  const isMyTurn = state.current_player === playerId && state.status === "playing";
  
  // Hand Sorting Logic
  let hand = [...state.my_hand];
  if (sortBy === "animal") {
    hand.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  } else {
    hand.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  }
  
  // Game Board UI
  let html = `
    <div class="game-header">
      <div class="room-badge">Room: ${state.room_id}</div>
      <div class="status-badge">${state.status === "playing" ? 'Game in Progress' : 'Round Ended'}</div>
    </div>
    
    <div class="opponents-area">
      <div class="opponents-grid">
        ${state.opponents.map((o: any) => `
          <div class="opponent-card ${state.current_player === o.id ? 'active-opponent' : ''}">
            <div class="opponent-name">${displayName(o.id)}</div>
            <div class="opponent-stats">Score: <strong>${o.score}</strong> | Cards: ${o.hand_count}</div>
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
    const stack: number[] = state.board[a] || []; // Full array of played cards
    const availableTokens = state.pool[a];
    
    // Tokens are only clickable IF it's my turn AND I have selected a card.
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
                // Fan out the cards: each card gets pushed down slightly so you see a stack
                const topOffset = idx * 12; // 12px shift down per card
                return `
                  <div class="played-card" style="top: ${topOffset}px; z-index: ${idx};">
                    <div class="pc-emoji">${EMOJIS[a]}</div>
                    <div class="pc-val">${val}</div>
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
  
  html += `</div></div>`; // End board

  // Player Area (Focus of Turn)
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
        <div class="my-score">Score: <strong>${state.my_score}</strong></div>
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

  // Hand Sorting Event Listeners
  if (document.getElementById('sort-animal')) {
    document.getElementById('sort-animal')!.onclick = () => { sortBy = 'animal'; render(); };
    document.getElementById('sort-value')!.onclick = () => { sortBy = 'value'; render(); };
  }

  // Card Selection Event Listener
  document.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!isMyTurn) return;
      const target = e.currentTarget as HTMLElement;
      
      // If clicking the already selected card, deselect it
      if (selectedCard?.animal === target.getAttribute('data-a') && selectedCard?.value === parseInt(target.getAttribute('data-v')!)) {
        selectedCard = null;
      } else {
        selectedCard = {
          animal: target.getAttribute('data-a')!,
          value: parseInt(target.getAttribute('data-v')!)
        };
      }
      render(); // Re-render to highlight selected card & activate tokens
    });
  });

  // Token Selection Event Listener
  document.querySelectorAll('.token-clickable').forEach(el => {
    el.addEventListener('click', (e) => {
      const animal = (e.currentTarget as HTMLElement).getAttribute('data-animal')!;
      handlePlayToken(animal);
    });
  });
}

// Auto-join handling via URL (Prompts for name if missing)
window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    roomId = roomParam.toUpperCase();
    if (playerName) {
      connect();
    } else {
      // Must render lobby first to let them enter their name before auto-joining
      renderLobbyJoin();
      // Auto-fill the join box with the URL param
      setTimeout(() => {
        const joinInput = document.getElementById('room-input') as HTMLInputElement;
        if (joinInput) joinInput.value = roomId;
      }, 50);
    }
  } else {
    render();
  }
};
