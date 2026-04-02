import asyncio
import logging
import time
from typing import Optional
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import Chunk, Project
from app.services.tts_service import get_tts_manager
from app.services.storage import storage_service
from app.core.config import settings

log = logging.getLogger("tiny_readread")


class SynthesisManager:
    """
    [ARCHITECTURE] Reactive Queue-Based Synthesis.
    """

    def __init__(self):
        self.focused_project_id: Optional[str] = None
        self._queue: Optional[asyncio.Queue] = None
        self._worker_task: Optional[asyncio.Task] = None

        # [METRICS] Visibility into worker performance
        self.stats = {
            "chunks_processed": 0,
            "total_synth_time_ms": 0,
            "last_rtf": 0.0,
            "status": "idle",
        }

    def _ensure_queue(self) -> asyncio.Queue:
        """
        [CRITICAL: LOOP STABILITY]
        Ensures the queue is bound to the current running event loop.
        Essential for singleton managers in pytest-asyncio environments.
        """
        if self._queue is None:
            self._queue = asyncio.Queue()
        return self._queue

    async def start_worker(self):
        """Starts the worker if it's not already running or has died."""
        self._ensure_queue()
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())
            log.info("SYNTH: Reactive worker initialized.")

    async def stop_worker(self):
        """[CRITICAL: TEST STABILITY] Safely cancels the worker task and clears loop-bound refs."""
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

        # Clear queue to ensure next test gets a fresh one on its own loop
        self._queue = None
        log.info("SYNTH: Worker stopped.")

    async def set_focus(self, project_id: str):
        self.focused_project_id = project_id
        log.info(f"SYNTH: Focus shifted -> {project_id[:8]}")

        queue = self._ensure_queue()
        # Flush existing queue
        while not queue.empty():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                break

        from app.models.database import async_engine

        async with AsyncSession(async_engine) as session:
            stmt = (
                select(Chunk.id)
                .where(Chunk.project_id == project_id, Chunk.status == "pending")
                .order_by(Chunk.ordinal_index)
            )
            res = await session.execute(stmt)
            cids = res.scalars().all()

            for cid in cids:
                await queue.put(cid)

            log.debug(f"SYNTH: Queued {len(cids)} items for {project_id[:8]}")

    def notify_new_work(self, chunk_id: str):
        """Standard entry point for API routes to push work."""
        queue = self._ensure_queue()
        queue.put_nowait(chunk_id)

    async def _worker_loop(self):
        queue = self._ensure_queue()
        try:
            while True:
                self.stats["status"] = "idle"
                chunk_id = await queue.get()
                self.stats["status"] = "busy"

                try:
                    await self._process_chunk(chunk_id)
                except Exception as e:
                    log.error(f"SYNTH: Worker loop error on {chunk_id[:8]}: {e}")
                finally:
                    queue.task_done()
        except asyncio.CancelledError:
            log.debug("SYNTH: Worker loop cancelled.")
            raise

    async def _process_chunk(self, chunk_id: str):
        from app.models.database import async_engine

        async with AsyncSession(async_engine, expire_on_commit=False) as session:
            chunk = await session.get(Chunk, chunk_id)

            if not chunk:
                return

            # [PRINCIPLE: EXPLICIT ACTIVITY]
            if chunk.project_id != self.focused_project_id:
                log.debug(f"SYNTH: Skipping {chunk_id[:8]} (not in focus)")
                return

            if chunk.status == "generated":
                return

            project = await session.get(Project, chunk.project_id)
            if not project:
                return

            target_hash = storage_service.generate_content_hash(
                chunk.text_content,
                project.voice_id,
                project.speed,
                settings.KITTEN_MODEL_ID,
            )

            if storage_service.audio_exists(target_hash):
                chunk.audio_hash, chunk.status = target_hash, "generated"
                chunk.error_message = None
                session.add(chunk)
                await session.commit()
                return

            log.info(f"SYNTH: Starting generation for chunk {chunk_id[:8]}")
            chunk.status = "processing"
            session.add(chunk)
            await session.commit()

            start_t = time.perf_counter()
            try:
                manager = get_tts_manager()
                await manager.generate_async(
                    text=chunk.text_content,
                    audio_hash=target_hash,
                    voice=project.voice_id,
                    speed=project.speed,
                )

                duration_ms = (time.perf_counter() - start_t) * 1000
                self.stats["chunks_processed"] += 1
                self.stats["total_synth_time_ms"] += duration_ms

                chunk.audio_hash, chunk.status = target_hash, "generated"
                chunk.error_message = None
            except Exception as e:
                log.error(f"SYNTH: Generation failed: {e}")
                chunk.status = "failed"
                chunk.error_message = str(e)

            session.add(chunk)
            await session.commit()
            log.info(
                f"SYNTH: Completed {chunk_id[:8]} in {time.perf_counter() - start_t:.2f}s"
            )


synthesis_manager = SynthesisManager()
