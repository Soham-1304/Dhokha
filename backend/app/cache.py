import json
import time
from collections import defaultdict
from threading import Lock

from app.config import settings


class Cache:
    """Redis-backed primitives with deterministic in-memory fallback."""

    def __init__(self):
        self.redis = None
        self._values: dict[str, tuple[object, float | None]] = {}
        self._lists: dict[str, list[tuple[float, str]]] = defaultdict(list)
        self._lock = Lock()
        if settings.redis_url:
            try:
                import redis
                client = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=0.1)
                client.ping()
                self.redis = client
            except Exception:
                self.redis = None

    @property
    def backend(self) -> str:
        return "redis" if self.redis else "memory"

    def get(self, key: str, default=None):
        if self.redis:
            value = self.redis.get(key)
            return default if value is None else json.loads(value)
        item = self._values.get(key)
        if not item:
            return default
        value, expires = item
        if expires and expires < time.time():
            self._values.pop(key, None)
            return default
        return value

    def set(self, key: str, value, ttl: int | None = None):
        if self.redis:
            self.redis.set(key, json.dumps(value), ex=ttl)
            return
        self._values[key] = (value, time.time() + ttl if ttl else None)

    def window_add_and_count(self, key: str, timestamp: float, window_seconds: int) -> int:
        cutoff = timestamp - window_seconds
        member = f"{timestamp}:{time.monotonic_ns()}"
        if self.redis:
            pipe = self.redis.pipeline()
            pipe.zadd(key, {member: timestamp})
            pipe.zremrangebyscore(key, "-inf", cutoff)
            pipe.zcard(key)
            pipe.expire(key, window_seconds * 2)
            return int(pipe.execute()[2])
        with self._lock:
            values = [(score, item) for score, item in self._lists[key] if score >= cutoff]
            values.append((timestamp, member))
            self._lists[key] = values
            return len(values)

    def clear(self):
        self._values.clear()
        self._lists.clear()
        if self.redis:
            for key in self.redis.scan_iter("dhokha:*"):
                self.redis.delete(key)


cache = Cache()

