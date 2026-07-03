# Multi-Bank UPI Fraud Swarm Detection — Design Doc

**Tagline for the pitch:** *"Banks each see one thread. We see the whole web."*

---

## 1. The Core Concept: "Swarm Typologies"

A **swarm** is a cluster of connected accounts/identities/devices that together form a fraud pattern no single bank can see alone, because each bank only has visibility into its own accounts. We define **4 swarm types**. Your "Pick a Swarm" UI selector maps 1:1 to these — each one needs its own graph signature, its own features, and its own synthetic generator for the demo.

### Type A — Identity Fan-Out (1 PAN/Aadhaar → N accounts → N banks)
One real identity (stolen or complicit) opens/controls accounts across multiple banks, then fires near-simultaneous transactions from all of them — e.g. spreading a large withdrawal across 5 banks to stay under any single bank's alert threshold.
- **Graph signature:** one identity-node with edges fanning out to account-nodes in ≥2 distinct bank-clusters, all activating in a tight time window.
- **Real-world driver:** structuring / threshold evasion.

### Type B — Mule Fan-In (N people → 1 account)
Many unrelated victims send money into a single collector account, usually within one bank, in a short burst — the classic "mule account" pattern.
- **Graph signature:** one account-node with high in-degree, low historical volume suddenly spiking, senders have no prior relationship to each other or the account.
- **Real-world driver:** scam victims paying into a common collection point (investment scams, fake e-commerce, etc.)

### Type C — Layering Chain / Ring
Money hops sequentially through several accounts (often crossing banks) to obscure origin before final cash-out — victim → mule1 (Bank A) → mule2 (Bank B) → mule3 (Bank C) → cash-out. Sometimes the chain loops back (circular transaction), which is an even stronger fraud signal than a straight chain.
- **Graph signature:** a path (or cycle) of edges, each hop happening quickly after the last, amounts decaying slightly each hop (commission taken), crossing bank boundaries.
- **Real-world driver:** classic layering stage of money laundering.

### Type D — Device/IP Cluster (your differentiator)
Several accounts that look unrelated on paper (different PAN, different bank, different name) are actually all being operated from the same device fingerprint or IP block. This is the pattern **no single bank can ever catch**, because each bank only sees its own customer using "their own" device — cross-bank correlation is the only way to expose it.
- **Graph signature:** one device-node with edges to multiple account-nodes across different identities/banks.
- **Real-world driver:** fraud rings running many mule accounts from one control point (fraud call centers, device farms).

> **Pitch note:** Type D is the one to lead with live on stage — it's the clearest "we caught something no single bank could" moment.

---

## 2. Identity Graph — Data Model

Think of the graph as having 4 node types and typed edges between them:

```
Node types:
- Identity   (PAN/Aadhaar hash, KYC risk flags)
- Account    (account_id, bank_id, opened_date, avg_balance)
- Device     (device_fingerprint, IP block, first_seen)
- Transaction (as edges, not nodes — see below)

Edge types:
- Identity --owns--> Account
- Account --transacts--> Account   (weighted: amount, timestamp, channel)
- Account --used_from--> Device
- Account --located_in--> Geo (optional, for geo-jump detection)
```

Keep transactions as **edges with a timestamp + amount**, not as their own nodes — this keeps graph traversal cheap, which matters for the 200ms budget.

### Minimal schema (for your synthetic DB / demo backend)

```sql
identities(id, pan_hash, aadhaar_hash, risk_flags, created_at)
accounts(id, identity_id, bank_id, opened_at, avg_monthly_txn_count, avg_txn_amount)
devices(id, fingerprint, ip_block, first_seen_at)
account_devices(account_id, device_id, last_used_at, use_count)
transactions(id, sender_account_id, receiver_account_id, amount, timestamp, channel, geo_lat, geo_lon)
```

---

## 3. Feature Engineering

Split cleanly into **fast-path features** (computed at scoring time, <50ms) and **graph-path features** (precomputed/incrementally cached, read at scoring time in O(1)).

