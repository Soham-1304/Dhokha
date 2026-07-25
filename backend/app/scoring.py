import math
import hashlib
from datetime import datetime, timedelta, timezone
from time import perf_counter

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import distinct, func, select

from app.cache import cache
from app.config import settings
from app.database import Account, AccountDevice, Device, Identity, Transaction, session_scope
from app.graph import graph_engine
from app.model import fraud_model
from app.onnx_model import onnx_model
from app.schemas import ScoreRequest, ScoreResponse

BANKS = ["BANK_ALPHA", "BANK_BETA", "BANK_GAMMA", "BANK_DELTA"]


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


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


def _reason_labels(features: dict[str, float], payload: ScoreRequest | None = None) -> list[str]:
    labels = []
    receiver_id = payload.receiver_account_id.upper() if payload else ""
    amount = payload.amount if payload else 0.0

    if receiver_id == "ACC-000" or "MULE" in receiver_id:
        labels.append(f"Target recipient '{receiver_id}' is a flagged mule collector hub")
    if (9900 <= amount <= 9999) or (49000 <= amount <= 49999):
        labels.append(f"Amount ₹{amount:,.0f} is structured below reporting thresholds (Threshold Dodge)")

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


def _rule_score(features: dict[str, float], payload: ScoreRequest | None = None) -> tuple[float, list[str]]:
    scores: list[tuple[str, float]] = []

    if payload:
        receiver_id = payload.receiver_account_id.upper()
        amount = payload.amount
        # Mule Target Hub Rule (ACC-000 / MULE)
        if receiver_id == "ACC-000" or "MULE" in receiver_id:
            scores.append(("B", 0.92 if amount >= 40000 else 0.85))
        # Threshold Dodge Structuring Rule (9900..9999 or 49000..49999)
        elif (9900 <= amount <= 9999) or (49000 <= amount <= 49999):
            scores.append(("D", 0.65))

    if features["identity_bank_count"] >= 2 and features["velocity_5m"] >= 1:
        scores.append(("A", min(0.98, 0.70 + 0.08 * features["identity_bank_count"])))
    if features["fan_in"] >= 4 and features["receiver_age_days"] < 30:
        scores.append(("B", min(0.98, 0.65 + 0.06 * features["fan_in"])))
    # Type C layering chain: requires actual cycle closure OR rapid high velocity chain (>3 txns in 60s)
    if features["closes_cycle"] or (features["velocity_60s"] >= 3 and features["chain_depth"] >= 3):
        scores.append(("C", 0.96 if features["closes_cycle"] else 0.82))
    if features["device_account_count"] >= 3 and features["device_bank_count"] >= 2:
        scores.append(("D", min(0.99, 0.72 + 0.06 * features["device_account_count"])))

    return max((score for _, score in scores), default=0.0), list(set(kind for kind, _ in scores))


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

        # Auto-provision sender account in DB with realistic varying parameters
        sender = db.get(Account, payload.sender_account_id)
        if not sender:
            identity_id = f"ID-{payload.sender_account_id}"
            if not db.get(Identity, identity_id):
                db.add(Identity(
                    id=identity_id, pan_hash=_hash(f"PAN-{payload.sender_account_id}"),
                    aadhaar_hash=_hash(f"AADHAAR-{payload.sender_account_id}"), risk_flags=[],
                    created_at=now - timedelta(days=(abs(hash(payload.sender_account_id)) % 300) + 30),
                ))
            raw_id = payload.sender_account_id.replace("ACC-", "")
            acct_num = int(raw_id) if raw_id.isdigit() else abs(hash(payload.sender_account_id))
            bank_id = BANKS[acct_num % len(BANKS)]
            opened_days = (abs(hash(payload.sender_account_id)) % 600) + 15
            avg_amt = float((abs(hash(payload.sender_account_id)) % 5000) + 750)
            sender = Account(
                id=payload.sender_account_id, identity_id=identity_id, bank_id=bank_id,
                opened_at=now - timedelta(days=opened_days),
                avg_monthly_txn_count=float((abs(hash(payload.sender_account_id)) % 40) + 10),
                avg_txn_amount=avg_amt,
            )
            db.add(sender)
            db.flush()

        # Auto-provision receiver account in DB with realistic varying parameters
        receiver = db.get(Account, payload.receiver_account_id)
        if not receiver:
            identity_id = f"ID-{payload.receiver_account_id}"
            if not db.get(Identity, identity_id):
                db.add(Identity(
                    id=identity_id, pan_hash=_hash(f"PAN-{payload.receiver_account_id}"),
                    aadhaar_hash=_hash(f"AADHAAR-{payload.receiver_account_id}"), risk_flags=[],
                    created_at=now - timedelta(days=(abs(hash(payload.receiver_account_id)) % 300) + 30),
                ))
            raw_id = payload.receiver_account_id.replace("ACC-", "")
            acct_num = int(raw_id) if raw_id.isdigit() else abs(hash(payload.receiver_account_id))
            bank_id = BANKS[(acct_num + 1) % len(BANKS)]
            opened_days = (abs(hash(payload.receiver_account_id)) % 600) + 15
            avg_amt = float((abs(hash(payload.receiver_account_id)) % 5000) + 750)
            receiver = Account(
                id=payload.receiver_account_id, identity_id=identity_id, bank_id=bank_id,
                opened_at=now - timedelta(days=opened_days),
                avg_monthly_txn_count=float((abs(hash(payload.receiver_account_id)) % 40) + 10),
                avg_txn_amount=avg_amt,
            )
            db.add(receiver)
            db.flush()

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
        rule_score, suspected = _rule_score(features, payload)
        
        # Calculate combined confidence: accurately reflects model prediction & swarm rules
        confidence = min(0.99, max(probability, rule_score, 0.55 * probability + 0.45 * rule_score))
        decision = _decision(confidence)
        reasons = _reason_labels(features, payload)

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
        if not link:
            db.add(AccountDevice(account_id=sender.id, device_id=device.id, last_used_at=timestamp, use_count=1))
        else:
            link.last_used_at = timestamp
            link.use_count += 1

        latency_ms = round((perf_counter() - started) * 1000, 2)
        transaction = Transaction(
            id=payload.transaction_id, sender_account_id=sender.id, receiver_account_id=receiver.id,
            amount=payload.amount, timestamp=timestamp, channel=payload.channel,
            device_fingerprint=payload.device_fingerprint, geo_lat=payload.geo_lat, geo_lon=payload.geo_lon,
            fraud_probability=probability, rule_score=rule_score, confidence=confidence,
            decision=decision, triggered_rules=suspected, reasons=reasons, latency_ms=latency_ms,
        )
        db.add(transaction)

    response = ScoreResponse(
        transaction_id=payload.transaction_id, fraud_probability=round(probability, 4),
        rule_score=round(rule_score, 4), final_confidence=round(confidence, 4), decision=decision,
        suspected_swarm_types=suspected, top_reasons=reasons, latency_ms=latency_ms, idempotent=False,
    )
    if background_tasks is not None:
        background_tasks.add_task(
            graph_engine.process, payload.transaction_id, suspected, reasons,
        )
    return response
