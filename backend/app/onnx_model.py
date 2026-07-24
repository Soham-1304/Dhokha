"""PaySim-trained ONNX Stage-1 model and its public API contract."""

from pathlib import Path
from time import perf_counter

import numpy as np
import onnxruntime as ort
from pydantic import BaseModel, Field


class ModelPayload(BaseModel):
    amount: float = Field(gt=0, examples=[49_900.0])
    oldbalanceOrg: float = Field(ge=0, examples=[49_900.0])
    newbalanceOrig: float = Field(ge=0, examples=[0.0])
    oldbalanceDest: float = Field(ge=0, examples=[0.0])
    newbalanceDest: float = Field(ge=0, examples=[0.0])
    dest_in_degree: float = Field(ge=0, examples=[45.0])
    dest_out_degree: float = Field(ge=0, examples=[12.0])
    dest_pagerank: float = Field(ge=0, examples=[0.0024])
    is_merchant: int = Field(ge=0, le=1, examples=[0])


class ModelReason(BaseModel):
    type: str
    detail: str
    weight: float


class ModelPerformance(BaseModel):
    latency_ms: float
    sla_compliance: bool


class ModelResponse(BaseModel):
    status: str
    fraud_risk_score: float
    risk_tier: str
    decision: str
    confidence: float
    reasons: list[ModelReason]
    performance: ModelPerformance
    model_backend: str = "onnxruntime"


class OnnxFraudModel:
    def __init__(self):
        path = Path(__file__).resolve().parents[1] / "ml" / "fraud_model.onnx"
        self.path = path
        self.session: ort.InferenceSession | None = None
        self.input_name = ""
        self.output_names: list[str] = []
        self.error: str | None = None
        try:
            self.session = ort.InferenceSession(
                str(path),
                providers=["CPUExecutionProvider"],
            )
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
        except Exception as exc:
            self.error = str(exc)

    @property
    def ready(self) -> bool:
        return self.session is not None

    def evaluate(self, payload: ModelPayload) -> ModelResponse:
        if not self.session:
            raise RuntimeError("ONNX model is unavailable")

        started = perf_counter()
        error_balance_orig = payload.oldbalanceOrg - payload.amount - payload.newbalanceOrig
        error_balance_dest = payload.oldbalanceDest + payload.amount - payload.newbalanceDest
        features = np.asarray([[
            payload.amount,
            payload.oldbalanceOrg,
            payload.newbalanceOrig,
            payload.oldbalanceDest,
            payload.newbalanceDest,
            payload.dest_in_degree,
            payload.dest_out_degree,
            payload.dest_pagerank,
            payload.is_merchant,
            error_balance_orig,
            error_balance_dest,
        ]], dtype=np.float32)

        outputs = self.session.run(self.output_names, {self.input_name: features})
        probability_output = outputs[1] if len(outputs) > 1 else outputs[0]
        if isinstance(probability_output, list):
            probability = float(probability_output[0][1])
        elif getattr(probability_output, "ndim", 1) > 1:
            probability = float(probability_output[0][1])
        else:
            probability = float(probability_output[0])

        score = round(probability * 100, 2)
        if score < 30:
            tier, decision = "LOW", "ALLOW"
        elif score < 75:
            tier, decision = "MEDIUM", "REVIEW"
        else:
            tier, decision = "HIGH", "BLOCK"

        reasons = self._reasons(payload, error_balance_orig, error_balance_dest, score)
        latency = round((perf_counter() - started) * 1000, 2)
        return ModelResponse(
            status="success",
            fraud_risk_score=score,
            risk_tier=tier,
            decision=decision,
            confidence=round(max(probability, 1 - probability), 4),
            reasons=reasons,
            performance=ModelPerformance(
                latency_ms=latency,
                sla_compliance=latency < 200,
            ),
        )

    @staticmethod
    def _reasons(
        payload: ModelPayload,
        origin_error: float,
        destination_error: float,
        score: float,
    ) -> list[ModelReason]:
        signals: list[ModelReason] = []
        if abs(origin_error) > max(payload.amount * 0.1, 100):
            signals.append(ModelReason(
                type="ORIGIN_BALANCE_MISMATCH",
                detail="Sender balance movement is inconsistent with the transfer amount.",
                weight=0.34,
            ))
        if abs(destination_error) > max(payload.amount * 0.1, 100):
            signals.append(ModelReason(
                type="DESTINATION_BALANCE_MISMATCH",
                detail="Receiver balance did not reconcile with the incoming transfer.",
                weight=0.31,
            ))
        if payload.dest_in_degree >= 10:
            signals.append(ModelReason(
                type="RECEIVER_FAN_IN",
                detail=f"Receiver has {payload.dest_in_degree:.0f} historical incoming relationships.",
                weight=0.22,
            ))
        if payload.dest_out_degree >= 10:
            signals.append(ModelReason(
                type="RECEIVER_FAN_OUT",
                detail=f"Receiver rapidly redistributes funds across {payload.dest_out_degree:.0f} relationships.",
                weight=0.13,
            ))
        if not signals or score < 30:
            return [ModelReason(
                type="BASELINE_CONSISTENT",
                detail="Balances and receiver network profile remain within the learned safe baseline.",
                weight=1.0,
            )]
        return signals[:4]


onnx_model = OnnxFraudModel()
