# DHOKHA Backend Architecture & Technical Deep-Dive Study Guide

This document is a comprehensive technical guide for the **DHOKHA** (Real-Time Financial Fraud Swarm Intelligence & Risk Scoring Engine) backend. It details **what technologies are used**, **how they are implemented in the codebase**, and **why they were selected**.

---

## Table of Contents
1. [Executive Summary & Core Concept](#1-executive-summary--core-concept)
2. [Technology Stack Matrix](#2-technology-stack-matrix)
3. [Deep-Dive 1: FastAPI & Async Web Server](#3-deep-dive-1-fastapi--async-web-server)
4. [Deep-Dive 2: Machine Learning Inference (ONNX & LightGBM)](#4-deep-dive-2-machine-learning-inference-onnx--lightgbm)
5. [Deep-Dive 3: Dynamic Graph Engine (NetworkX)](#5-deep-dive-3-dynamic-graph-engine-networkx)
6. [Deep-Dive 4: Relational Persistence & Schema (SQLite & SQLAlchemy)](#6-deep-dive-4-relational-persistence--schema-sqlite--sqlalchemy)
7. [Deep-Dive 5: In-Memory Sliding-Window Caching](#7-deep-dive-5-in-memory-sliding-window-caching)
8. [Deep-Dive 6: The 4 Swarm Attack Typologies](#8-deep-dive-6-the-4-swarm-attack-typologies)
9. [Deep-Dive 7: Scoring Pipeline & Decision Math](#9-deep-dive-7-scoring-pipeline--decision-math)
10. [API Catalog & Endpoint Reference](#10-api-catalog--endpoint-reference)

---

## 1. Executive Summary & Core Concept

### The Problem
Traditional payment fraud detection systems evaluate transactions individually in isolation ($A \rightarrow B$). They miss coordinated, multi-account attack rings spanning multiple banks—such as phishing mule collector rings, identity fan-outs, and rapid layering chains.

### The Solution
**DHOKHA** is a hybrid intelligence engine combining **LightGBM Machine Learning** (for individual transaction anomaly detection) with an **in-memory NetworkX directed graph engine** (for real-time multi-account topology detection). It evaluates payments in **$<20\text{ms}$ latency**, fulfilling strict UPI payment SLA requirements.

---

## 2. Technology Stack Matrix

| Technology | Role | Code Location | Key Feature |
| :--- | :--- | :--- | :--- |
| **Python 3.11+** | Primary Language | Entire `/backend` | Async I/O, type annotations, high performance |
| **FastAPI** | REST API & WebSockets | `app/main.py` | Asynchronous routes, automatic OpenAPI OpenAPI docs, Pydantic validation |
| **Uvicorn** | ASGI Web Server | Server execution | High-concurrency event loop |
| **ONNX Runtime** | ML Inference | `app/onnx_model.py` | Sub-5ms binary model evaluation (`ml/fraud_model.onnx`) |
| **NetworkX** | Dynamic Graph Engine | `app/graph.py` | In-memory directed graph (`DiGraph`) tracking multi-hop cycles & fan-in |
| **SQLAlchemy 2.0** | Database ORM | `app/database.py` | Async-compatible ORM mapping database tables |
| **SQLite** | Relational DB | Data persistence | Embedded zero-latency relational store |
| **Sliding Window Cache** | Velocity Cache | `app/cache.py` | Deque-based timestamp sliding window for 60s / 300s transaction counts |

---

## 3. Deep-Dive 1: FastAPI & Async Web Server

### What it is
FastAPI is a modern, high-performance web framework for building APIs with Python based on standard Python type hints and Starlette/Pydantic.

### How it is implemented in our codebase
- **Entry Point (`backend/app/main.py`)**:
  - Initializes the FastAPI app instance: `app = FastAPI(title="DHOKHA Fraud Engine")`.
  - Configures CORS middleware so frontend clients (Vite / React) can communicate seamlessly.
  - Exposes REST endpoints (`POST /score`, `POST /demo/inject-swarm`, `GET /transactions`, `GET /alerts`, `GET /graph/subgraph/{account_id}`).
  - Exposes WebSocket route (`WS /stream`) via `WebSocketManager` to broadcast events to connected dashboards in real time.

### Why we chose it
1. **Asynchronous Non-Blocking I/O**: High throughput for concurrent scoring requests.
2. **Built-in WebSockets Support**: Native event streaming without external message brokers (like RabbitMQ) needed for local dev.
3. **Pydantic Validation**: Automatic schema validation for incoming JSON payloads (`ScoreRequest`).

---

## 4. Deep-Dive 2: Machine Learning Inference (ONNX & LightGBM)

### What it is
**ONNX (Open Neural Network Exchange)** is an open format for representing machine learning models. We train a **LightGBM** binary classification model on financial transaction datasets and export it into a single `.onnx` binary graph (`ml/fraud_model.onnx`).

### How it is implemented in our codebase
- **Model Wrapper (`backend/app/onnx_model.py`)**:
  - `OnnxFraudModel.__init__()`: Loads `ml/fraud_model.onnx` into an `ort.InferenceSession(providers=["CPUExecutionProvider"])`.
  - `evaluate(payload: ModelPayload)`: Constructs an 8-dimensional `numpy.ndarray` float32 matrix and executes `session.run()`.
- **Feature Vector Evaluated**:
  1. `amount`: Transaction value in ₹.
  2. `amount_zscore`: Deviation multiple of amount relative to sender's average baseline.
  3. `oldbalanceOrg` / `newbalanceOrig`: Sender wallet balance before/after.
  4. `oldbalanceDest` / `newbalanceDest`: Recipient wallet balance before/after.
  5. `dest_in_degree`: Number of unique senders targeting recipient.
  6. `dest_out_degree`: Rapid outbound forwarding count from recipient.
  7. `dest_pagerank`: PageRank centrality score of recipient.
  8. `is_merchant`: Peer vs Merchant flag.

### Why we chose it
1. **Sub-5ms Execution**: `onnxruntime` runs compiled C++ binaries, executing model predictions in **$<5\text{ms}$**.
2. **Zero ML Framework Dependency in Production**: Does not require loading PyTorch or LightGBM heavy frameworks at runtime.

---

## 5. Deep-Dive 3: Dynamic Graph Engine (NetworkX)

### What it is
**NetworkX** is a Python library for creation, manipulation, and study of complex network structures.

### How it is implemented in our codebase
- **Graph Engine Wrapper (`backend/app/graph.py`)**:
  - Maintains an in-memory `nx.DiGraph()` (Directed Graph).
  - Every account (User, Mule, Merchant) is a **Node**.
  - Every transaction is a directed **Edge** ($S \rightarrow R$) tagged with amount and timestamp.
- **Topological Methods**:
  - `chain_depth(account_id)`: Calculates the longest topological directed path leading into a node.
  - `would_close_cycle(sender_id, receiver_id)`: Checks if adding edge $S \rightarrow R$ creates a directed loop back to $S$ ($S \rightarrow R \rightarrow \dots \rightarrow S$).
  - `subgraph(account_id, depth=2)`: Extracts the 2-hop graph neighborhood for D3 frontend visualization.

### Why we chose it
1. **Detects Coordinated Swarms**: Single-row ML models cannot detect money looping back or multi-hop forwarding chains.
2. **In-Memory Speed**: Direct memory access yields sub-millisecond graph traversals.

---

## 6. Deep-Dive 4: Relational Persistence & Schema (SQLite & SQLAlchemy)

### What it is
SQLAlchemy 2.0 ORM over SQLite embedded relational database.

### How it is implemented in our codebase
- **Schema Models (`backend/app/database.py`)**:
  - `Identity`: Represents citizen identity (`pan_hash`, `aadhaar_hash`, `created_at`).
  - `Account`: Bank account entity (`id`, `identity_id`, `bank_id`, `opened_at`, `avg_monthly_txn_count`, `avg_txn_amount`).
  - `Device`: Hardware device (`id`, `fingerprint`, `ip_block`).
  - `AccountDevice`: Junction table linking accounts to physical devices (`last_used_at`, `use_count`).
  - `Transaction`: Persisted payment audit log (`fraud_probability`, `rule_score`, `confidence`, `decision`, `reasons`, `latency_ms`).
  - `Alert`: Confirmed fraud swarm alerts.
- **Session Scope (`session_scope()`)**: Context manager handling transactional commit, rollback, and session cleanup.

### Why we chose it
1. **Data Integrity**: Enforces foreign key constraints and audit history.
2. **Auto-Provisioning**: If an unregistered account ID (`ACC-040+`) sends or receives a payment, `scoring.py` auto-provisions `Account` and `Identity` rows on the fly.

---

## 7. Deep-Dive 5: In-Memory Sliding-Window Caching

### What it is
A custom sliding-window timestamp tracker (`backend/app/cache.py`).

### How it is implemented in our codebase
- `cache.window_add_and_count(key, timestamp, window_seconds)`:
  - Maintains a `collections.deque` of epoch timestamps for each key.
  - Automatically pops timestamps older than `now - window_seconds`.
  - Appends current timestamp and returns the current count of active events.
  - Used for tracking **60-second velocity** (`velocity_60s`) and **5-minute velocity** (`velocity_5m`).

### Why we chose it
1. **Constant Time Overhead ($O(1)$ amortized)**: Fast computation of recent transaction bursts without querying DB `COUNT(*)` continuously.

---

## 8. Deep-Dive 6: The 4 Swarm Attack Typologies

### Type A — Identity Fan-Out (Multi-Bank Identity Manipulation)
- **Concept**: A single fraudster uses one identity (PAN/Aadhaar) to control multiple accounts across 3+ banks and fires test transactions simultaneously.
- **Rule Condition**: `identity_bank_count >= 2` AND `velocity_5m >= 1`.

### Type B — Mule Collector Fan-In (Mule Wallet Funneling)
- **Concept**: Multiple victim accounts rapidly funnel funds into a single mule collector wallet (`ACC-000`).
- **Rule Condition**: `fan_in >= 4` senders in 5 minutes OR recipient is target `ACC-000` / `MULE`.

### Type C — Layering Chain or Money Cycle (Origin Obfuscation)
- **Concept**: Rapid multi-hop transfers through intermediary accounts ($A \rightarrow B \rightarrow C \rightarrow D$) or closing a money loop ($A \rightarrow B \rightarrow C \rightarrow A$).
- **Rule Condition**: `chain_depth >= 3` OR `closes_cycle == True`.

### Type D — Shared Device Cluster & Structuring (Botnet / Emulator)
- **Concept**: Single hardware device fingerprint shared across $\ge 3$ accounts and $\ge 2$ banks, OR structuring amounts right below compliance limits (`₹9,999` or `₹49,900`).
- **Rule Condition**: `device_account_count >= 3` & `device_bank_count >= 2` OR amount in $[9,900 \dots 9,999]$ / $[49,000 \dots 49,999]$.

---

## 9. Deep-Dive 7: Scoring Pipeline & Decision Math

When `POST /score` receives a transaction payload:

```
                          [ Incoming UPI Transaction ]
                                       │
      ┌────────────────────────────────┴────────────────────────────────┐
      ▼                                                                 ▼
[ Stage 1: Feature Extraction ]                            [ Stage 2: Database Lookups ]
- Calculate amount_zscore                                  - Fetch sender & receiver accounts
- Query 60s & 5m sliding cache                             - Check device account & bank counts
- Calculate NetworkX graph metrics                         - Auto-provision new accounts if missing
      │                                                                 │
      └────────────────────────────────┬────────────────────────────────┘
                                       ▼
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
        [ Stage 3: ONNX Inference ]             [ Stage 4: Swarm Rule Engine ]
        Evaluates 8 ML Features                  Evaluates Typologies A, B, C, D
        Returns Probability P_ML                 Returns Rule Score S_Rule
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       ▼
                         [ Combined Risk Score Gauge ]
     Confidence = min(0.99, max(P_ML, S_Rule, 0.55 * P_ML + 0.45 * S_Rule))
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
   [ >= 80%: BLOCK ]            [ 35%-79%: REVIEW ]           [ < 35%: ALLOW ]
```

### Combined Confidence Formula
$$\text{Confidence} = \min\Big(0.99, \max\big(P_{\text{ML}}, S_{\text{Rule}}, 0.55 \cdot P_{\text{ML}} + 0.45 \cdot S_{\text{Rule}}\big)\Big)$$

- **$\ge 80\%$ Confidence** $\rightarrow$ **`BLOCK`** (Automated decline, entity flagged in graph)
- **$35\% - 79\%$ Confidence** $\rightarrow$ **`REVIEW`** (Queued for analyst review)
- **$< 35\%$ Confidence** $\rightarrow$ **`ALLOW`** (Instant clearance)

---

## 10. API Catalog & Endpoint Reference

### `POST /score`
Scores an incoming transaction.
- **Request Body**:
  ```json
  {
    "transaction_id": "TXN-109283",
    "sender_account_id": "ACC-005",
    "receiver_account_id": "ACC-000",
    "amount": 49900.0,
    "device_fingerprint": "normal-device-005",
    "channel": "UPI"
  }
  ```
- **Response Body**:
  ```json
  {
    "transaction_id": "TXN-109283",
    "fraud_probability": 0.362,
    "rule_score": 0.92,
    "final_confidence": 0.92,
    "decision": "block",
    "suspected_swarm_types": ["B", "D"],
    "top_reasons": [
      "Target recipient 'ACC-000' is a flagged mule collector hub",
      "Amount ₹49,900 is structured below reporting thresholds (Threshold Dodge)"
    ],
    "latency_ms": 5.05,
    "idempotent": false
  }
  ```

### `POST /demo/inject-swarm`
Injects synthetic swarm attacks for demonstration.
- **Request Body**: `{"swarm_type": "B", "count": 5}`

### `GET /graph/subgraph/{account_id}?depth=2`
Returns graph nodes and edges centered around `{account_id}`.

### `WS /stream`
WebSocket connection broadcasting live stream events (`transaction_scored`, `swarm_confirmed`).
