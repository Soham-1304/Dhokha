from fastapi.testclient import TestClient

from app.bedrock_model import BedrockFraudModel, bedrock_model
from app.main import app
from app.onnx_model import ModelPayload, onnx_model


def fake_bedrock_transport(**kwargs):
        assert kwargs["url"].endswith("/v1/chat/completions")
        assert kwargs["headers"]["Authorization"] == "Bearer test-api-key"
        assert kwargs["payload"]["model"] == "google.gemma-3-4b-it"
        assert kwargs["payload"]["temperature"] == 0
        assert kwargs["payload"]["max_tokens"] <= 160
        return {
            "choices": [{
                "message": {
                    "content": (
                        '{"fraud_risk_score":88,'
                        '"reasons":["receiver network concentration",'
                        '"destination balance mismatch"]}'
                    )
                },
            }]
        }


def _payload():
    return {
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


def test_bedrock_model_returns_validated_block_response():
    model = BedrockFraudModel(
        enabled=True,
        api_key="test-api-key",
        transport=fake_bedrock_transport,
    )
    response = model.evaluate(ModelPayload(**_payload()))
    assert response.fraud_risk_score == 88
    assert response.decision == "BLOCK"
    assert response.model_backend == "bedrock:google.gemma-3-4b-it"
    assert len(response.reasons) == 2


def test_api_uses_bedrock_when_onnx_is_unavailable(monkeypatch):
    monkeypatch.setattr(onnx_model, "session", None)
    monkeypatch.setattr(bedrock_model, "enabled", True)
    monkeypatch.setattr(bedrock_model, "api_key", "test-api-key")
    monkeypatch.setattr(bedrock_model, "_transport", fake_bedrock_transport)

    with TestClient(app) as client:
        response = client.post("/v1/evaluate", json=_payload())

    assert response.status_code == 200
    assert response.json()["model_backend"] == "bedrock:google.gemma-3-4b-it"
    assert response.json()["decision"] == "BLOCK"
