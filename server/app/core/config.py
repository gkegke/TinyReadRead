from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pathlib import Path
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tiny-ReadRead"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Defaults to /app/data but allows override via Env Vars
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", "./data/audio")).resolve()
    MODEL_CACHE_DIR: Path = Path(os.getenv("HF_HOME", "./data/hf_cache")).resolve()

    HF_HUB_DISABLE_TELEMETRY: str = "1"

    DEFAULT_TTS_PROVIDER: str = "kitten"
    KITTEN_MODEL_ID: str = "KittenML/kitten-tts-mini-0.8"
    DEFAULT_VOICE: str = "Jasper"
    DEFAULT_SPEED: float = 1.0

    model_config = ConfigDict(env_file=".env")


settings = Settings()

# Ensure HuggingFace uses our cached volume
os.environ["HF_HUB_DISABLE_TELEMETRY"] = settings.HF_HUB_DISABLE_TELEMETRY
os.environ["HF_HOME"] = str(settings.MODEL_CACHE_DIR)
