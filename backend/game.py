import random
from typing import List, Dict, Optional, Any

ANIMALS = ["Lion", "Rhino", "Elephant", "Leopard", "Zebra"]

class GameState:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players = []          # List of player IDs
        self.is_playing = False
        self.current_turn_index = 0
        self.deck = []             # List of (animal, value)
        self.hands = {}            # player_id -> List[(animal, value)]
        self.board = {a: [] for a in ANIMALS}  # animal -> List[int] (stack of cards)
        self.pool = {a: 5 for a in ANIMALS}    # animal -> count
        self.player_tokens = {}    # player_id -> Dict[animal, count]
        self.scores = {}           # player_id -> int
        self.logs = []
        self.round_ended = False

    def add_player(self, player_id: str):
        if not self.is_playing and player_id not in self.players:
            self.players.append(player_id)
            self.hands[player_id] = []
            self.player_tokens[player_id] = {a: 0 for a in ANIMALS}
            self.scores[player_id] = 0

    def start_game(self):
        if len(self.players) < 2:
            return False
        
        self.is_playing = True
        self.round_ended = False
        self.current_turn_index = 0
        self.board = {a: [] for a in ANIMALS}
        self.pool = {a: 5 for a in ANIMALS}
        for p in self.players:
            self.player_tokens[p] = {a: 0 for a in ANIMALS}
            self.scores[p] = 0
            self.hands[p] = []
        self.logs = ["Game started!"]

        # Create deck: 6 cards per animal (0-5)
        self.deck = []
        for a in ANIMALS:
            for v in range(6):
                self.deck.append((a, v))
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
        if not self.players:
            return ""
        return self.players[self.current_turn_index]

    def play_turn(self, player_id: str, card_animal: str, card_value: int, token_animal: str) -> bool:
        if not self.is_playing or self.round_ended:
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
        
        self.logs.append(f"{player_id} played {card_animal} {card_value} and took a {token_animal} token.")

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
        
        # Calculate scores
        for p in self.players:
            score = 0
            for a in ANIMALS:
                tokens = self.player_tokens[p][a]
                # Value of token is the top card of that animal stack, or 0 if empty
                value = self.board[a][-1] if self.board[a] else 0
                score += tokens * value
            self.scores[p] = score
            self.logs.append(f"{p} scored {score} points.")

    def get_client_state(self, player_id: str) -> Dict[str, Any]:
        """Returns the state viewable by a specific player (hiding opponent hands)."""
        opponents = []
        for p in self.players:
            if p != player_id:
                opponents.append({
                    "id": p,
                    "tokens": self.player_tokens.get(p, {}),
                    "hand_count": len(self.hands.get(p, [])),
                    "score": self.scores.get(p, 0)
                })

        return {
            "room_id": self.room_id,
            "status": "playing" if self.is_playing else ("ended" if self.round_ended else "waiting"),
            "current_player": self.current_player(),
            "board": {a: (self.board[a][-1] if self.board[a] else None) for a in ANIMALS},
            "board_counts": {a: len(self.board[a]) for a in ANIMALS},
            "pool": self.pool,
            "my_id": player_id,
            "my_hand": self.hands.get(player_id, []),
            "my_tokens": self.player_tokens.get(player_id, {}),
            "my_score": self.scores.get(player_id, 0),
            "opponents": opponents,
            "logs": self.logs[-5:], # last 5 logs
            "players": self.players
        }
