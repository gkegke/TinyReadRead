import hashlib
import zipfile
import io
from pathlib import Path
from app.core.config import settings
from app.core.logger import log


class StorageService:
    def __init__(self):
        self.base_dir = settings.STORAGE_DIR
        self._ensure_dir()

    def _ensure_dir(self):
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def generate_content_hash(
        self, text: str, voice: str, speed: float, model: str
    ) -> str:
        payload = f"{text}|{voice}|{speed}|{model}"
        return hashlib.sha256(payload.encode()).hexdigest()

    def get_audio_path(self, audio_hash: str) -> Path:
        return self.base_dir / f"{audio_hash}.wav"

    def audio_exists(self, audio_hash: str) -> bool:
        return self.get_audio_path(audio_hash).exists()

    def delete_file(self, audio_hash: str):
        path = self.get_audio_path(audio_hash)
        if path.exists():
            try:
                path.unlink()
                log.info(f"STORAGE: Physically deleted {audio_hash[:8]}.wav")
                return True
            except Exception as e:
                log.error(f"STORAGE: Failed to delete {audio_hash}: {e}")
        return False

    def create_project_zip(self, project_name: str, chapters: list) -> io.BytesIO:
        """
        Creates a ZIP where chapters are folders and blocks are numbered files.
        """
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for ch_idx, chapter in enumerate(chapters):
                heading = chapter["heading"]
                # Default folder name
                folder_name = f"Chapter_{ch_idx + 1:02d}"

                if heading:
                    # Clean heading for filename safety
                    clean_title = "".join(
                        c
                        for c in heading.text_content[:30]
                        if c.isalnum() or c in " _-"
                    ).strip()
                    if clean_title:
                        folder_name = f"{ch_idx + 1:02d}_{clean_title}"

                for i, chunk in enumerate(chapter["chunks"]):
                    if chunk.audio_hash:
                        path = self.get_audio_path(chunk.audio_hash)
                        if path.exists():
                            # Clean text snippet for file name
                            snippet = "".join(
                                c
                                for c in chunk.text_content[:20]
                                if c.isalnum() or c in " _-"
                            ).strip()
                            file_name = f"{i + 1:03d}_{snippet}.wav"
                            zip_file.write(path, arcname=f"{folder_name}/{file_name}")

        zip_buffer.seek(0)
        return zip_buffer

    def get_storage_stats(self):
        files = list(self.base_dir.glob("*.wav"))
        total_size = sum(f.stat().st_size for f in files)
        return {
            "file_count": len(files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }

    def purge_all(self):
        log.warning("STORAGE: Executing GLOBAL cache purge...")
        for f in self.base_dir.glob("*.wav"):
            f.unlink()
        return True


storage_service = StorageService()
