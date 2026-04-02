import asyncio
import numpy as np
import soundfile as sf
from abc import ABC, abstractmethod
from typing import List
from kittentts import KittenTTS
from app.core.config import settings
from app.core.logger import log
from app.services.storage import storage_service


class TTSEngine(ABC):
    @abstractmethod
    def load(self, model_id: str):
        pass

    @abstractmethod
    def generate(self, text: str, voice: str, speed: float) -> np.ndarray:
        pass

    @abstractmethod
    def get_voices(self) -> List[str]:
        pass


class KittenEngine(TTSEngine):
    MODELS = {
        "kitten-mini": "KittenML/kitten-tts-mini-0.8",
        "kitten-micro": "KittenML/kitten-tts-micro-0.8",
        "kitten-nano": "KittenML/kitten-tts-nano-0.8",
    }

    def __init__(self):
        self.model = None
        self.current_id = None

    def load(self, model_id: str):
        hf_id = self.MODELS.get(model_id, self.MODELS["kitten-mini"])
        if self.model is not None and self.current_id == model_id:
            return

        log.info(f"KittenEngine: Loading {hf_id}")
        self.model = KittenTTS(
            model_name=hf_id, cache_dir=str(settings.MODEL_CACHE_DIR)
        )
        self.current_id = model_id

    def generate(self, text: str, voice: str, speed: float) -> np.ndarray:
        if not self.model:
            self.load("kitten-mini")
        return self.model.generate(text=text, voice=voice, speed=speed)

    def get_voices(self) -> List[str]:
        return self.model.available_voices if self.model else []


class TTSManager:
    def __init__(self):
        self.engine: TTSEngine = KittenEngine()

    def load_model(self, model_id: str):
        self.engine.load(model_id)

    async def generate_async(
        self, text: str, audio_hash: str, voice: str, speed: float
    ):
        """
        Synthesize audio.
        """
        out_path = storage_service.get_audio_path(audio_hash)
        if out_path.exists():
            return str(out_path)

        try:
            # We use to_thread because Kittentts/Numpy operations are CPU-bound and blocking
            audio = await asyncio.to_thread(self.engine.generate, text, voice, speed)
            await asyncio.to_thread(sf.write, out_path, audio, 24000)
            return str(out_path)
        except Exception as e:
            log.error(f"TTSManager: Generation failed: {e}")
            raise

    def get_available_voices(self) -> List[str]:
        return self.engine.get_voices()


_manager = TTSManager()


def get_tts_manager() -> TTSManager:
    return _manager


def init_tts_manager(provider: str):
    pass
