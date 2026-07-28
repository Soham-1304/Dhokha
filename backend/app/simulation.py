import hashlib
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import delete, func, select

from app.config import settings
from app.database import Account, AccountDevice, Alert, Device, Identity, Transaction, session_scope
from app.schemas import ScoreRequest, SwarmType


BANKS = ["HDFC", "ICICI", "AXIS", "KOTAK", "SBI"]


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def reset_demo_data() -> dict:
    rng = random.Random(settings.demo_seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with session_scope() as db:
        for model in (Alert, Transaction, AccountDevice, Device, Account, Identity):
            db.execute(delete(model))

        for index in range(40):
            identity_id = f"ID-{index:03d}"
            account_id = f"ACC-{index:03d}"
            identity = Identity(
                id=identity_id,
                pan_hash=_hash(f"PAN-{settings.demo_seed}-{index}"),
                aadhaar_hash=_hash(f"AADHAAR-{settings.demo_seed}-{index}"),
                created_at=now - timedelta(days=rng.randint(100, 1500)),
            )
            account = Account(
                id=account_id,
                identity_id=identity_id,
                bank_id=BANKS[index % len(BANKS)],
                opened_at=now - timedelta(days=rng.randint(30, 1200)),
                avg_monthly_txn_count=rng.randint(8, 60),
                avg_txn_amount=round(rng.uniform(500, 8000), 2),
            )
            fingerprint = f"normal-device-{index:03d}"
            device = Device(
                id=f"DEV-{index:03d}", fingerprint=fingerprint,
                ip_block=f"10.{index % 20}.{index}.0/24", first_seen_at=now - timedelta(days=90),
            )
            db.add_all([identity, account, device])
            db.flush()
            db.add(AccountDevice(account_id=account_id, device_id=device.id, last_used_at=now, use_count=10))

        # Seed a deterministic transaction history so the dashboard starts from
        # persisted SQLite data instead of frontend fixtures.
        amounts = [340, 800, 1850, 2499, 5000, 9998, 9999, 12000, 25000, 48200, 63500, 74500]
        risk_profiles = [
            (0.03, 0.00, 0.02, "allow", [], ["Normal payment pattern"]),
            (0.05, 0.00, 0.03, "allow", [], ["Known device and normal velocity"]),
            (0.07, 0.00, 0.04, "allow", [], ["Normal payment pattern"]),
            (0.09, 0.00, 0.05, "allow", [], ["Known device and normal velocity"]),
            (0.12, 0.18, 0.15, "allow", [], ["Amount within expected range"]),
            (0.28, 0.56, 0.62, "review", ["B"], ["Receiver has elevated recent fan-in"]),
            (0.31, 0.64, 0.68, "review", ["D"], ["Device is shared across multiple accounts"]),
            (0.16, 0.22, 0.19, "allow", [], ["Normal cross-bank transfer"]),
            (0.42, 0.72, 0.76, "review", ["A"], ["Identity operates accounts across banks"]),
            (0.65, 0.92, 0.89, "block", ["B"], ["Receiver has many unique recent senders"]),
            (0.71, 0.95, 0.92, "block", ["C"], ["Rapid multi-bank layering pattern"]),
            (0.52, 0.84, 0.82, "review", ["D"], ["Shared device cluster spans multiple banks"]),
        ]
        for index, (amount, profile) in enumerate(zip(amounts, risk_profiles, strict=True)):
            probability, rule_score, confidence, decision, rules, reasons = profile
            sender_index = index
            receiver_index = (index * 3 + 7) % 40
            db.add(Transaction(
                id=f"TXN-SEED-{index + 1:03d}",
                sender_account_id=f"ACC-{sender_index:03d}",
                receiver_account_id=f"ACC-{receiver_index:03d}",
                amount=amount,
                timestamp=now - timedelta(minutes=(len(amounts) - index) * 2),
                channel="UPI",
                device_fingerprint=f"normal-device-{sender_index:03d}",
                geo_lat=None,
                geo_lon=None,
                fraud_probability=probability,
                rule_score=rule_score,
                confidence=confidence,
                decision=decision,
                triggered_rules=rules,
                reasons=reasons,
                latency_ms=round(3.5 + index * 0.37, 2),
            ))
    return {"seed": settings.demo_seed, "accounts": 40, "banks": BANKS}


def ensure_demo_data() -> None:
    with session_scope() as db:
        count = db.scalar(select(func.count()).select_from(Account))
    if not count:
        reset_demo_data()


def _create_account(db, suffix: str, bank: str, identity_id: str | None = None, age_days: int = 5) -> str:
    identity_id = identity_id or f"ID-DEMO-{suffix}"
    if db.get(Identity, identity_id) is None:
        db.add(Identity(
            id=identity_id, pan_hash=_hash(f"PAN-{identity_id}"),
            aadhaar_hash=_hash(f"AADHAAR-{identity_id}"), risk_flags=[],
            created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=age_days),
        ))
    account_id = f"ACC-DEMO-{suffix}"
    if db.get(Account, account_id) is None:
        db.add(Account(
            id=account_id, identity_id=identity_id, bank_id=bank,
            opened_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=age_days),
            avg_monthly_txn_count=3, avg_txn_amount=750,
        ))
    return account_id


