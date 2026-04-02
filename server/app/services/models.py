import asyncio
from pathlib import Path
from typing import Dict, List
from huggingface_hub import snapshot_download
from app.core.config import settings
from app.core.logger import log


class ModelManager:
    def __init__(self):
        self.supported_models = {
            "kitten-mini": "KittenML/kitten-tts-mini-0.8",
            "kitten-micro": "KittenML/kitten-tts-micro-0.8",
            "kitten-nano": "KittenML/kitten-tts-nano-0.8",
        }
        # In-memory status: "idle", "downloading", "error"
        self.download_status: Dict[str, str] = {}
        self.errors: Dict[str, str] = {}

    def get_model_path(self, model_key: str) -> Path:
        repo_id = self.supported_models.get(model_key)
        # HF standard pathing: hub/models--repo--id/snapshots/...
        folder_name = f"models--{repo_id.replace('/', '--')}"
        return settings.MODEL_CACHE_DIR / folder_name

    def is_downloaded(self, model_key: str) -> bool:
        path = self.get_model_path(model_key)
        # Simple check: Does the snapshot directory exist and have content?
        if not path.exists():
            return False
        return any(path.iterdir())

    async def download_model(self, model_key: str):
        if model_key not in self.supported_models:
            return

        if self.download_status.get(model_key) == "downloading":
            return

        self.download_status[model_key] = "downloading"
        repo_id = self.supported_models[model_key]

        log.info(f"MODELS: Starting download for {repo_id}")

        try:
            # Move to thread to prevent blocking the Event Loop
            await asyncio.to_thread(
                snapshot_download,
                repo_id=repo_id,
                cache_dir=str(settings.MODEL_CACHE_DIR),
                local_files_only=False,
            )
            self.download_status[model_key] = "idle"
            log.info(f"MODELS: Successfully downloaded {repo_id}")
        except Exception as e:
            self.download_status[model_key] = "error"
            self.errors[model_key] = str(e)
            log.error(f"MODELS: Download failed for {repo_id}: {e}")

    def get_registry(self) -> List[dict]:
        registry = []
        for key, repo in self.supported_models.items():
            registry.append(
                {
                    "id": key,
                    "repo": repo,
                    "is_downloaded": self.is_downloaded(key),
                    "status": self.download_status.get(key, "idle"),
                    "error": self.errors.get(key),
                }
            )
        return registry


model_manager = ModelManager()
