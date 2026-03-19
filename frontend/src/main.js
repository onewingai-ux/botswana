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
let playerId = `Player_${Math.random().toString(36).substring(2, 10)}`;
let state = null;
let selectedCard = null;
function connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${roomId}/${playerId}`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        console.log("Connected");
    };
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "state") {
            state = msg.data;
            render();
        }
    };
    ws.onclose = () => {
        alert("Connection lost");
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
      <h1>Botswana 🦁</h1>
      <div style="margin:20px 0;">
        <input id="room-input" type="text" placeholder="Enter Room ID" />
        <button id="join-btn">Join / Create Room</button>
      </div>
    `;
        document.getElementById('join-btn').onclick = () => {
            const input = document.getElementById('room-input').value;
            if (input) {
                roomId = input.toUpperCase();
                connect();
            }
            else {
                roomId = `ROOM-${Math.floor(Math.random() * 10000)}`;
                connect();
            }
        };
        return;
    }
    // Lobby
    if (state.status === "waiting") {
        app.innerHTML = `
      <h2>Room: ${state.room_id} | Status: Waiting</h2>
      <p>Share this Room ID with friends to join.</p>
      <h3>Players (${state.players.length}):</h3>
      <ul style="list-style:none;padding:0;">
        ${state.players.map((p) => `<li>${p}</li>`).join("")}
      </ul>
      <button id="add-bot-btn">Add AI Bot</button>
      <br><br>
      <button id="start-btn" ${state.players.length < 2 ? 'disabled' : ''}>Start Game</button>
    `;
        document.getElementById('add-bot-btn').onclick = () => ws.send(JSON.stringify({ type: "add_bot" }));
        document.getElementById('start-btn').onclick = () => ws.send(JSON.stringify({ type: "start" }));
        return;
    }
    const isMyTurn = state.current_player === playerId && state.status === "playing";
    let html = `
    <h2>Room: ${state.room_id} | Status: ${state.status}</h2>
    ${state.status === "playing" ? `<h3>Turn: ${state.current_player}</h3>` : ''}
    
    <div class="logs">
      ${state.logs.map((l) => `<div>${l}</div>`).join("")}
    </div>

    <div class="opponents-area">
      <h4>Opponents</h4>
      <div style="display:flex; justify-content:center; gap:20px;">
        ${state.opponents.map((o) => `
          <div style="border:1px solid #ccc; padding:10px; border-radius:5px; background:rgba(255,255,255,0.5);">
            <strong>${o.id}</strong> (Score: ${o.score})<br/>
            Cards: ${o.hand_count}<br/>
            ${Object.keys(EMOJIS).map(a => `<span class="emoji">${EMOJIS[a]}</span>${o.tokens[a] || 0}`).join(" ")}
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
        <h3>${a}</h3>
        <div class="emoji">${EMOJIS[a]}</div>
        <div>Value: <strong>${value}</strong></div>
        <div style="margin-top:10px;">
          <button class="token-btn" data-animal="${a}" ${!isMyTurn || availableTokens === 0 ? 'disabled' : ''}>
            Take Token (${availableTokens})
          </button>
        </div>
      </div>
    `;
    }
    html += `</div>`;
    html += `
    <div class="player-area">
      <h3>My Area (${playerId}) - Score: ${state.my_score}</h3>
      <div style="margin-bottom:15px; font-size:18px;">
        My Tokens: 
        ${Object.keys(EMOJIS).map(a => `<span class="emoji">${EMOJIS[a]}</span>${state.my_tokens[a] || 0}`).join(" | ")}
      </div>
      <h4>My Hand</h4>
      <div class="hand">
        ${state.my_hand.map((card, i) => {
        const isSelected = selectedCard?.animal === card[0] && selectedCard?.value === card[1];
        return `
            <div class="card ${isSelected ? 'selected' : ''}" data-idx="${i}" data-a="${card[0]}" data-v="${card[1]}">
              <div class="emoji">${EMOJIS[card[0]]}</div>
              <div>${card[1]}</div>
            </div>
          `;
    }).join("")}
      </div>
    </div>
  `;
    app.innerHTML = html;
    document.querySelectorAll('.card').forEach(el => {
        el.addEventListener('click', (e) => {
            if (!isMyTurn)
                return;
            const target = e.currentTarget;
            selectedCard = {
                animal: target.getAttribute('data-a'),
                value: parseInt(target.getAttribute('data-v'))
            };
            render();
        });
    });
    document.querySelectorAll('.token-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            const animal = e.currentTarget.getAttribute('data-animal');
            handlePlayToken(animal);
        });
    });
}
render();
//# sourceMappingURL=main.js.map