def generate_swarm(swarm_type: SwarmType, size: int) -> tuple[str, list[ScoreRequest]]:
    scenario_id = f"scenario-{swarm_type.value}-{uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    requests: list[ScoreRequest] = []
    with session_scope() as db:
        if swarm_type == SwarmType.A:
            shared_identity = f"ID-DEMO-A-{scenario_id}"
            senders = [
                _create_account(db, f"A-{scenario_id}-{i}", BANKS[i % 3], shared_identity, 20)
                for i in range(size)
            ]
            receiver = _create_account(db, f"A-OUT-{scenario_id}", BANKS[3], age_days=3)
            db.flush()
            for i, sender in enumerate(senders):
                requests.append(ScoreRequest(
                    sender_account_id=sender, receiver_account_id=receiver, amount=9500 + i * 100,
                    timestamp=now + timedelta(seconds=i * 2), device_fingerprint=f"device-A-{i}",
                ))
        elif swarm_type == SwarmType.B:
            receiver = _create_account(db, f"B-MULE-{scenario_id}", BANKS[0], age_days=2)
            senders = [f"ACC-{i:03d}" for i in range(size)]
            for i, sender in enumerate(senders):
                requests.append(ScoreRequest(
                    sender_account_id=sender, receiver_account_id=receiver, amount=2500 + i * 250,
                    timestamp=now + timedelta(seconds=i * 3), device_fingerprint=f"normal-device-{i:03d}",
                ))
        elif swarm_type == SwarmType.C:
            chain = [_create_account(db, f"C-{scenario_id}-{i}", BANKS[i % 4], age_days=4) for i in range(size)]
            db.flush()
            for i in range(len(chain)):
                requests.append(ScoreRequest(
                    sender_account_id=chain[i], receiver_account_id=chain[(i + 1) % len(chain)],
                    amount=10000 * (0.95 ** i), timestamp=now + timedelta(seconds=i * 5),
                    device_fingerprint=f"device-C-{i}",
                ))
        else:
            senders = [_create_account(db, f"D-{scenario_id}-{i}", BANKS[i % 3], age_days=10) for i in range(size)]
            receiver = _create_account(db, f"D-OUT-{scenario_id}", BANKS[3], age_days=1)
            db.flush()
            for i, sender in enumerate(senders):
                requests.append(ScoreRequest(
                    sender_account_id=sender, receiver_account_id=receiver, amount=7000 + i * 100,
                    timestamp=now + timedelta(seconds=i * 2), device_fingerprint=f"shared-device-{scenario_id}",
                    geo_lat=19.076, geo_lon=72.8777,
                ))
    return scenario_id, requests
