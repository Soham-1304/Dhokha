from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture()
def client():
    with TestClient(app) as api:
        api.post("/demo/reset")
        yield api


def test_health_and_normal_payment(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["database"] == "ready"
    response = client.post("/score", json={
        "transaction_id": "normal-test-1",
        "sender_account_id": "ACC-000", "receiver_account_id": "ACC-001",
        "amount": 800, "timestamp": datetime.now(timezone.utc).isoformat(),
        "device_fingerprint": "normal-device-000", "channel": "UPI",
    })
    assert response.status_code == 200
    assert response.json()["decision"] == "allow"
    assert response.json()["latency_ms"] < 200


def test_transaction_history_is_persisted_paginated_and_filterable(client):
    baseline = client.get("/transactions").json()
    assert baseline["total"] == 12
    assert all(item["id"].startswith("TXN-SEED-") for item in baseline["items"])

    for index, amount in enumerate((500, 800)):
        response = client.post("/score", json={
            "transaction_id": f"history-test-{index}",
            "sender_account_id": f"ACC-00{index}",
            "receiver_account_id": f"ACC-00{index + 2}",
            "amount": amount,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "device_fingerprint": f"normal-device-00{index}",
            "channel": "UPI",
        })
        assert response.status_code == 200

    history = client.get("/transactions", params={"limit": 1, "offset": 0})
    assert history.status_code == 200
    body = history.json()
    assert body["total"] == baseline["total"] + 2
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert len(body["items"]) == 1
    assert body["items"][0]["amount"] in (500, 800)
    assert body["items"][0]["decision"] == "allow"
    assert body["items"][0]["sender_bank_id"]
    assert body["items"][0]["receiver_bank_id"]

    filtered = client.get("/transactions", params={"decision": "block"})
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 2
    assert all(item["decision"] == "block" for item in filtered.json()["items"])


def test_idempotency(client):
    payload = {
        "transaction_id": "same-id", "sender_account_id": "ACC-002",
        "receiver_account_id": "ACC-003", "amount": 500,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "device_fingerprint": "normal-device-002",
    }
    first = client.post("/score", json=payload)
    second = client.post("/score", json=payload)
    assert first.status_code == second.status_code == 200
    assert second.json()["idempotent"] is True
    assert first.json()["final_confidence"] == second.json()["final_confidence"]


@pytest.mark.parametrize("swarm_type", ["A", "B", "C", "D"])
def test_seeded_swarm_is_detected(client, swarm_type):
    response = client.post("/demo/inject-swarm", json={"swarm_type": swarm_type, "size": 5})
    assert response.status_code == 200, response.text
    decisions = response.json()["decisions"]
    assert any(swarm_type in item["suspected_swarm_types"] for item in decisions)
    alerts = client.get("/alerts", params={"swarm_type": swarm_type}).json()
    assert alerts
    assert alerts[0]["confidence"] >= 0.86


def test_device_cluster_reaches_block(client):
    response = client.post("/demo/inject-swarm", json={"swarm_type": "D", "size": 5})
    decisions = response.json()["decisions"]
    assert any(item["decision"] == "block" for item in decisions)
    flagged = next(item for item in decisions if "D" in item["suspected_swarm_types"])
    graph = client.get(f"/graph/subgraph/{flagged['transaction_id']}")
    # Transaction IDs are not graph nodes; the endpoint must return a clean 404.
    assert graph.status_code == 404


@pytest.mark.parametrize("payload", [
    {"sender_account_id": "ACC-000", "receiver_account_id": "ACC-000", "amount": 100, "device_fingerprint": "abc"},
    {"sender_account_id": "ACC-000", "receiver_account_id": "ACC-001", "amount": -1, "device_fingerprint": "abc"},
    {"sender_account_id": "UNKNOWN", "receiver_account_id": "ACC-001", "amount": 100, "device_fingerprint": "abc"},
])
def test_invalid_transactions(client, payload):
    assert client.post("/score", json=payload).status_code in (404, 422)
