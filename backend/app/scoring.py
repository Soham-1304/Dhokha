import math
from datetime import datetime, timedelta, timezone
from time import perf_counter

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import distinct, func, select

from app.cache import cache
from app.config import settings
from app.database import Account, AccountDevice, Device, Transaction, session_scope
from app.graph import graph_engine
from app.model import fraud_model
from app.schemas import ScoreRequest, ScoreResponse


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _decision(confidence: float) -> str:
    if confidence >= settings.block_threshold:
        return "block"
    if confidence >= settings.allow_threshold:
        return "review"
    return "allow"


def _reason_labels(features: dict[str, float]) -> list[str]:
    labels = []
    candidates = [
        (features["device_account_count"] >= 3, f"Device shared by {int(features['device_account_count'])} accounts"),
        (features["device_bank_count"] >= 2, f"Device used across {int(features['device_bank_count'])} banks"),
        (features["fan_in"] >= 4, f"Receiver has {int(features['fan_in'])} unique recent senders"),
        (features["identity_bank_count"] >= 2, f"Identity controls accounts across {int(features['identity_bank_count'])} banks"),
        (bool(features["closes_cycle"]), "Transaction closes a money-flow cycle"),
        (features["amount_zscore"] >= 3, f"Amount is {features['amount_zscore']:.1f}× sender baseline"),
        (features["new_device"] == 1, "First use of this device on sender account"),
        (features["receiver_age_days"] < 7, "Receiver account is less than 7 days old"),
        (features["velocity_60s"] >= 4, "High transaction velocity in 60 seconds"),
    ]
    for condition, label in candidates:
        if condition:
            labels.append(label)
    return labels[:5]


def _rule_score(features: dict[str, float]) -> tuple[float, list[str]]:
    scores: list[tuple[str, float]] = []
    if features["identity_bank_count"] >= 2 and features["velocity_5m"] >= 1:
        scores.append(("A", min(0.98, 0.70 + 0.08 * features["identity_bank_count"])))
    if features["fan_in"] >= 4 and features["receiver_age_days"] < 30:
        scores.append(("B", min(0.98, 0.65 + 0.06 * features["fan_in"])))
    if features["closes_cycle"] or features["chain_depth"] >= 3:
        scores.append(("C", 0.96 if features["closes_cycle"] else 0.82))
    if features["device_account_count"] >= 3 and features["device_bank_count"] >= 2:
        scores.append(("D", min(0.99, 0.72 + 0.06 * features["device_account_count"])))
    return max((score for _, score in scores), default=0.0), [kind for kind, _ in scores]


