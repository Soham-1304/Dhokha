"""Hosted Gemma fallback through Bedrock's OpenAI-compatible API."""

import json
from time import perf_counter
from typing import Any, Callable
from urllib import request

from pydantic import BaseModel, Field

from app.config import settings
from app.onnx_model import ModelPayload, ModelPerformance, ModelReason, ModelResponse


class _BedrockAssessment(BaseModel):
    fraud_risk_score: float = Field(ge=0, le=100)
    reasons: list[str] = Field(min_length=1, max_length=3)


class BedrockFraudModel:
    def __init__(
        self,
        *,
        enabled: bool | None = None,
        api_key: str | None = None,
        transport: Callable[..., dict[str, Any]] | None = None,
    ):
        self.enabled = settings.bedrock_enabled if enabled is None else enabled
        self.api_key = settings.bedrock_api_key if api_key is None else api_key
        self.base_url = settings.bedrock_base_url
        self.model_id = settings.bedrock_model_id
        self.region = settings.bedrock_region
        self.backend = f"bedrock:{self.model_id}"
        self._transport = transport or self._post_json
        self.last_error: str | None = None

    @property
    def configured(self) -> bool:
        return self.enabled and bool(self.api_key)

    def evaluate(self, payload: ModelPayload) -> ModelResponse:
        if not self.configured:
            raise RuntimeError("Gemma API fallback is disabled or missing BEDROCK_API_KEY")

        started = perf_counter()
        prompt = self._prompt(payload)
        try:
            response = self._transport(
                url=f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                payload={
                    "model": self.model_id,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a conservative payment-fraud classifier. "
                                "Use only the numeric features supplied. Return strict JSON only."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": settings.bedrock_max_tokens,
                    "temperature": 0,
                    "top_p": 0.1,
                },
                timeout=(
                    settings.bedrock_connect_timeout
                    + settings.bedrock_read_timeout
                ),
            )
            text = response["choices"][0]["message"]["content"]
            assessment = _BedrockAssessment.model_validate(
                self._parse_json_object(text)
            )
            self.last_error = None
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"
            raise

        score = round(assessment.fraud_risk_score, 2)
        if score < 30:
            tier, decision = "LOW", "ALLOW"
        elif score < 75:
            tier, decision = "MEDIUM", "REVIEW"
        else:
            tier, decision = "HIGH", "BLOCK"

        probability = score / 100
        latency = round((perf_counter() - started) * 1000, 2)
        return ModelResponse(
            status="success",
            fraud_risk_score=score,
            risk_tier=tier,
            decision=decision,
            confidence=round(max(probability, 1 - probability), 4),
            reasons=[
                ModelReason(
                    type=f"GEMMA_SIGNAL_{index}",
                    detail=reason,
                    weight=round(1 / len(assessment.reasons), 2),
                )
                for index, reason in enumerate(assessment.reasons, start=1)
            ],
            performance=ModelPerformance(
                latency_ms=latency,
                sla_compliance=latency < 200,
            ),
            model_backend=self.backend,
        )

    @staticmethod
    def _prompt(payload: ModelPayload) -> str:
        features = payload.model_dump()
        return (
            "Assess this synthetic UPI transaction for fraud. "
            "Return exactly one JSON object with this schema: "
            '{"fraud_risk_score": number from 0 to 100, '
            '"reasons": ["short evidence-based reason", "up to three reasons"]}. '
            "Do not include markdown or a decision label. Features: "
            f"{json.dumps(features, separators=(',', ':'))}"
        )

    @staticmethod
    def _post_json(
        *,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        timeout: float,
    ) -> dict[str, Any]:
        api_request = request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers=headers,
            method="POST",
        )
        with request.urlopen(api_request, timeout=timeout) as response:
            return json.loads(response.read())

    @staticmethod
    def _parse_json_object(text: str) -> dict:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Bedrock response did not contain a JSON object")
        return json.loads(text[start:end + 1])


bedrock_model = BedrockFraudModel()
