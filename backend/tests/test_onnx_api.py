from fastapi.testclient import TestClient

from app.main import app


def _payload(**overrides):
    data = {
        "amount": 49_900,
        "oldbalanceOrg": 49_900,
        "newbalanceOrig": 0,
        "oldbalanceDest": 0,
        "newbalanceDest": 0,
        "dest_in_degree": 45,
        "dest_out_degree": 12,
        "dest_pagerank": 0.0024,
        "is_merchant": 0,
    }
    data.update(overrides)
    return data


def test_health_reports_onnx_ready():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["model_ready"] is True
        assert response.json()["model"] == "onnxruntime"


def test_high_risk_onnx_transaction_is_blocked():
    with TestClient(app) as client:
        response = client.post("/v1/evaluate", json=_payload())
        assert response.status_code == 200
        body = response.json()
        assert body["fraud_risk_score"] >= 75
        assert body["risk_tier"] == "HIGH"
        assert body["decision"] == "BLOCK"
        assert body["performance"]["sla_compliance"] is True
        assert body["reasons"]


def test_safe_onnx_transaction_is_allowed():
    with TestClient(app) as client:
        response = client.post("/v1/evaluate", json=_payload(
            amount=2_499,
            oldbalanceOrg=50_000,
            newbalanceOrig=47_501,
            oldbalanceDest=100_000,
            newbalanceDest=102_499,
            dest_in_degree=3,
            dest_out_degree=8,
            dest_pagerank=0.0001,
            is_merchant=1,
        ))
        assert response.status_code == 200
        body = response.json()
        assert body["fraud_risk_score"] < 30
        assert body["decision"] == "ALLOW"

