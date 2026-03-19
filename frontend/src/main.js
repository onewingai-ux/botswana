import './style.css';
const app = document.getElementById('app');
const EMOJIS = {
    Lion: "🦁",
    Rhino: "🦏",
    Elephant: "🐘",
    Leopard: "🐆",
    Zebra: "🦓"
};
let ws;
let roomId = "";
let playerId = `Player_${Math.random().toString(36).substring(2, 6)}`;
let state = null;
let selectedCard = null;
let isHost = false; // We'll assume the first person to create/join an empty room acts as host
function getInviteLink(room) {
    const url = new URL(window.location.href);
    url.searchParams.set('room', room);
    return url.toString();
}
function connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${roomId}/${playerId}`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        console.log("Connected to Room:", roomId);
    };
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") {
            state = msg.data;
            // If we are the first player in the room, we are the host
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
function handlePlayToken(tokenAnimal) {
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
function render() {
    if (!state) {
        app.innerHTML = `
      <div class="hero">
        <h1>Botswana 🦁</h1>
        <p>A real-time multiplayer board game of Wild Safari strategy.</p>
        
        <div class="lobby-actions">
          <div class="action-card">
            <h3>Start a New Game</h3>
            <p>Create a room and invite your friends to play.</p>
            <button id="create-btn" class="primary-btn">Create Game</button>
          </div>
          
          <div class="action-separator">OR</div>

          <div class="action-card">
            <h3>Join Existing Game</h3>
            <p>Enter a room code you received from a friend.</p>
            <input id="room-input" type="text" placeholder="e.g. A1B2C" maxlength="6" />
            <button id="join-btn" class="secondary-btn">Join Game</button>
          </div>
        </div>
      </div>
    `;
        document.getElementById('create-btn').onclick = () => {
            roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
            // Update URL without refreshing so they can easily copy it later
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomId);
            window.history.pushState({}, '', url);
            connect();
        };
        document.getElementById('join-btn').onclick = () => {
            const input = document.getElementById('room-input').value.trim();
            if (input) {
                roomId = input.toUpperCase();
                const url = new URL(window.location.href);
                url.searchParams.set('room', roomId);
                window.history.pushState({}, '', url);
                connect();
            }
            else {
                alert("Please enter a valid room code.");
            }
        };
        return;
    }
    // Lobby (Waiting Room)
    if (state.status === "waiting") {
        const inviteLink = getInviteLink(state.room_id);
        app.innerHTML = `
      <div class="waiting-room">
        <h2>Game Lobby</h2>
        <div class="room-code-display">
          Room Code: <strong>${state.room_id}</strong>
        </div>
        
        <div class="invite-section">
          <p>Send this link to friends to invite them:</p>
          <div class="invite-link-box">
            <input type="text" readonly value="${inviteLink}" id="invite-link-input" />
            <button id="copy-btn">Copy Link</button>
          </div>
        </div>

        <div class="players-list-section">
          <h3>Players (${state.players.length}/6)</h3>
          <ul class="players-list">
            ${state.players.map((p, idx) => `
              <li>
                <span class="player-avatar">${idx === 0 ? '👑' : '👤'}</span> 
                ${p} ${p === playerId ? '(You)' : ''}
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
        document.getElementById('copy-btn').onclick = () => {
            const copyText = document.getElementById("invite-link-input");
            copyText.select();
            document.execCommand("copy");
            document.getElementById('copy-btn').innerText = "Copied!";
            setTimeout(() => document.getElementById('copy-btn').innerText = "Copy Link", 2000);
        };
        if (isHost) {
            document.getElementById('add-bot-btn').onclick = () => ws.send(JSON.stringify({ type: "add_bot" }));
            document.getElementById('start-btn').onclick = () => ws.send(JSON.stringify({ type: "start" }));
        }
        return;
    }
    const isMyTurn = state.current_player === playerId && state.status === "playing";
    // Game Board
    let html = `
    <div class="game-header">
      <div class="room-badge">Room: ${state.room_id}</div>
      <div class="status-badge">${state.status === "playing" ? 'Game in Progress' : 'Round Ended'}</div>
    </div>
    
    ${state.status === "playing" ? `
      <div class="turn-indicator ${isMyTurn ? 'my-turn' : ''}">
        ${isMyTurn ? "It's your turn!" : `Waiting for ${state.current_player}...`}
      </div>
    ` : ''}

    <div class="opponents-area">
      <h4>Opponents</h4>
      <div class="opponents-grid">
        ${state.opponents.map((o) => `
          <div class="opponent-card ${state.current_player === o.id ? 'active-opponent' : ''}">
            <div class="opponent-name">${o.id}</div>
            <div class="opponent-stats">Score: <strong>${o.score}</strong> | Cards: ${o.hand_count}</div>
            <div class="opponent-tokens">
              ${Object.keys(EMOJIS).map(a => `<span title="${a}">${EMOJIS[a]} ${o.tokens[a] || 0}</span>`).join(" ")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="board">
  `;
    for (const a of Object.keys(EMOJIS)) {
        const value = state.board[a] !== null ? state.board[a] : "-";
        const availableTokens = state.pool[a];
        html += `
      <div class="animal-stack">
        <h3 class="${a.toLowerCase()}">${a}</h3>
        <div class="emoji-large">${EMOJIS[a]}</div>
        <div class="stack-value">Current Value: <strong>${value}</strong></div>
        <div class="token-action">
          <button class="token-btn" data-animal="${a}" ${!isMyTurn || availableTokens === 0 ? 'disabled' : ''}>
            Take Token (${availableTokens} left)
          </button>
        </div>
      </div>
    `;
    }
    html += `</div>`;
    // Player Area
    html += `
    <div class="player-area ${isMyTurn ? 'active-player-area' : ''}">
      <div class="player-header">
        <h3>My Area (${playerId})</h3>
        <div class="my-score">Score: <strong>${state.my_score}</strong></div>
      </div>
      
      <div class="my-tokens-display">
        <strong>My Tokens:</strong>
        <div class="tokens-list">
          ${Object.keys(EMOJIS).map(a => `
            <div class="token-item" title="${a}">
              ${EMOJIS[a]} <span class="token-count">${state.my_tokens[a] || 0}</span>
            </div>
          `).join("")}
        </div>
      </div>
      
      <h4>My Hand ${!isMyTurn && state.status === "playing" ? '<small style="color:#666; font-weight:normal;">(Wait for your turn to play)</small>' : ''}</h4>
      <div class="hand">
        ${state.my_hand.map((card, i) => {
        const isSelected = selectedCard?.animal === card[0] && selectedCard?.value === card[1];
        return `
            <div class="card ${isSelected ? 'selected' : ''} ${!isMyTurn ? 'disabled' : ''}" data-idx="${i}" data-a="${card[0]}" data-v="${card[1]}">
              <div class="card-emoji">${EMOJIS[card[0]]}</div>
              <div class="card-value">${card[1]}</div>
            </div>
          `;
    }).join("")}
      </div>
    </div>

    <div class="game-logs">
      <h4>Action Log</h4>
      <div class="logs">
        ${state.logs.slice().reverse().map((l, i) => `<div class="log-entry ${i === 0 ? 'latest-log' : ''}">${l}</div>`).join("")}
      </div>
    </div>
  `;
    app.innerHTML = html;
    // Event Listeners
    document.querySelectorAll('.card').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!isMyTurn)
                return;
            const target = e.currentTarget;
            selectedCard = {
                animal: target.getAttribute('data-a'),
                value: parseInt(target.getAttribute('data-v'))
            };
            render(); // re-render to highlight selected
        });
    });
    document.querySelectorAll('.token-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const animal = e.currentTarget.getAttribute('data-animal');
            handlePlayToken(animal);
        });
    });
}
// Auto-join if URL parameter exists
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomId = roomParam.toUpperCase();
        connect();
    }
    else {
        render();
    }
};
//# sourceMappingURL=main.js.map