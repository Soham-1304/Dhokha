from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from app.cache import cache
from app.bedrock_model import bedrock_model
from app.database import Account, Alert, Transaction, init_db, session_scope
from app.events import event_hub
from app.graph import graph_engine
from app.model import fraud_model
from app.onnx_model import ModelPayload, ModelResponse, onnx_model
from app.config import settings
from app.schemas import (
    InjectSwarmRequest, ScoreRequest, ScoreResponse, TransactionListResponse,
    TransactionRead,
)
from app.scoring import score_transaction
from app.simulation import ensure_demo_data, generate_swarm, reset_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    ensure_demo_data()
    graph_engine.load()
    yield


app = FastAPI(
    title="Dhokha Fraud Swarm Detection API",
    version="0.1.0",
    description=(
        "Real-time multi-bank UPI fraud scoring and graph-based swarm detection. "
        "The current implementation uses deterministic synthetic data and supports "
        "identity fan-out, mule fan-in, layering rings, and shared-device clusters."
    ),
    openapi_tags=[
        {"name": "System", "description": "Service discovery and dependency readiness."},
        {"name": "Scoring", "description": "Synchronous transaction risk scoring and payment decisions."},
        {"name": "Demo data", "description": "Deterministic synthetic dataset and swarm scenario controls."},
        {"name": "Investigation", "description": "Confirmed alerts and visualization-ready graph neighborhoods."},
        {"name": "Streaming", "description": "Live transaction and swarm events for dashboard clients."},
    ],
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/", tags=["System"], summary="Discover the API",
    description="Returns the service name and links to interactive documentation and health status.",
)
def root():
    return {"service": "dhokha", "docs": "/docs", "health": "/health"}


@app.get(
    "/health", tags=["System"], summary="Check service readiness",
    description=(
        "Checks SQLite connectivity and reports the active cache backend, model backend, "
        "and current in-memory graph size. A degraded dependency is represented in the response body."
    ),
)
def health():
    database = "down"
    try:
        with session_scope() as db:
            db.execute(text("select 1"))
        database = "ready"
    except Exception:
        pass
    return {
        "status": "ready" if database == "ready" else "degraded",
        "api": "ready", "database": database, "cache": cache.backend,
        "model": "onnxruntime" if onnx_model.ready else fraud_model.backend,
        "model_ready": onnx_model.ready,
        "fallback_model": bedrock_model.model_id,
        "fallback_configured": bedrock_model.configured,
        "fallback_last_error": bedrock_model.last_error,
        "graph_nodes": graph_engine.graph.number_of_nodes(),
        "graph_edges": graph_engine.graph.number_of_edges(),
    }


@app.post(
    "/v1/evaluate",
    response_model=ModelResponse,
    tags=["Scoring"],
    summary="Run the ONNX Stage-1 fraud model",
    description=(
        "Runs the repository's trained PaySim ONNX classifier against balance and receiver-graph "
        "features. If ONNX is unavailable, it calls hosted Gemma 3 4B through Amazon Bedrock. "
        "Returns a 0-100 risk score, decision, explainability signals, and inference latency."
    ),
    responses={503: {"description": "Both ONNX and the hosted Gemma fallback are unavailable."}},
)
def evaluate_model(payload: ModelPayload):
    primary_error: Exception | None = None
    if onnx_model.ready:
        try:
            return onnx_model.evaluate(payload)
        except Exception as exc:
            primary_error = exc
    if bedrock_model.configured:
        try:
            return bedrock_model.evaluate(payload)
        except Exception as exc:
            fallback_error = exc
    else:
        fallback_error = RuntimeError(
            "Gemma API fallback is disabled or missing BEDROCK_API_KEY"
        )
    raise HTTPException(
        status_code=503,
        detail={
            "message": "Fraud inference is temporarily unavailable",
            "primary": str(primary_error or "ONNX model is unavailable"),
            "fallback": str(fallback_error),
        },
    )


@app.post(
    "/score", response_model=ScoreResponse, tags=["Scoring"],
    summary="Score a UPI transaction",
    description=(
        "Validates and persists a transaction, computes behavioral and graph features, combines "
        "model probability with deterministic swarm rules, and returns allow, review, or block. "
        "The graph confirmation task runs after the synchronous response. Reusing a transaction_id "
        "returns the original stored decision with idempotent=true."
    ),
    responses={404: {"description": "Sender or receiver account was not found."},
               422: {"description": "Payload validation, future timestamp, or transaction ordering error."}},
)
def score(payload: ScoreRequest, background_tasks: BackgroundTasks):
    return score_transaction(payload, background_tasks)


