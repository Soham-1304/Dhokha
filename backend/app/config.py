from dataclasses import dataclass
import os


def _env_bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/dhokha.db")
    redis_url: str | None = os.getenv("REDIS_URL")
    allow_threshold: float = float(os.getenv("ALLOW_THRESHOLD", "0.60"))
    block_threshold: float = float(os.getenv("BLOCK_THRESHOLD", "0.85"))
    model_path: str = os.getenv("MODEL_PATH", "./models/fraud_model.joblib")
    bedrock_enabled: bool = _env_bool("BEDROCK_ENABLED")
    bedrock_region: str = os.getenv("BEDROCK_REGION", "ap-south-1")
    bedrock_api_key: str | None = os.getenv("BEDROCK_API_KEY")
    bedrock_base_url: str = os.getenv(
        "BEDROCK_BASE_URL",
        "https://bedrock-mantle.ap-south-1.api.aws/v1",
    ).rstrip("/")
    bedrock_model_id: str = os.getenv(
        "BEDROCK_MODEL_ID",
        "google.gemma-3-4b-it",
    )
    bedrock_connect_timeout: float = float(
        os.getenv("BEDROCK_CONNECT_TIMEOUT", "1.0")
    )
    bedrock_read_timeout: float = float(os.getenv("BEDROCK_READ_TIMEOUT", "4.0"))
    bedrock_max_tokens: int = int(os.getenv("BEDROCK_MAX_TOKENS", "160"))
    demo_seed: int = int(os.getenv("DEMO_SEED", "2026"))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    )


settings = Settings()