### 3.1 Fast-path (per-transaction, behavioral/device)
| Feature | Why |
|---|---|
| Amount z-score vs sender's own 90-day history | Catches out-of-character amounts |
| Txn count in last 60s / 5min / 1hr vs baseline | Velocity spikes = bot/script behavior |
| Time-since-last-txn | Very short gaps = automated draining |
| New device flag (first-ever use on this account) | High-risk combo: new device + large amount |
| Device reuse count across *other* accounts (cache lookup) | Cheap version of Type D signal |
| Time-of-day deviation from user's typical pattern | 3am transfer from a 9-5 user |
| Geo-jump feasibility (distance/time since last txn location) | Physically impossible travel = compromised session |
| Receiver account age (new account receiving large sum) | Mule accounts are often freshly opened |

### 3.2 Graph-path (precomputed, refreshed incrementally as edges arrive)
| Feature | Swarm type it targets |
|---|---|
| Fan-in ratio (unique senders / time window) | Type B |
| Fan-out ratio across distinct bank_ids for one identity | Type A |
| Shortest-path / chain depth from a known "dirty" seed account | Type C |
| Cycle detection flag (does this txn close a loop?) | Type C |
| Device-to-account cardinality (how many distinct accounts share this device, across how many banks) | Type D |
| PageRank / betweenness centrality delta (sudden spike vs 30-day baseline) | All — generic "this node suddenly became important" |

**Key engineering trick to hit 200ms:** never run PageRank/centrality live. Maintain it as a background job (every few seconds, or event-triggered on the affected subgraph only) and store current values in Redis. At scoring time you're just doing cache reads + a couple of O(degree) local checks (fan-in/out count, device cardinality) — not a live graph algorithm.

---

## 4. Model Architecture — Two-Stage

