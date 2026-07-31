# v7 · Redis & Concurrency

**What you'll build:** put **Redis** in front of Postgres so the active conversation loads from a fast in-memory cache instead of hitting the database on every single turn — and make the app correct under **concurrent users** hitting it at once.

## Why this version

In v6, every message does a Postgres round-trip to load the whole history, then writes back. That's fine for one user, but under load — many users, many turns — those DB reads become the bottleneck and add latency to every reply. Redis holds each user's *active* conversation in memory (sub-millisecond reads), with Postgres as the durable system of record. This is the standard **cache + database** pattern, and it's where you start thinking like a backend engineer about **concurrency**, not just correctness.

## The pattern — cache-aside

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">request</span>
    <span class="darr">→<span class="lbl">1. check</span></span>
    <span class="dbox orange">⚡ Redis<span class="sub">active convo?</span></span>
    <span class="darr">→<span class="lbl">miss → 2. load</span></span>
    <span class="dbox blue">🗄️ Postgres<span class="sub">durable truth</span></span>
    <span class="darr">→<span class="lbl">3. fill cache</span></span>
    <span class="dbox green">⚡ Redis</span>
  </div>
  <div class="dcap">Read from Redis; on a miss, load from Postgres and populate Redis. Writes go to both.</div>
</div>

- **Read:** try Redis first. Hit → use it (fast). Miss → load from Postgres, then store in Redis for next time.
- **Write:** append the new turn to **both** Redis (so it's instantly current) and Postgres (so it's durable). Postgres is the source of truth; Redis is a fast copy.
- **Expiry:** give the Redis key a TTL (e.g. 30 min). Idle conversations fall out of cache automatically; the next message just reloads from Postgres.

## The code

```python
# store.py
import json, redis
r = redis.from_url(os.environ["REDIS_URL"])
TTL = 1800   # 30 min

def cache_key(user_id): return f"convo:{user_id}"

def load_history(user_id):
    cached = r.get(cache_key(user_id))
    if cached:
        return json.loads(cached)                    # fast path: Redis hit
    history = load_from_postgres(user_id)            # slow path: DB (your v6 loader)
    r.setex(cache_key(user_id), TTL, json.dumps(history))
    return history

def append_turn(user_id, role, content):
    save_to_postgres(user_id, role, content)         # durable (v6 writer)
    key = cache_key(user_id)
    history = json.loads(r.get(key) or "null") or load_from_postgres(user_id)
    history.append({"role": role, "content": content})
    r.setex(key, TTL, json.dumps(history))           # keep cache current + refresh TTL
```

The endpoint barely changes — swap v6's direct Postgres calls for `load_history` / `append_turn`. The caching is invisible to the rest of the app.

## Concurrency — the part that bites

With many users at once, two issues appear:

1. **One user, two rapid messages.** If a user double-sends, two requests can interleave and corrupt the cached list. Fix: a short **per-user lock** (Redis `SET key val NX EX 5`) so one user's turns process one at a time. Different users never block each other — the lock is per `user_id`.
2. **Blocking the event loop.** The OpenAI call and DB I/O must not freeze the server for other users. FastAPI handles concurrent requests, but make sure slow calls are `async` / run in a threadpool so one user's 20-second generation doesn't stall everyone else.

```python
# ponytail: per-user lock, 5s expiry so a crash can't deadlock the user.
#   Good enough for a single API instance. Multiple instances = same Redis, still works.
def with_user_lock(user_id):
    return r.set(f"lock:{user_id}", "1", nx=True, ex=5)   # True if acquired
```

## Make it real — required for this version

- **Cache hit path works** — second message in a conversation loads from Redis, not Postgres (log which path ran and see the difference).
- **Durability intact** — flush Redis entirely; histories still load (from Postgres) and refill the cache.
- **Concurrency safe** — fire two quick messages from the same user; the history doesn't corrupt.
- **Postgres stays the source of truth** — Redis is disposable; losing it costs speed, never data.
- **Commit and `git tag v7`.** README: "v7 — Redis cache-aside + per-user locking for concurrency."

## Common mistakes

- **Treating Redis as the source of truth.** It's a cache — it can be evicted or flushed anytime. Every write must also hit Postgres.
- **No TTL** — cache grows forever and serves stale data. Always expire.
- **A global lock** instead of per-user — that serialises *all* users and kills throughput. Lock per `user_id`.
- **Forgetting cache invalidation on truncation** — if you trim history (v4), update the cached copy too, or it drifts from Postgres.

## Interview tip

*"v7 added a Redis cache-aside layer: reads try Redis, miss falls back to Postgres and repopulates, writes go to both with Postgres as the source of truth and a TTL on the cache. For concurrency I use a per-user Redis lock so one user's rapid messages serialise without blocking other users, and keep the LLM/DB calls async so a slow generation doesn't stall the event loop."* That answer shows cache-pattern fluency *and* concurrency awareness — senior backend signals.

*Next: v8 — deploy the whole thing so real users on the internet can reach it.*
