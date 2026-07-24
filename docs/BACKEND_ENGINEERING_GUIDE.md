# Dhokha Backend Engineering & API Guide

**Version:** 0.1.0
**Last verified:** 24 July 2026
**Purpose:** Technical reference, live-demo runbook, and integration contract for the Dhokha multi-bank UPI fraud detection MVP.

> **Data statement:** Every identity, account, device, location, and transaction used by this project is synthetic. The service does not contain or process real banking customer data.

## 1. Executive Summary

Dhokha is a FastAPI backend that demonstrates real-time UPI fraud evaluation and multi-bank fraud-swarm discovery. It combines:

- a low-latency ONNX transaction classifier;
- deterministic behavioral rules for dependable hackathon demonstrations;
- an optional hosted Gemma 3 4B fallback through Amazon Bedrock;
- SQLite persistence and optional Redis velocity windows;
- an in-memory NetworkX transaction graph;
- asynchronous swarm confirmation and WebSocket events.

The backend exposes two intentionally separate scoring surfaces:

1. `POST /v1/evaluate` performs nine-field ONNX inference. It is used by the current Transaction Scorer page.
2. `POST /score` performs the complete synthetic UPI pipeline: validation, persistence, behavioral features, deterministic swarm rules, a heuristic/joblib model, decisioning, and asynchronous graph processing.

The current `/score` implementation does **not** call the ONNX model. This distinction is important when explaining the system.

## 2. Current Demo URLs

| Surface | URL |
|---|---|
| Hosted frontend | `https://dhokha-vert.vercel.app` |
| HTTPS backend | `https://api.dhokha.bharathperni.dev` |
| Swagger UI | `https://api.dhokha.bharathperni.dev/docs` |
| OpenAPI JSON | `https://api.dhokha.bharathperni.dev/openapi.json` |
| WebSocket stream | `wss://api.dhokha.bharathperni.dev/stream` |
| Local backend | `http://127.0.0.1:8000` |
| Local frontend | `http://127.0.0.1:5173` |

The Vercel deployment uses `frontend/vercel.json` to rewrite `/api/*` to the AWS backend.

## 3. Technology Choices

| Technology | Role | Reason |
|---|---|---|
| FastAPI | HTTP/WebSocket API | Native validation, automatic OpenAPI docs, async support, and low framework overhead. |
| Pydantic | Contract validation | Rejects malformed amounts, locations, devices, and transfers before scoring. |
| SQLite + SQLAlchemy | Demo persistence | Self-contained, deterministic, simple to reset, and sufficient for a single-instance MVP. |
| Redis (optional) | Velocity windows/cache | Sorted-set windows support fast rolling counts; memory fallback keeps the demo usable without Redis. |
| NetworkX | Active graph | Rapid implementation of local paths, chains, cycles, and visualization neighborhoods. |
| ONNX Runtime | Stage-1 inference | Small CPU footprint, portable artifact, and sub-millisecond warm inference on the demo workload. |
| Deterministic rules | Swarm detection | Guarantees predictable Types A-D demonstrations even when ML artifacts are unavailable. |
| Gemma 3 4B on Bedrock | Hosted fallback | Keeps model fallback off the small EC2 host and removes local GPU requirements. |
| EC2 + Nginx | Always-on backend | Avoids serverless cold starts during the live presentation. |
| Let's Encrypt | TLS certificate | Gives REST and WebSocket traffic a browser-trusted certificate with automatic renewal. |

## 4. Runtime Architecture

```text
React/Vercel
    |
    | HTTPS /api/* and WSS /stream
    v
Vercel rewrite
    |
    v
Nginx on EC2 :443
    |
    v
FastAPI :8000
    |-------------------|-------------------|------------------|
    v                   v                   v                  v
SQLite              Redis/memory       NetworkX graph     Model layer
transactions        velocity windows   local topology     ONNX / heuristic
accounts/devices    cached counters    alerts/events      Gemma fallback
```

### Synchronous `/score` flow

1. Validate sender, receiver, amount, timestamp, device fingerprint, and optional coordinates.
2. Enforce idempotency using `transaction_id`.
3. Load account/device history and rolling velocity counts.
4. Calculate behavioral and graph features.
5. Calculate deterministic Types A-D rule scores.
6. Blend model probability and rule score.
7. Persist the decision and latency.
8. Return `allow`, `review`, or `block`.
9. Process the local graph asynchronously and publish events.