@app.get(
    "/transactions", response_model=TransactionListResponse, tags=["Investigation"],
    summary="List scored transactions",
    description=(
        "Returns transactions persisted by the scoring pipeline, newest first. "
        "The result supports pagination and optional allow, review, or block filtering."
    ),
    responses={422: {"description": "Invalid decision, limit, or offset."}},
)
def transactions(
    decision: str | None = Query(default=None, pattern="^(allow|review|block)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    with session_scope() as db:
        filters = [Transaction.decision == decision] if decision else []
        total = db.scalar(
            select(func.count()).select_from(Transaction).where(*filters)
        ) or 0
        transactions = list(db.scalars(
            select(Transaction)
            .where(*filters)
            .order_by(Transaction.timestamp.desc())
            .offset(offset)
            .limit(limit)
        ))
        account_ids = {
            account_id
            for transaction in transactions
            for account_id in (
                transaction.sender_account_id,
                transaction.receiver_account_id,
            )
        }
        banks = {
            account.id: account.bank_id
            for account in db.scalars(select(Account).where(Account.id.in_(account_ids)))
        }
        items = [{
            **TransactionRead.model_validate(transaction).model_dump(),
            "sender_bank_id": banks.get(transaction.sender_account_id),
            "receiver_bank_id": banks.get(transaction.receiver_account_id),
        } for transaction in transactions]
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }


@app.post(
    "/demo/reset", tags=["Demo data"], summary="Reset the synthetic dataset",
    description=(
        "Deletes current synthetic transactions, alerts, accounts, devices, and cache entries; "
        "then restores the deterministic 40-account baseline and reloads the graph."
    ),
)
def reset():
    cache.clear()
    summary = reset_demo_data()
    graph_engine.load()
    return {"status": "reset", **summary}


@app.post(
    "/demo/inject-swarm", tags=["Demo data"], summary="Generate and score a fraud swarm",
    description=(
        "Creates a repeatable Type A, B, C, or D synthetic scenario. Every generated transaction "
        "passes through the same scorer and graph processor used by POST /score."
    ),
    responses={422: {"description": "Unknown swarm type or size outside the supported 3–20 range."}},
)
async def inject_swarm(payload: InjectSwarmRequest):
    scenario_id, transactions = generate_swarm(payload.swarm_type, payload.size)
    results = []
    for transaction in transactions:
        result = score_transaction(transaction)
        results.append(result)
        await graph_engine.process(transaction.transaction_id, result.suspected_swarm_types, result.top_reasons)
    account_ids = sorted({
        account_id
        for transaction in transactions
        for account_id in (transaction.sender_account_id, transaction.receiver_account_id)
    })
    focal_account_id = account_ids[0] if account_ids else "ACC-001"
    subgraph_data = graph_engine.subgraph(focal_account_id, depth=2)
    return {
        "scenario_id": scenario_id,
        "swarm_type": payload.swarm_type.value,
        "focal_account_id": focal_account_id,
        "transactions_generated": len(results),
        "account_ids": account_ids,
        "subgraph": subgraph_data,
        "decisions": [result.model_dump(mode="json") for result in results],
    }


@app.get(
    "/graph/subgraph/{account_id}", tags=["Investigation"],
    summary="Get an account graph neighborhood",
    description=(
        "Returns account nodes and transaction edges within one to four hops of an account. "
        "The response is shaped for force-directed graph visualization."
    ),
    responses={404: {"description": "Account does not exist in the active graph."},
               422: {"description": "Depth is outside the supported 1–4 range."}},
)
def subgraph(account_id: str, depth: int = Query(default=2, ge=1, le=4)):
    result = graph_engine.subgraph(account_id, depth)
    if not result["nodes"]:
        raise HTTPException(404, "account not found in graph")
    return result


@app.get(
    "/alerts", tags=["Investigation"], summary="List swarm alerts",
    description=(
        "Returns newest alerts first. Results can be filtered by swarm type and status and limited "
        "to a maximum of 500 records."
    ),
    responses={422: {"description": "Invalid swarm type or limit."}},
)
def alerts(
    swarm_type: str | None = Query(default=None, pattern="^[A-D]$"),
    status: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
):
    with session_scope() as db:
        query = select(Alert)
        if swarm_type:
            query = query.where(Alert.swarm_type == swarm_type)
        if status:
            query = query.where(Alert.status == status)
        rows = db.scalars(query.order_by(Alert.created_at.desc()).limit(limit)).all()
        return [{
            "id": row.id, "swarm_type": row.swarm_type, "status": row.status,
            "confidence": row.confidence, "account_ids": row.account_ids,
            "bank_ids": row.bank_ids, "transaction_value": row.transaction_value,
            "evidence": row.evidence, "created_at": row.created_at.isoformat(),
        } for row in rows]


@app.websocket("/stream", name="Stream live scoring and swarm events")
async def stream(websocket: WebSocket):
    await event_hub.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_hub.disconnect(websocket)
