# Log Streaming System Design: 3 Production Approaches

## Context

- RL training jobs run on remote GPU pods via SSH
- Prime-RL outputs logs to files on the pod
- Goal: Stream log file updates to frontend in real-time
- Current stack: FastAPI, Celery, Redis, PostgreSQL, Next.js (polling-based)

---

## Approach 1: Server-Sent Events (SSE) with Tail-Based Polling

**Architecture:**

```
┌──────────┐    SSE Stream     ┌──────────────┐   SSH tail -f   ┌─────────┐
│ Frontend │ ◄──────────────── │   FastAPI    │ ◄────────────── │ GPU Pod │
│ (Next.js)│    (EventSource)  │   Endpoint   │   (asyncssh)    │ (logs)  │
└──────────┘                   └──────────────┘                 └─────────┘
```

**How it works:**

1. Frontend opens SSE connection to `/api/runs/{runId}/logs/stream`
2. FastAPI endpoint opens persistent SSH connection to pod
3. Runs `tail -f /path/to/log.file` via SSH
4. Streams each new line as SSE event to frontend

**Implementation:**

```python
# FastAPI endpoint
@router.get("/runs/{run_id}/logs/stream")
async def stream_logs(run_id: str):
    async def generate():
        async with connect_ssh(pod) as conn:
            async with conn.create_process("tail -f /workspace/logs/train.log") as proc:
                async for line in proc.stdout:
                    yield f"data: {json.dumps({'line': line})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Pros:**

- Simple to implement (native browser API, no library needed)
- Works through proxies/load balancers
- Automatic reconnection built into EventSource
- One-way stream is efficient for logs

**Cons:**

- One SSH connection per viewer (doesn't scale with many concurrent viewers)
- Connection drops require frontend reconnection logic
- No backpressure if client is slow

**Best for:** Small teams, single viewer, quick implementation

---

## Approach 2: Redis Pub/Sub with WebSocket Fan-Out

**Architecture:**

```
┌──────────┐  WebSocket  ┌──────────────┐        ┌───────┐
│ Frontend │ ◄────────── │   FastAPI    │ ◄───── │ Redis │
│ (Next.js)│             │  (WS rooms)  │ Sub    │Pub/Sub│
└──────────┘             └──────────────┘        └───┬───┘
                                                     │ Pub
┌─────────────┐   SSH tail   ┌─────────┐            │
│Celery Worker│ ◄─────────── │ GPU Pod │ ───────────┘
│ (log-tailer)│              │ (logs)  │
└─────────────┘              └─────────┘
```

**How it works:**

1. Celery task opens SSH to pod, runs `tail -f` on log file
2. Each log line is published to Redis channel: `logs:{run_id}`
3. FastAPI WebSocket endpoint subscribes to channel
4. Multiple frontends can connect to same channel (fan-out)

**Implementation:**

```python
# Celery task (runs on worker)
@celery_app.task
def tail_logs(run_id: str, log_path: str):
    redis = Redis()
    with ssh_connect(pod) as conn:
        for line in conn.exec("tail -f " + log_path):
            redis.publish(f"logs:{run_id}", line)

# FastAPI WebSocket
@router.websocket("/runs/{run_id}/logs/ws")
async def websocket_logs(ws: WebSocket, run_id: str):
    await ws.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"logs:{run_id}")
    async for message in pubsub.listen():
        await ws.send_text(message["data"])
```

**Pros:**

- Single SSH connection serves unlimited viewers
- Redis handles message distribution
- WebSocket enables bidirectional (pause/resume, seek)
- Scales horizontally with Redis Cluster

**Cons:**

- More moving parts (Celery task + Redis + WS)
- Need heartbeat/keepalive for connections
- Pub/Sub doesn't persist (late joiners miss history)

**Best for:** Multiple concurrent viewers, production systems

---

## Approach 3: Log Aggregation with Chunked Storage (Most Scalable)

**Architecture:**

```
┌──────────┐   REST + SSE   ┌──────────────┐   Query   ┌───────────────┐
│ Frontend │ ◄───────────── │   FastAPI    │ ◄──────── │  PostgreSQL   │
│ (Next.js)│  /logs?offset= │   Endpoint   │           │ (log_chunks)  │
└──────────┘                └──────────────┘           └───────┬───────┘
                                                               │
┌─────────────┐   SSH (periodic)   ┌─────────┐                │
│Celery Beat  │ ◄───────────────── │ GPU Pod │ ───────────────┘
│ (log-sync)  │   read + chunk     │ (logs)  │    Write chunks
└─────────────┘                    └─────────┘
```

**How it works:**

1. Celery Beat task runs every 2-5 seconds
2. SSH into pod, read log file from last known offset
3. Store new content as chunks in PostgreSQL (with offset, timestamp)
4. Frontend polls `/logs?after_offset=X` or uses SSE for new chunks
5. Historical logs always available (persistence)

**Database Schema:**

```sql
CREATE TABLE log_chunks (
    id SERIAL PRIMARY KEY,
    run_id UUID REFERENCES runs(id),
    log_file VARCHAR(255),          -- e.g., "train.log", "eval.log"
    chunk_offset BIGINT,            -- byte offset in file
    chunk_size INT,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(run_id, log_file, chunk_offset)
);
CREATE INDEX idx_log_chunks_run_offset ON log_chunks(run_id, log_file, chunk_offset);
```

**Implementation:**

```python
# Celery Beat task
@celery_app.task
def sync_logs(run_id: str):
    last_offset = db.query("SELECT MAX(chunk_offset + chunk_size) FROM log_chunks WHERE run_id = %s")
    with ssh_connect(pod) as conn:
        new_content = conn.exec(f"tail -c +{last_offset} /workspace/logs/train.log")
        if new_content:
            db.insert(LogChunk(run_id, last_offset, new_content))

# FastAPI - historical + streaming
@router.get("/runs/{run_id}/logs")
async def get_logs(run_id: str, after_offset: int = 0, stream: bool = False):
    chunks = db.query("SELECT * FROM log_chunks WHERE run_id = %s AND chunk_offset > %s ORDER BY chunk_offset", run_id, after_offset)

    if stream:
        async def generate():
            last = after_offset
            while True:
                new = await db.query("... WHERE chunk_offset > %s", last)
                for chunk in new:
                    yield f"data: {chunk.content}\n\n"
                    last = chunk.chunk_offset
                await asyncio.sleep(1)
        return StreamingResponse(generate(), media_type="text/event-stream")

    return {"chunks": chunks}
```

**Pros:**

- Full log history (seekable, searchable)
- Survives pod termination (logs persisted)
- Works with polling OR SSE (flexible)
- Can add search, filtering, time-range queries
- Decoupled: log ingestion separate from serving

**Cons:**

- Latency (2-5s batching vs real-time)
- Storage costs for large logs
- More complex to implement

**Best for:** Production systems, audit trails, debugging historical runs

---

## Comparison Matrix

| Criteria              | SSE + Tail | Redis Pub/Sub | Chunked Storage |
| --------------------- | ---------- | ------------- | --------------- |
| Implementation effort | Low        | Medium        | High            |
| Real-time latency     | ~100ms     | ~100ms        | 2-5 seconds     |
| Multiple viewers      | Poor       | Excellent     | Good            |
| Historical logs       | No         | No            | Yes             |
| Pod failure recovery  | No         | No            | Yes             |
| Horizontal scaling    | Poor       | Good          | Excellent       |
| System design score   | Basic      | Strong        | Most impressive |