### `/v1/evaluate` model flow

1. Validate nine balance/receiver-graph fields.
2. Derive sender and receiver balance reconciliation errors.
3. Execute the ONNX classifier on CPU.
4. Map probability to LOW/MEDIUM/HIGH.
5. If ONNX is unavailable, call Gemma through Bedrock.
6. Return the score, decision, reasons, confidence, and inference latency.

## 5. Fraud Swarm Types

| Type | Pattern | Primary signals |
|---|---|---|
| A | One identity controls accounts across several banks | identity bank count, recent activity |
| B | Many unrelated senders pay one collector/mule | receiver fan-in, young receiver |
| C | Rapid chain or circular layering | chain depth, cycle closure |
| D | Unrelated cross-bank accounts share one device | device account count, device bank count |

Type D is the recommended stage demonstration because the shared-device evidence is easy to explain visually.

## 6. Data Model

### `identities`

- `id`: synthetic identity key.
- `pan_hash`, `aadhaar_hash`: SHA-256 synthetic identifier hashes.
- `risk_flags`: JSON flags.
- `created_at`: creation time.

### `accounts`

- `id`, `identity_id`, `bank_id`.
- `opened_at`.
- `avg_monthly_txn_count`, `avg_txn_amount`.

### `devices` and `account_devices`

- Fingerprint, IP block, first-seen time.
- Many-to-many account/device links with last-used time and use count.

### `transactions`

- Sender, receiver, amount, timestamp, channel, device, optional location.
- Model probability, rule score, confidence, decision, reasons, and latency.

### `alerts`

- Swarm type/status/confidence.
- Involved accounts and banks.
- Transaction value, evidence, and timestamps.

## 7. Decision Logic

### Full `/score` decision thresholds

| Final confidence | Decision |
|---|---|
| `< 0.60` | `allow` |
| `0.60` to `< 0.85` | `review` |
| `>= 0.85` | `block` |

The values are configurable with `ALLOW_THRESHOLD` and `BLOCK_THRESHOLD`.

### `/v1/evaluate` risk tiers

| Fraud score | Tier | Decision |
|---|---|---|
| `< 30` | `LOW` | `ALLOW` |
| `30` to `< 75` | `MEDIUM` | `REVIEW` |
| `>= 75` | `HIGH` | `BLOCK` |

## 8. API Reference

### `GET /`

Service discovery. Returns links to `/docs` and `/health`.

### `GET /health`

Use before a demo or deployment rollout.

```json
{
  "status": "ready",
  "api": "ready",
  "database": "ready",
  "cache": "memory",
  "model": "onnxruntime",
  "model_ready": true,
  "fallback_model": "google.gemma-3-4b-it",
  "fallback_configured": true,
  "fallback_last_error": null,
  "graph_nodes": 45,
  "graph_edges": 4
}
```

### `POST /v1/evaluate`

Runs the ONNX classifier and falls back to hosted Gemma when configured.

High-risk demo request:

```json
{
  "amount": 49900,
  "oldbalanceOrg": 49900,
  "newbalanceOrig": 0,
  "oldbalanceDest": 0,
  "newbalanceDest": 0,
  "dest_in_degree": 45,
  "dest_out_degree": 12,
  "dest_pagerank": 0.0024,
  "is_merchant": 0
}
```

Representative response:

```json
{
  "status": "success",
  "fraud_risk_score": 99.99,
  "risk_tier": "HIGH",
  "decision": "BLOCK",
  "confidence": 0.9999,
  "reasons": [
    {
      "type": "RECEIVER_FAN_IN",
      "detail": "Receiver has 45 historical incoming relationships.",
      "weight": 0.22
    }
  ],
  "performance": {
    "latency_ms": 0.17,
    "sla_compliance": true
  },
  "model_backend": "onnxruntime"
}
```

Possible status codes: `200`, `422`, `503`.

### `POST /score`

Runs the complete synthetic UPI transaction pipeline.

```json
{
  "transaction_id": "demo-normal-001",
  "sender_account_id": "ACC-000",
  "receiver_account_id": "ACC-001",
  "amount": 800,
  "timestamp": "2026-07-24T15:00:00Z",
  "device_fingerprint": "normal-device-000",
  "channel": "UPI",
  "geo_lat": 19.076,
  "geo_lon": 72.8777
}
```

