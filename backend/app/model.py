from pathlib import Path

from app.config import settings

FEATURE_ORDER = [
    "amount_zscore", "velocity_60s", "velocity_5m", "time_since_last",
    "new_device", "device_account_count", "device_bank_count", "unusual_hour",
    "geo_jump", "receiver_age_days", "fan_in", "identity_bank_count",
    "chain_depth", "closes_cycle",
]


class FraudModel:
    def __init__(self):
        self.model = None
        self.backend = "heuristic"
        path = Path(settings.model_path)
        if path.exists():
            try:
                import joblib
                artifact = joblib.load(path)
                self.model = artifact["model"] if isinstance(artifact, dict) else artifact
                self.backend = artifact.get("backend", type(self.model).__name__) if isinstance(artifact, dict) else type(self.model).__name__
            except Exception:
                self.model = None

    def predict(self, features: dict[str, float]) -> tuple[float, list[str]]:
        values = [[float(features.get(name, 0)) for name in FEATURE_ORDER]]
        if self.model is not None:
            try:
                probability = float(self.model.predict_proba(values)[0][1])
                importances = getattr(self.model, "feature_importances_", None)
                if importances is not None:
                    ranked = sorted(zip(FEATURE_ORDER, importances, values[0]), key=lambda x: x[1] * abs(x[2]), reverse=True)
                    return probability, [name for name, _, value in ranked[:3] if value]
                return probability, []
            except Exception:
                pass

        # Transparent heuristic model aligning ML feature weights to risk tiers
        zscore_component = min(features["amount_zscore"] / 10, 1.0) * 0.45
        velocity_component = min(features["velocity_60s"] / 4, 1.0) * 0.20
        fan_in_component = min(features["fan_in"] / 4, 1.0) * 0.20
        device_component = min(features["device_account_count"] / 4, 1.0) * 0.15
        
        raw_prob = zscore_component + velocity_component + fan_in_component + device_component + (0.15 if features["closes_cycle"] else 0.0)
        probability = min(0.99, max(0.08, raw_prob))

        reasons = []
        if features["amount_zscore"] >= 3:
            reasons.append(f"Amount is {features['amount_zscore']:.1f}× sender baseline")
        if features["fan_in"] >= 3:
            reasons.append(f"Receiver has {int(features['fan_in'])} recent incoming senders")
        if features["device_account_count"] >= 3:
            reasons.append(f"Device shared across {int(features['device_account_count'])} accounts")

        return probability, reasons


fraud_model = FraudModel()
