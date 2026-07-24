"""Generate imbalanced synthetic feature vectors and train the preferred model."""
from pathlib import Path
import random
import sys

import joblib
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import settings
from app.model import FEATURE_ORDER


def make_dataset(seed: int = 2026, normal: int = 5000, fraud_each: int = 250):
    rng = random.Random(seed)
    rows, labels, types = [], [], []

    def row(**overrides):
        base = {
            "amount_zscore": max(0, rng.gauss(0.8, 0.6)), "velocity_60s": rng.randint(1, 2),
            "velocity_5m": rng.randint(1, 3), "time_since_last": rng.uniform(60, 10000),
            "new_device": int(rng.random() < 0.05), "device_account_count": 1,
            "device_bank_count": 1, "unusual_hour": int(rng.random() < 0.08), "geo_jump": 0,
            "receiver_age_days": rng.randint(30, 1500), "fan_in": rng.randint(1, 2),
            "identity_bank_count": 1, "chain_depth": rng.randint(0, 1), "closes_cycle": 0,
        }
        base.update(overrides)
        return [base[name] for name in FEATURE_ORDER]

    for _ in range(normal):
        rows.append(row()); labels.append(0); types.append("normal")
    generators = {
        "A": lambda: row(identity_bank_count=rng.randint(2, 4), amount_zscore=rng.uniform(3, 8)),
        "B": lambda: row(fan_in=rng.randint(4, 15), receiver_age_days=rng.randint(0, 20)),
        "C": lambda: row(chain_depth=rng.randint(3, 6), closes_cycle=int(rng.random() < 0.6)),
        "D": lambda: row(device_account_count=rng.randint(3, 10), device_bank_count=rng.randint(2, 4), new_device=1),
    }
    for kind, generator in generators.items():
        for _ in range(fraud_each):
            rows.append(generator()); labels.append(1); types.append(kind)
    return np.asarray(rows), np.asarray(labels), np.asarray(types)


def main():
    X, y, types = make_dataset(settings.demo_seed)
    X_train, X_test, y_train, y_test, _, type_test = train_test_split(
        X, y, types, test_size=0.25, stratify=y, random_state=settings.demo_seed,
    )
    try:
        from lightgbm import LGBMClassifier
        model = LGBMClassifier(n_estimators=100, max_depth=5, learning_rate=0.08, verbosity=-1, random_state=settings.demo_seed)
        backend = "lightgbm"
    except ImportError:
        from sklearn.ensemble import RandomForestClassifier
        model = RandomForestClassifier(n_estimators=100, max_depth=8, class_weight="balanced", random_state=settings.demo_seed)
        backend = "sklearn-random-forest-fallback"
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    print(f"backend={backend}")
    print(classification_report(y_test, predictions, digits=3))
    print("confusion_matrix", confusion_matrix(y_test, predictions).tolist())
    for kind in ("A", "B", "C", "D"):
        mask = type_test == kind
        print(f"recall_{kind}={float((predictions[mask] == 1).mean()):.3f}")
    target = Path(settings.model_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "backend": backend, "features": FEATURE_ORDER}, target)
    print(f"saved={target}")


if __name__ == "__main__":
    main()
