import os
import time
import requests
from datetime import datetime, timezone
from typing import List, Dict, Optional
from dotenv import load_dotenv
from const import PAIRS_TO_FLUSH

load_dotenv()
# Preious version: each time user says something, we flush immediately to backend. This is inefficient and causes too many API calls.
# New version: we keep an in-memory cache of messages, and only flush to backend when we have accumulated a certain number of pairs (user+bot). 
# This reduces the number of API calls and allows us to keep more context in memory for the agent to use.

BACKEND_BASE = os.getenv("BACKEND_BASE_URL")  # chỉnh nếu khác
LOGIN_USERNAME = os.getenv("AGENT_LOGIN_USERNAME")  # tạo account này trong backend
# Nếu backend yêu cầu password, chỉnh code và DTO. (current backend LoginDto chỉ has Username)

class ConversationCache:
    """
    Keep an in-memory buffer of messages (CreateMessageDto shape)
    Buffer will be flushed to backend when we've accumulated `pairs_to_flush` pairs (user+bot).
    """
    def __init__(self, username, pairs_to_flush: int = PAIRS_TO_FLUSH):
        self.username = username
        self.pairs_to_flush = pairs_to_flush
        self._pending_messages: List[Dict] = []  # list of CreateMessageDto: {SenderType, Content, CreatedAt}
        self._pair_count = 0
        self._token: Optional[str] = None
        self._token_expiry = 0  # epoch seconds; simplistic - you can set long expiry
        self.session = requests.Session()

    # --- HTTP helpers ---
    def _login_if_needed(self):
        # naive caching of token (no expiry check from backend); re-login if token missing
        if self._token and time.time() < self._token_expiry:
            return
        url = f"{BACKEND_BASE}/api/account/login"
        payload = {"username": self.username}
        resp = self.session.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # backend returns { Message, User: { Username, Token } } per controller
        token = None
        if isinstance(data, dict):
            u = data.get("User") or data.get("user") or {}
            token = u.get("Token") or u.get("token")
        if not token:
            raise RuntimeError("Login did not return token. Response: " + str(data))
        self._token = token
        # set expiry to +1 hour by default (adjust as needed)
        self._token_expiry = time.time() + 30 * 60

    def _auth_headers(self) -> Dict[str, str]:
        self._login_if_needed()
        return {"Authorization": f"Bearer {self._token}"}

    # --- API calls ---
    def get_history_messages(self) -> List[Dict]:
        """
        Fetch conversation history (all messages) from backend for the logged-in user.
        Returns list of message DTOs (MessageDto) or [].
        """
        limit = 2*self.pairs_to_flush
        url = f"{BACKEND_BASE}/api/conversation-history?limit={limit}"
        resp = self.session.get(url, headers=self._auth_headers(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # controller returns conversation history DTO with Messages property
        messages = data.get("messages") or data.get("Messages") or []
        return messages

    def post_messages(self, messages: List[Dict]) -> List[Dict]:
        """
        Send list of CreateMessageDto to backend. Returns created messages.
        Each message: { "SenderType": int, "Content": str, "CreatedAt": "2025-11-15T..."}
        """
        if not messages:
            return []
        url = f"{BACKEND_BASE}/api/messages"
        resp = self.session.post(url, json=messages, headers=self._auth_headers(), timeout=10)
        resp.raise_for_status()
        return resp.json()

    # --- Cache operations ---
    def add_user_message(self, Content: str, created_at: Optional[datetime] = None):
        created_at = created_at or datetime.now(timezone.utc)
        dto = {
            "SenderType": 0,
            "Content": Content,
            "CreatedAt": created_at.isoformat()
        }
        self._pending_messages.append(dto)
        # don't increment pair yet; pair completes when agent adds response
        # but for simplification, we can mark that a user message is added
        return dto

    def add_agent_message(self, Content: str, created_at: Optional[datetime] = None):
        created_at = created_at or datetime.now(timezone.utc)
        dto = {
            "SenderType": 1,
            "Content": Content,
            "CreatedAt": created_at.isoformat()
        }
        self._pending_messages.append(dto)
        # a full pair just completed (user + agent)
        self._pair_count += 1
        # flush if reached threshold
        if self._pair_count >= self.pairs_to_flush:
            self.flush()
        return dto

    def flush(self):
        if not self._pending_messages:
            return []
        try:
            created = self.post_messages(self._pending_messages)
        except Exception as e:
            print("Flush failed:", e)
            return []
        # Xóa cache khi gửi thành công
        self._pending_messages = []
        self._pair_count = 0
        return created


    # def get_last_n_pairs(self, n_pairs: int = 5) -> List[Dict]:
    #     """
    #     Return the last n_pairs from backend as list of {"user": "...", "bot": "..."}.
    #     If total messages are odd (missing last bot), we ignore the incomplete tail.
    #     """
    #     messages = self.get_history_messages()
    #     if not messages:
    #         return []
    #     # messages are presumably ordered by CreatedAt ascending (check ordering, else sort)
    #     # ensure ordering:
    #     def key_fn(m):
    #         return m.get("CreatedAt") or m.get("CreatedAt") or ""
    #     try:
    #         messages_sorted = sorted(messages, key=lambda m: key_fn(m))
    #     except Exception:
    #         messages_sorted = messages

    #     # take last 2*n_pairs messages
    #     tail = messages_sorted[-(2 * n_pairs):] if len(messages_sorted) >= 2 * n_pairs else messages_sorted
    #     # convert to pairs
    #     pairs = []
    #     i = 0
    #     while i + 1 < len(tail):
    #         a = tail[i]
    #         b = tail[i + 1]
    #         # ensure a is user and b is bot; if not, try to align by scanning
    #         if a.get("SenderType", a.get("SenderType", None)) == 0 and b.get("SenderType", b.get("SenderType", None)) == 1:
    #             pairs.append({"user": a.get("Content") or a.get("Content"), "bot": b.get("Content") or b.get("Content")})
    #             i += 2
    #         else:
    #             # shift by 1 to try align
    #             i += 1
    #     # return the last n_pairs (might be <= n_pairs)
    #     return pairs[-n_pairs:]

    def get_last_n_pairs(self, n_pairs: int = PAIRS_TO_FLUSH) -> List[Dict]:
        """
        Return last n_pairs using:
        1) pending cache pairs (newest)
        2) only the required remaining pairs from database
        """

        # ---- STEP 1: Build pairs from cache ----
        cache_pairs = self._extract_pairs_from_messages(self._pending_messages)

        num_cache_pairs = len(cache_pairs)
        if num_cache_pairs >= n_pairs:
            # Cache đủ → chỉ cần lấy từ cache, không cần query DB
            return cache_pairs[-n_pairs:]

        # ---- STEP 2: Need additional pairs from DB ----
        needed = n_pairs - num_cache_pairs

        # Query database ONLY for needed pairs → not entire history
        db_pairs = self._get_last_db_pairs(needed)

        # ---- STEP 3: Combine (cache is newer, DB older) ----
        combined = db_pairs + cache_pairs
        
        print("Cache pairs:", cache_pairs)
        print("DB pairs:", db_pairs)
        print("Combined pairs:", combined)

        return combined[-n_pairs:]


    def _get_last_db_pairs(self, needed_pairs: int) -> List[Dict]:
        """
        Fetch only the minimal required number of messages from the database.
        """
        messages = self.get_history_messages()

        if not messages:
            return []

        # Sort messages by CreatedAt
        def key_fn(m): 
            return m.get("CreatedAt") or ""
        messages_sorted = sorted(messages, key=key_fn)

        # Take exactly needed pairs → 2*needed messages
        tail = messages_sorted[-(2 * needed_pairs):]
        return self._extract_pairs_from_messages(tail)


    def _extract_pairs_from_messages(self, msgs: List[Dict]) -> List[Dict]:
        """
        Convert sequential messages into pairs like:
        {"user": "...", "bot": "..."}
        """
        pairs = []
        i = 0
        while i + 1 < len(msgs):
            a, b = msgs[i], msgs[i+1]
            if (a.get("SenderType") == 0 
                and b.get("SenderType") == 1):
                pairs.append({"user": a["Content"], "bot": b["Content"]})
                i += 2
            else:
                i += 1
        return pairs


# create a global cache instance for convenience
# cache = ConversationCache(pairs_to_flush=int(PAIRS_TO_FLUSH))