**Stage 1 — Fast classifier (runs on every transaction, <100ms budget)**
- LightGBM or XGBoost, trained on fast-path + cached graph-path features (the graph features come in as regular numeric columns, the model doesn't need to know they came from a graph)
- Outputs: `fraud_probability` (0–1) + SHAP values for explainability
- This alone should catch Types A, B, most of C

**Stage 2 — Graph propagation / ring confirmation (async, updates within seconds not ms)**
- When Stage 1 flags a node above a threshold, propagate a "risk score" outward along edges (simple label-propagation or personalized PageRank from the flagged node)
- This is what lets you say "this transaction is part of a larger ring" rather than just "this transaction looks weird" — upgrades an isolated flag into a **swarm alert**
- Runs on the graph engine (NetworkX in-memory is fine for hackathon scale — don't reach for Neo4j unless you have days to spare)

**Why two stages:** Stage 1 gives you the sub-200ms real-time response the brief demands. Stage 2 gives you the "wow" — the dashboard animation where a single flagged transaction lights up an entire ring a few seconds later.

### Confidence score composition
Show it as a blend, not a black box:
```
final_confidence = 0.6 * stage1_probability + 0.4 * graph_risk_propagation_score
```
Display both components separately in the explainability panel — judges love seeing the breakdown, not just one number.

---

## 5. Backend Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  UPI Payment │─────▶│  FastAPI Scoring  │─────▶│  Redis (cache:   │
│  App (mock)  │      │  Endpoint          │      │  velocity, graph │
└─────────────┘      │  (Stage 1 model)   │      │  risk scores)     │
                      └────────┬──────────┘      └─────────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ Transaction Queue │  (in-memory queue / Redis
                      │  → Graph Worker   │   pub-sub is enough for demo)
                      └────────┬──────────┘
                               │
                               ▼
                      ┌──────────────────┐      ┌─────────────────┐
                      │  Graph Engine     │─────▶│  WebSocket push  │
                      │  (NetworkX,       │      │  → Admin          │
                      │  Stage 2 risk     │      │  Dashboard         │
                      │  propagation)     │      └─────────────────┘
                      └──────────────────┘
```

**Endpoints:**
- `POST /score` — takes a transaction, returns `{fraud_probability, confidence, explainability, latency_ms}` — target <200ms
- `GET /graph/subgraph/{account_id}` — returns the local neighborhood for visualization
- `WS /stream` — pushes flagged transactions + swarm updates live to the dashboard
- `POST /demo/inject_swarm` — triggers one of your 4 scripted swarm scenarios for the live demo (this is your "on-cue" button)

**Latency budget breakdown (200ms total):**
- Feature fetch (Redis reads, cached aggregates): ~20ms
- Model inference (LightGBM): ~5-15ms
- Response serialization + network: ~20ms
- Buffer: rest — leaves generous headroom, which is good because judges will ask "what if it's under load"

---

## 6. Frontend Architecture

### 6.1 Consumer app (deliberately boring)
Standard UPI payment/netbanking flow — enter amount, select payee, confirm, pay. This exists purely to generate realistic-looking transaction events feeding your engine, and as a visual contrast to the dashboard. Don't over-invest design time here.

### 6.2 Admin/Bureau Dashboard (this is what wins the room)

**"Pick a Swarm" selector** — 4 buttons/cards, one per type above. Each triggers `POST /demo/inject_swarm` with a scripted scenario:
- Type A: Identity Fan-Out
- Type B: Mule Fan-In
- Type C: Layering Chain/Ring
- Type D: Device Cluster

**Main view — live force-directed graph** (react-force-graph or D3 force layout):
- Nodes = accounts, colored by bank (bank A blue, bank B green, etc.)
- Node size = current risk score
- Edges animate as pulses when a transaction fires
- When Stage 1 flags a node → it flashes amber
- When Stage 2 propagation confirms a swarm → the whole connected ring turns red, with a bounding highlight around the cluster and a toast: *"Swarm detected: Layering Ring, 4 hops, 3 banks, confidence 94%"*

**Side panel — Explainability card**, updates on node click:
- Bar chart of top contributing features (from SHAP) — e.g. "New device (+0.31), Fan-in spike (+0.24), Off-hours (+0.11)"
- Stage 1 vs Stage 2 confidence breakdown
- "Related accounts in this swarm" mini-list with bank tags

**Top strip — live counters:** transactions/sec processed, swarms currently active, total value protected today (ticking up) — cheap but effective for "wow."

### 6.3 Suggested stack
- React + your force-graph lib of choice, Tailwind for styling
- WebSocket client for live updates
- Keep the whole dashboard on one screen — no page navigation during the live demo, judges shouldn't watch you click through tabs

---

## 7. Synthetic Training/Demo Data Generator

Be upfront with judges: **"trained on synthetic data modeled on RBI/NPCI published mule-account typologies"** — say this proactively, don't wait to be asked.

Generator needs two layers:
1. **Background noise** — thousands of normal-looking transactions between random accounts, realistic amount distributions, normal time-of-day patterns
2. **Injected rings** — for each swarm type, a generator function that plants a scripted pattern into the graph at a controllable moment (this is also literally your demo trigger — same generator, reused for both training data and live demo injection, which is a nice thing to mention to judges as "we validate on the same synthetic ring logic we train on")

```python
def inject_type_d_device_cluster(n_accounts=5, n_banks=3, device_fp="demo_device_01"):
    # create n_accounts across n_banks, all tagged with same device fingerprint
    # fire near-simultaneous small transactions from each into one cash-out account
    ...
```

Train Stage 1 on a labeled dataset built from many runs of these generators (label=1 for ring-injected transactions, label=0 for background), with realistic class imbalance (fraud is rare — don't balance 50/50, that'll hurt real-world credibility if asked).

---

## 8. Demo Script (for judge day)

1. Open on the boring consumer app, make one normal payment — "this is what every transaction looks like on the surface."
2. Cut to dashboard, still calm.
3. Hit **Pick a Swarm → Device Cluster**. Narrate live: "Watch — 5 accounts, 3 different banks, no shared identity on paper..." as pulses fire.
4. Point out the amber flash on first flag (~150ms, show the latency number on screen).
5. A few seconds later, Stage 2 fires — the whole ring turns red, toast appears. "None of these 3 banks could have caught this alone. We just did, because we see across all of them."
6. Click the flagged node → show explainability panel.
7. Close with the counters strip: "X transactions scored, Y swarms caught, all under 200ms per transaction."

---

## 9. What to explicitly acknowledge if asked (be ready, don't dodge)

- **Data is synthetic** — real UPI/bank data isn't accessible to you, and that's expected/normal for a hackathon.
- **Cross-bank data sharing is the real-world blocker**, not the tech — mention this. The tech is the easy part; getting banks to actually share data via something like a consortium/NPCI-mediated layer is the real deployment challenge. Naming this shows maturity, not weakness.
- **Privacy** — PAN/Aadhaar should be hashed, never raw, even in the demo. Mention this proactively.