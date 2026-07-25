from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SwarmType(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class ScoreRequest(BaseModel):
    transaction_id: str = Field(default_factory=lambda: str(uuid4()))
    sender_account_id: str
    receiver_account_id: str
    amount: float = Field(gt=0, le=10_000_000)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_fingerprint: str = Field(min_length=3, max_length=256)
    channel: str = Field(default="UPI", max_length=30)
    geo_lat: float | None = Field(default=None, ge=-90, le=90)
    geo_lon: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_transfer(self):
        if self.sender_account_id == self.receiver_account_id:
            raise ValueError("sender and receiver must differ")
        if (self.geo_lat is None) != (self.geo_lon is None):
            raise ValueError("geo_lat and geo_lon must be supplied together")
        return self


class ScoreResponse(BaseModel):
    transaction_id: str
    fraud_probability: float
    rule_score: float
    final_confidence: float
    decision: str
    suspected_swarm_types: list[str]
    top_reasons: list[str]
    latency_ms: float
    idempotent: bool = False


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_account_id: str
    receiver_account_id: str
    sender_bank_id: str | None = None
    receiver_bank_id: str | None = None
    amount: float
    timestamp: datetime
    channel: str
    device_fingerprint: str
    geo_lat: float | None
    geo_lon: float | None
    fraud_probability: float
    rule_score: float
    confidence: float
    decision: str
    triggered_rules: list[str]
    reasons: list[str]
    latency_ms: float


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    limit: int
    offset: int


class InjectSwarmRequest(BaseModel):
    swarm_type: SwarmType
    size: int = Field(default=5, ge=3, le=20)


class Event(BaseModel):
    event_type: str
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: dict
