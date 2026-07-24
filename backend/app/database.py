from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from sqlalchemy import (
    JSON, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import settings


if settings.database_url.startswith("sqlite"):
    db_path = settings.database_url.removeprefix("sqlite:///")
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Identity(Base):
    __tablename__ = "identities"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    pan_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    aadhaar_hash: Mapped[str] = mapped_column(String, unique=True, index=True)
    risk_flags: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    identity_id: Mapped[str] = mapped_column(ForeignKey("identities.id"), index=True)
    bank_id: Mapped[str] = mapped_column(String, index=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime)
    avg_monthly_txn_count: Mapped[float] = mapped_column(Float, default=10)
    avg_txn_amount: Mapped[float] = mapped_column(Float, default=1000)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_block: Mapped[str] = mapped_column(String)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime)


class AccountDevice(Base):
    __tablename__ = "account_devices"
    __table_args__ = (UniqueConstraint("account_id", "device_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), index=True)
    last_used_at: Mapped[datetime] = mapped_column(DateTime)
    use_count: Mapped[int] = mapped_column(Integer, default=1)


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sender_account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    receiver_account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    channel: Mapped[str] = mapped_column(String, default="UPI")
    device_fingerprint: Mapped[str] = mapped_column(String)
    geo_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    fraud_probability: Mapped[float] = mapped_column(Float)
    rule_score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String)
    triggered_rules: Mapped[list] = mapped_column(JSON, default=list)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    latency_ms: Mapped[float] = mapped_column(Float)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    swarm_type: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="confirmed", index=True)
    confidence: Mapped[float] = mapped_column(Float)
    account_ids: Mapped[list] = mapped_column(JSON)
    bank_ids: Mapped[list] = mapped_column(JSON)
    transaction_value: Mapped[float] = mapped_column(Float, default=0)
    evidence: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


def init_db() -> None:
    Base.metadata.create_all(engine)


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