def score_transaction(payload: ScoreRequest, background_tasks: BackgroundTasks | None = None) -> ScoreResponse:
    started = perf_counter()
    timestamp = _naive_utc(payload.timestamp)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if timestamp > now + timedelta(minutes=5):
        raise HTTPException(422, "transaction timestamp is too far in the future")

    with session_scope() as db:
        existing = db.get(Transaction, payload.transaction_id)
        if existing:
            return ScoreResponse(
                transaction_id=existing.id, fraud_probability=round(existing.fraud_probability, 4),
                rule_score=round(existing.rule_score, 4), final_confidence=round(existing.confidence, 4),
                decision=existing.decision, suspected_swarm_types=existing.triggered_rules,
                top_reasons=existing.reasons, latency_ms=existing.latency_ms, idempotent=True,
            )
        sender = db.get(Account, payload.sender_account_id)
        receiver = db.get(Account, payload.receiver_account_id)
        if not sender or not receiver:
            raise HTTPException(404, "sender or receiver account not found")

        last_txn = db.scalar(select(Transaction).where(
            Transaction.sender_account_id == sender.id,
            Transaction.timestamp <= timestamp,
        ).order_by(Transaction.timestamp.desc()).limit(1))
        if last_txn and timestamp < last_txn.timestamp:
            raise HTTPException(422, "out-of-order transaction timestamp")

        device = db.scalar(select(Device).where(Device.fingerprint == payload.device_fingerprint))
        known_link = False
        linked_accounts = 0
        linked_banks = 0
        if device:
            known_link = db.scalar(select(func.count()).select_from(AccountDevice).where(
                AccountDevice.account_id == sender.id, AccountDevice.device_id == device.id,
            )) > 0
            linked_accounts = db.scalar(select(func.count(distinct(AccountDevice.account_id))).where(AccountDevice.device_id == device.id)) or 0
            linked_banks = db.scalar(select(func.count(distinct(Account.bank_id))).select_from(AccountDevice).join(
                Account, Account.id == AccountDevice.account_id
            ).where(AccountDevice.device_id == device.id)) or 0
        device_account_count = linked_accounts if known_link else linked_accounts + 1
        device_bank_count = linked_banks
        if not known_link and sender.bank_id not in {
            bank for bank in db.scalars(select(Account.bank_id).select_from(AccountDevice).join(
                Account, Account.id == AccountDevice.account_id
            ).where(AccountDevice.device_id == device.id))
        } if device else set():
            device_bank_count += 1

        cutoff = timestamp - timedelta(minutes=5)
        fan_in = db.scalar(select(func.count(distinct(Transaction.sender_account_id))).where(
            Transaction.receiver_account_id == receiver.id, Transaction.timestamp >= cutoff,
            Transaction.timestamp <= timestamp,
        )) or 0
        fan_in += 1
        identity_bank_count = db.scalar(select(func.count(distinct(Account.bank_id))).where(
            Account.identity_id == sender.identity_id
        )) or 1
        seconds_since_last = (timestamp - last_txn.timestamp).total_seconds() if last_txn else 86_400
        amount_zscore = abs(payload.amount - sender.avg_txn_amount) / max(sender.avg_txn_amount * 0.5, 1)
        velocity_60s = cache.window_add_and_count(f"dhokha:velocity:60:{sender.id}", timestamp.timestamp(), 60)
        velocity_5m = cache.window_add_and_count(f"dhokha:velocity:300:{sender.id}", timestamp.timestamp(), 300)
        hour = timestamp.hour
        features = {
            "amount_zscore": amount_zscore,
            "velocity_60s": float(velocity_60s), "velocity_5m": float(velocity_5m),
            "time_since_last": seconds_since_last, "new_device": 0.0 if known_link else 1.0,
            "device_account_count": float(device_account_count), "device_bank_count": float(device_bank_count),
            "unusual_hour": 1.0 if hour < 5 else 0.0, "geo_jump": 0.0,
            "receiver_age_days": max((timestamp - receiver.opened_at).days, 0), "fan_in": float(fan_in),
            "identity_bank_count": float(identity_bank_count),
            "chain_depth": float(graph_engine.chain_depth(receiver.id)),
            "closes_cycle": float(graph_engine.would_close_cycle(sender.id, receiver.id)),
        }
        probability, _ = fraud_model.predict(features)
        rule_score, suspected = _rule_score(features)
        confidence = min(0.99, max(0.55 * probability + 0.45 * rule_score, rule_score * 0.95))
        decision = _decision(confidence)
        reasons = _reason_labels(features)

        if not device:
            device = Device(
                id=f"DEV-{abs(hash(payload.device_fingerprint))}", fingerprint=payload.device_fingerprint,
                ip_block="synthetic", first_seen_at=timestamp,
            )
            db.add(device)
            db.flush()
        link = db.scalar(select(AccountDevice).where(
            AccountDevice.account_id == sender.id, AccountDevice.device_id == device.id,
        ))
        if link:
            link.last_used_at = timestamp
            link.use_count += 1
        else:
            db.add(AccountDevice(account_id=sender.id, device_id=device.id, last_used_at=timestamp, use_count=1))

        latency = round((perf_counter() - started) * 1000, 2)
        txn = Transaction(
            id=payload.transaction_id, sender_account_id=sender.id, receiver_account_id=receiver.id,
            amount=payload.amount, timestamp=timestamp, channel=payload.channel,
            device_fingerprint=payload.device_fingerprint, geo_lat=payload.geo_lat, geo_lon=payload.geo_lon,
            fraud_probability=probability, rule_score=rule_score, confidence=confidence,
            decision=decision, triggered_rules=suspected, reasons=reasons, latency_ms=latency,
        )
        db.add(txn)

    if background_tasks:
        background_tasks.add_task(graph_engine.process, payload.transaction_id, suspected, reasons)
    return ScoreResponse(
        transaction_id=payload.transaction_id, fraud_probability=round(probability, 4),
        rule_score=round(rule_score, 4), final_confidence=round(confidence, 4), decision=decision,
        suspected_swarm_types=suspected, top_reasons=reasons, latency_ms=latency,
    )