```json
{
  "transaction_id": "demo-normal-001",
  "fraud_probability": 0.12,
  "rule_score": 0.0,
  "final_confidence": 0.066,
  "decision": "allow",
  "suspected_swarm_types": [],
  "top_reasons": [],
  "latency_ms": 4.2,
  "idempotent": false
}
```

Important validation:

- sender and receiver must differ;
- amount must be greater than zero and no more than ₹10,000,000;
- coordinates must be supplied together;
- timestamps more than five minutes in the future are rejected;
- unknown accounts return `404`;
- repeated transaction IDs return the stored decision with `idempotent: true`.

### `POST /demo/reset`

Destructive demo-only operation. Clears transactions, alerts, accounts, devices, and cache values, then recreates 40 deterministic accounts across four banks.

```json
{
  "status": "reset",
  "seed": 2026,
  "accounts": 40,
  "banks": ["BANK_ALPHA", "BANK_BETA", "BANK_GAMMA", "BANK_DELTA"]
}
```

### `POST /demo/inject-swarm`

```json
{
  "swarm_type": "D",
  "size": 5
}
```

Supported types: `A`, `B`, `C`, `D`. Supported size: `3` through `20`.

The response contains a scenario ID, generated account IDs, and every transaction decision. Use an returned `account_id` with the graph endpoint.

### `GET /alerts`

Query parameters:

- `swarm_type`: optional `A`, `B`, `C`, or `D`;
- `status`: optional alert status;
- `limit`: `1` through `500`, default `100`.

Example: `GET /alerts?swarm_type=D&status=confirmed&limit=20`

### `GET /graph/subgraph/{account_id}`

Returns visualization-ready nodes and transaction edges.

Query parameter `depth` accepts `1` through `4`, default `2`.

Example: `GET /graph/subgraph/ACC-000?depth=2`

### `WS /stream`

Streams one shared event envelope:

```json
{
  "event_type": "swarm_confirmed",
  "event_id": "uuid",
  "timestamp": "2026-07-24T15:00:00Z",
  "payload": {}
}
```

Event types:

- `transaction_scored`;
- `swarm_candidate`;
- `swarm_confirmed`.

Local URL: `ws://127.0.0.1:8000/stream`.

Public URL: `wss://api.dhokha.bharathperni.dev/stream`.

Nginx terminates TLS and forwards WebSocket upgrade headers to FastAPI. The public stream has been verified end to end by opening WSS, scoring a transaction over HTTPS, and receiving its `transaction_scored` event.

## 9. Demo Runbook

1. Open `/health` and show that API, database, and model are ready.
2. Call `/demo/reset`.
3. Call `/score` with the normal ACC-000 to ACC-001 transaction.
4. Show the `allow` decision and low latency.
5. Call `/demo/inject-swarm` with Type D and size 5.
6. Show at least one `block` decision and the shared-device evidence.
7. Call `/alerts?swarm_type=D`.
8. Copy one generated `account_id` and call `/graph/subgraph/{account_id}`.
9. Explain that graph confirmation happens after synchronous payment scoring.
10. Use `/v1/evaluate` to demonstrate the ONNX score and explainability output.

## 10. Local Development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

```bash
cd frontend
npm ci
npm run dev
```

The Vite development server rewrites `/api/*` to `http://127.0.0.1:8000/*`.

## 11. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/dhokha.db` | Persistence database |
| `REDIS_URL` | empty | Optional Redis connection |
| `ALLOW_THRESHOLD` | `0.60` | `/score` review boundary |
| `BLOCK_THRESHOLD` | `0.85` | `/score` block boundary |
| `MODEL_PATH` | `./models/fraud_model.joblib` | Optional behavioral model artifact |
| `DEMO_SEED` | `2026` | Deterministic reset seed |
| `CORS_ORIGINS` | local Vite origins | Browser origins |
| `BEDROCK_ENABLED` | `false` | Hosted fallback switch |
| `BEDROCK_API_KEY` | empty | Server-side Bedrock key |
| `BEDROCK_MODEL_ID` | `google.gemma-3-4b-it` | Hosted fallback model |
| `BEDROCK_READ_TIMEOUT` | `4.0` | Fallback read timeout |

