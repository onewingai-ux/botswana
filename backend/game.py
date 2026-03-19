import random
from typing import List, Dict, Optional, Any

ANIMALS = ["Lion", "Rhino", "Elephant", "Leopard", "Zebra"]

class GameState:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players = []          
        self.is_playing = False
        
        # Multi-round state
        self.current_round = 0
        self.max_rounds = 0
        self.round_ended = False
        self.game_over = False
        
        self.current_turn_index = 0
        self.deck = []             
        self.hands = {}            
        self.board = {a: [] for a in ANIMALS}  
        self.pool = {a: 5 for a in ANIMALS}    
        
        self.player_tokens = {}    
        self.round_scores = {}     # scores just for current round
        self.global_scores = {}    # total score across all rounds
        
        # Store detailed breakdown of how scores were calculated for animation
        self.score_breakdown = {}  
        
        self.logs = []

    def add_player(self, player_id: str):
        if not self.is_playing and player_id not in self.players:
            self.players.append(player_id)
            self.hands[player_id] = []
            self.player_tokens[player_id] = {a: 0 for a in ANIMALS}
            self.round_scores[player_id] = 0
            self.global_scores[player_id] = 0

    def start_game(self):
        """Called once at the very beginning of the whole game."""
        if len(self.players) < 2:
            return False
            
        self.max_rounds = len(self.players)
        self.current_round = 0
        self.global_scores = {p: 0 for p in self.players}
        self.game_over = False
        
        return self.start_next_round()

    def start_next_round(self):
        """Called at the beginning of each individual round."""
        if self.current_round >= self.max_rounds:
            self.game_over = True
            return False
            
        self.current_round += 1
        self.is_playing = True
        self.round_ended = False
        
        # Whoever's turn it was (or 0) starts, but let's shift starting player each round
        self.current_turn_index = (self.current_round - 1) % len(self.players)
        
        self.board = {a: [] for a in ANIMALS}
        self.pool = {a: 5 for a in ANIMALS}
        self.score_breakdown = {}
        
        for p in self.players:
            self.player_tokens[p] = {a: 0 for a in ANIMALS}
            self.round_scores[p] = 0
            self.hands[p] = []
            
        self.logs = [f"Round {self.current_round} started!"]

        # Create deck: 6 cards per animal (0-5)
        self.deck = [(a, v) for a in ANIMALS for v in range(6)]
        random.shuffle(self.deck)

        # Remove cards so deck deals evenly
        num_players = len(self.players)
        cards_to_remove = len(self.deck) % num_players
        for _ in range(cards_to_remove):
            self.deck.pop()

        # Deal cards
        cards_per_player = len(self.deck) // num_players
        for p in self.players:
            self.hands[p] = [self.deck.pop() for _ in range(cards_per_player)]

        return True

    def current_player(self) -> str:
        if not self.players: return ""
        return self.players[self.current_turn_index]

    def play_turn(self, player_id: str, card_animal: str, card_value: int, token_animal: str) -> bool:
        if not self.is_playing or self.round_ended or self.game_over:
            return False
        if player_id != self.current_player():
            return False
        
        # Validate card in hand
        card = (card_animal, card_value)
        if card not in self.hands[player_id]:
            return False
            
        # Validate token available
        if self.pool[token_animal] <= 0:
            return False

        # Apply play
        self.hands[player_id].remove(card)
        self.board[card_animal].append(card_value)
        self.pool[token_animal] -= 1
        self.player_tokens[player_id][token_animal] += 1
        
        # Friendly display name for logs
        display_name = player_id.split('-')[0] if '-' in player_id else player_id
        self.logs.append(f"{display_name} played {card_animal} {card_value} and took a {token_animal} token.")

        # Check for round end (6th card of any animal played)
        if len(self.board[card_animal]) == 6:
            self.end_round(f"6th {card_animal} card was played!")
        else:
            self.current_turn_index = (self.current_turn_index + 1) % len(self.players)
        return True

    def end_round(self, reason: str):
        self.round_ended = True
        self.is_playing = False
        self.logs.append(f"Round ended: {reason}")
        
        # Lock in the final values of the animals
        final_values = {a: (self.board[a][-1] if self.board[a] else 0) for a in ANIMALS}
        
        # Calculate scores
        for p in self.players:
            score = 0
            breakdown = {}
            for a in ANIMALS:
                tokens = self.player_tokens[p][a]
                value = final_values[a]
                pts = tokens * value
                score += pts
                breakdown[a] = {"tokens": tokens, "value": value, "pts": pts}
                
            self.round_scores[p] = score
            self.global_scores[p] += score
            self.score_breakdown[p] = {
                "total": score,
                "animals": breakdown
            }
            
            display_name = p.split('-')[0] if '-' in p else p
            self.logs.append(f"{display_name} scored {score} points this round.")
            
        if self.current_round >= self.max_rounds:
            self.game_over = True
            self.logs.append("Game Over! All rounds complete.")

    def get_client_state(self, player_id: str) -> Dict[str, Any]:
        """Returns the state viewable by a specific player (hiding opponent hands)."""
        opponents = []
        for p in self.players:
            if p != player_id:
                opponents.append({
                    "id": p,
                    "tokens": self.player_tokens.get(p, {}),
                    "hand_count": len(self.hands.get(p, [])),
                    "score": self.global_scores.get(p, 0),
                    "round_score": self.round_scores.get(p, 0)
                })

        status = "waiting"
        if self.game_over:
            status = "game_over"
        elif self.round_ended:
            status = "round_ended"
        elif self.is_playing:
            status = "playing"

        return {
            "room_id": self.room_id,
            "status": status,
            "current_round": self.current_round,
            "max_rounds": self.max_rounds,
            "current_player": self.current_player(),
            "board": {a: self.board[a] for a in ANIMALS},
            "board_counts": {a: len(self.board[a]) for a in ANIMALS},
            "pool": self.pool,
            "my_id": player_id,
            "my_hand": self.hands.get(player_id, []),
            "my_tokens": self.player_tokens.get(player_id, {}),
            "my_score": self.global_scores.get(player_id, 0),
            "my_round_score": self.round_scores.get(player_id, 0),
            "score_breakdown": self.score_breakdown,
            "opponents": opponents,
            "logs": self.logs[-6:], 
            "players": self.players
        }
