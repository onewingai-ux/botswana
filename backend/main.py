import asyncio
import json
import uuid
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from typing import Dict, Any, List
from pydantic import BaseModel
import os

from game import GameState, ANIMALS

app = FastAPI()

# In-memory store
rooms: Dict[str, GameState] = {}
connections: Dict[str, List[WebSocket]] = {} 

class PlayRequest(BaseModel):
    card_animal: str
    card_value: int
    token_animal: str

def generate_room_id() -> str:
    return str(uuid.uuid4())[:6].upper()

async def broadcast_state(room_id: str):
    if room_id in rooms and room_id in connections:
        state = rooms[room_id]
        for ws in connections[room_id]:
            player_id = getattr(ws, "player_id", None)
            if player_id:
                try:
                    await ws.send_json({"type": "state", "data": state.get_client_state(player_id)})
                except:
                    pass 

async def handle_bot_turn(room_id: str):
    await asyncio.sleep(1.5) 
    state = rooms.get(room_id)
    if not state or not state.is_playing: return

    current = state.current_player()
    if not current.startswith("Bot"): return

    hand = state.hands[current]
    if not hand: return

    # Simple bot AI: pick random card, pick random available token
    card_animal, card_value = random.choice(hand)
    available_tokens = [a for a, count in state.pool.items() if count > 0]
    if not available_tokens: return
    token_animal = random.choice(available_tokens)

    success = state.play_turn(current, card_animal, card_value, token_animal)
    if success:
        await broadcast_state(room_id)
        if state.is_playing and state.current_player().startswith("Bot"):
            asyncio.create_task(handle_bot_turn(room_id))

@app.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    await websocket.accept()
    
    if room_id not in rooms:
        rooms[room_id] = GameState(room_id)
        connections[room_id] = []
        
    state = rooms[room_id]
    
    websocket.player_id = player_id
    connections[room_id].append(websocket)
    
    if player_id not in state.players:
        state.add_player(player_id)
    
    await broadcast_state(room_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif msg_type == "start":
                if state.start_game():
                    await broadcast_state(room_id)
                    if state.current_player().startswith("Bot"):
                        asyncio.create_task(handle_bot_turn(room_id))
            
            elif msg_type == "next_round":
                if state.start_next_round():
                    await broadcast_state(room_id)
                    if state.current_player().startswith("Bot"):
                        asyncio.create_task(handle_bot_turn(room_id))

            elif msg_type == "add_bot":
                bot_id = f"Bot {sum(1 for p in state.players if p.startswith('Bot')) + 1}"
                state.add_player(bot_id)
                await broadcast_state(room_id)

            elif msg_type == "play":
                payload = message.get("payload", {})
                success = state.play_turn(
                    player_id, 
                    payload.get("card_animal"), 
                    payload.get("card_value"), 
                    payload.get("token_animal")
                )
                if success:
                    await broadcast_state(room_id)
                    if state.current_player().startswith("Bot"):
                        asyncio.create_task(handle_bot_turn(room_id))

    except WebSocketDisconnect:
        if room_id in connections:
            if websocket in connections[room_id]:
                connections[room_id].remove(websocket)
            if not connections[room_id]:
                del rooms[room_id]

# Mount frontend
dist_path = os.path.join(os.path.dirname(__file__), "dist")
if os.path.isdir(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        try:
            with open(os.path.join(dist_path, "index.html"), "r") as f:
                return HTMLResponse(content=f.read())
        except FileNotFoundError:
            return HTMLResponse(content="<h1>Frontend build not found</h1>", status_code=404)
else:
    @app.get("/")
    async def root():
        return {"message": "Botswana API. Frontend not mounted."}