Never commit API keys. The deployed Bedrock key is stored as an encrypted AWS Systems Manager parameter and loaded into a root-only service environment file.

## 12. Testing and Verification

```bash
python3 -m pytest -q backend/tests
cd frontend && npm run build
```

Current verified result:

- backend: `16 passed`;
- frontend production build: passed;
- all four seeded swarm types detected;
- normal transaction allowed;
- Type D produces a block;
- idempotency verified;
- malformed/self/negative/unknown transactions rejected;
- ONNX safe and high-risk examples verified;
- mocked Gemma fallback verified.

## 13. Deployment

The AWS demo uses:

- one `t3.micro` EC2 instance in `ap-south-1`;
- an encrypted 8 GB gp3 volume;
- Nginx on ports 80 and 443;
- FastAPI bound to `127.0.0.1:8000`;
- Name.com DNS for `api.dhokha.bharathperni.dev`;
- a Let's Encrypt certificate with automatic renewal;
- Systems Manager for backend updates;
- SSM Parameter Store for the Bedrock key.

Deployment scripts are under `deploy/aws/`. After the Name.com `A` record points to the EC2 public IP, run:

```bash
./deploy/aws/configure-domain-tls.sh api.dhokha.bharathperni.dev
```

Use `destroy-ec2.sh` after the demo to remove API Gateway, EC2, S3 artifacts, the security group, SSM parameter, and deployment IAM resources. DNS records at Name.com must be removed separately.

## 14. Security and Privacy

- Synthetic data only.
- PAN/Aadhaar-like values are hashed.
- No authentication or authorization in the MVP.
- Demo reset and injection endpoints must not be exposed in production.
- Deployed CORS is broad for presentation convenience.
- SQLite is not suitable for multiple concurrent replicas.
- Bedrock credentials remain server-side.
- Logs and screenshots must not include API keys.

## 15. Current Limitations

- Dashboard, graph explorer, alerts, and swarm controls still contain mock-data paths; only the Transaction Scorer is fully connected to `/health` and `/v1/evaluate`.
- `/score` and `/v1/evaluate` use separate feature/model pipelines.
- `geo_jump` is currently fixed to zero.
- No authentication, rate limiting, audit identity, or bank authorization.
- No production-grade message queue or distributed background worker.
- Graph state is in one process and must be rebuilt from SQLite after restart.
- The custom DNS `A` record currently points to the instance public IP; stopping and starting the instance can change that IP unless an Elastic IP is attached.
- Public HTTPS latency can exceed 200 ms even when model inference is sub-millisecond.

## 16. Production Roadmap

1. Unify the ONNX classifier with `/score`.
2. Replace SQLite with PostgreSQL and require Redis.
3. Move graph processing to a durable queue/worker.
4. Add authentication, bank tenancy, authorization, and rate limits.
5. Add idempotency keys and audit records aligned with payment gateways.
6. Add model versioning, monitoring, drift checks, and calibrated thresholds.
7. Move WebSocket fan-out to a durable event service when horizontally scaling.
8. Connect all dashboard surfaces to the live APIs.
9. Add CI benchmarks, WebSocket end-to-end tests, and per-swarm model metrics.

## 17. Troubleshooting

### Frontend shows `MODEL OFFLINE` and `/api/v1/evaluate` returns 404

The hosted frontend must either:

- use the Vercel rewrite in `frontend/vercel.json`; or
- set `VITE_API_URL` to the deployed AWS API before building.

### Health reports `cache: memory`

Redis is not configured or unavailable. This is an expected fallback for the demo.

### Health reports `model_ready: false`

Check that `backend/ml/fraud_model.onnx` exists. If Bedrock is configured, `/v1/evaluate` will attempt the hosted fallback.

### `/score` returns 404

Use baseline accounts such as `ACC-000` through `ACC-039`, or call `/demo/reset`.

### Graph endpoint returns 404

The path requires an account ID, not a transaction ID.

## 18. Honest Judge Explanation

“Dhokha is a deterministic, synthetic hackathon MVP. The synchronous route makes a fast payment decision from behavioral and graph features. A background graph step confirms wider cross-bank swarm evidence without delaying the returned payment decision. ONNX gives us a portable low-latency classifier, deterministic rules guarantee the four demo scenarios, and hosted Gemma is a resilience fallback rather than the primary decision-maker.”
