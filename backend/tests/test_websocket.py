from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app


def test_score_publishes_transaction_scored_event():
    with TestClient(app) as client:
        client.post("/demo/reset")
        with client.websocket_connect("/stream") as websocket:
            response = client.post("/score", json={
                "transaction_id": "websocket-normal-001",
                "sender_account_id": "ACC-000",
                "receiver_account_id": "ACC-001",
                "amount": 800,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "device_fingerprint": "websocket-test-device",
                "channel": "UPI",
            })
            event = websocket.receive_json()

    assert response.status_code == 200
    assert event["event_type"] == "transaction_scored"
    assert event["payload"]["transaction_id"] == "websocket-normal-001"
    assert event["payload"]["amount"] == 800
    assert event["payload"]["timestamp"]
    assert event["payload"]["fraud_probability"] >= 0
    assert event["payload"]["sender_bank_id"] in ("HDFC", "BANK_ALPHA")
    assert event["payload"]["receiver_bank_id"] in ("ICICI", "BANK_BETA")
    assert set(event) == {"event_type", "event_id", "timestamp", "payload"}
