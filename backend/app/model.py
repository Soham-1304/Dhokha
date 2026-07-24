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
        # Transparent fallback approximates a conservative baseline model.
        weighted = (
            min(features["amount_zscore"] / 6, 1) * 0.15
            + min(features["velocity_60s"] / 5, 1) * 0.12
            + features["new_device"] * 0.08
            + min(features["device_account_count"] / 5, 1) * 0.20
            + min(features["fan_in"] / 5, 1) * 0.18
            + min(features["identity_bank_count"] / 3, 1) * 0.12
            + features["closes_cycle"] * 0.15
        )
        return min(weighted, 0.99), []


fraud_model = FraudModel()
