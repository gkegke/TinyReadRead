import asyncio
import pysbd
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlmodel import select
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    Project,
    Chunk,
    get_session,
    create_project_from_template,
)
from app.services.storage import storage_service
from app.services.tts_service import get_tts_manager
from app.services.synthesis import synthesis_manager
from app.services.models import model_manager
from app.core.logger import log

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    voice_id: Optional[str] = None
    speed: Optional[float] = None


class TextImport(BaseModel):
    text: str


class ChunkUpdate(BaseModel):
    text_content: Optional[str] = None
    status: Optional[str] = None


class BulkChunkItem(BaseModel):
    text_content: str
    role: str = "paragraph"


class BulkChunkImport(BaseModel):
    chunks: List[BulkChunkItem]


class ResetChunksRequest(BaseModel):
    chunk_ids: Optional[List[str]] = None
    purge_files: bool = False


class ReorderRequest(BaseModel):
    target_index: int


segmenter = pysbd.Segmenter(language="en", clean=False)


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    return result.scalars().all()


@router.get("/projects/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_session)):
    """Retrieve specific project details."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/projects/{project_id}/chunks")
async def get_project_chunks(project_id: str, db: AsyncSession = Depends(get_session)):
    """Fetch chunks and focus the synthesis engine on this project."""
    await synthesis_manager.set_focus(project_id)
    result = await db.execute(
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.ordinal_index)
    )
    return result.scalars().all()


@router.post("/projects")
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_session)):
    """Create a new empty project."""
    project = Project(name=req.name)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str, req: ProjectUpdate, db: AsyncSession = Depends(get_session)
):
    """Update project settings and trigger potential synthesis re-check."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404)
    if req.name is not None:
        project.name = req.name
    if req.voice_id is not None:
        project.voice_id = req.voice_id
    if req.speed is not None:
        project.speed = req.speed
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    await db.commit()
    return project


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_session)):
    """Remove project and associated data."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404)
    await db.delete(project)
    await db.commit()
    return {"status": "success"}


@router.post("/projects/{project_id}/import")
async def import_text(
    project_id: str, req: TextImport, db: AsyncSession = Depends(get_session)
):
    """Split raw text into chunks, save to DB, and queue for synthesis."""
    raw_text = req.text.strip()
    paragraphs = [p.strip() for p in raw_text.split("\n\n") if p.strip()]

    last_res = await db.execute(
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.ordinal_index.desc())
        .limit(1)
    )
    last = last_res.scalars().first()
    idx = (last.ordinal_index + 1) if last else 0

    new_chunks = []
    for p_text in paragraphs:
        role = "heading" if p_text.startswith("#") else "paragraph"
        content = p_text.lstrip("# ").strip()

        if role == "heading":
            c = Chunk(
                project_id=project_id,
                text_content=content,
                ordinal_index=idx,
                status="pending",
                role=role,
            )
            db.add(c)
            new_chunks.append(c)
            idx += 1
        else:
            sentences = await asyncio.to_thread(segmenter.segment, content)
            for s in sentences:
                if not s.strip():
                    continue
                c = Chunk(
                    project_id=project_id,
                    text_content=s.strip(),
                    ordinal_index=idx,
                    status="pending",
                    role="paragraph",
                )
                db.add(c)
                new_chunks.append(c)
                idx += 1

    await db.commit()

    # Trigger synthesis
    await synthesis_manager.set_focus(project_id)
    for c in new_chunks:
        synthesis_manager.notify_new_work(c.id)
    return {"status": "success", "count": len(new_chunks)}


@router.post("/projects/{project_id}/bulk-chunks")
async def bulk_add_chunks(
    project_id: str, req: BulkChunkImport, db: AsyncSession = Depends(get_session)
):
    """[NEW] Handles direct list-based import for the DemoService."""
    last_res = await db.execute(
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.ordinal_index.desc())
        .limit(1)
    )
    last = last_res.scalars().first()
    idx = (last.ordinal_index + 1) if last else 0

    for item in req.chunks:
        c = Chunk(
            project_id=project_id,
            text_content=item.text_content,
            ordinal_index=idx,
            status="pending",
            role=item.role,
        )
        db.add(c)
        idx += 1

    await db.commit()
    await synthesis_manager.set_focus(project_id)
    return {"status": "success"}


@router.post("/projects/{project_id}/reset-chunks")
async def reset_project_chunks(
    project_id: str, req: ResetChunksRequest, db: AsyncSession = Depends(get_session)
):
    """[NEW] Fixed 404 for 'Regenerate All' button."""
    stmt = select(Chunk).where(Chunk.project_id == project_id)
    if req.chunk_ids:
        stmt = stmt.where(Chunk.id.in_(req.chunk_ids))

    res = await db.execute(stmt)
    chunks = res.scalars().all()

    for c in chunks:
        if req.purge_files and c.audio_hash:
            storage_service.delete_file(c.audio_hash)
        c.status = "pending"
        c.audio_hash = None
        db.add(c)

    await db.commit()
    await synthesis_manager.set_focus(project_id)
    for c in chunks:
        synthesis_manager.notify_new_work(c.id)
    return {"status": "success"}


@router.patch("/chunks/{chunk_id}")
async def update_chunk(
    chunk_id: str, req: ChunkUpdate, db: AsyncSession = Depends(get_session)
):
    """Update content and re-detect role/status."""
    chunk = await db.get(Chunk, chunk_id)
    if not chunk:
        raise HTTPException(404)

    if req.text_content is not None:
        new_text = req.text_content.strip()
        # [CRITICAL] Re-detect role if user added or removed '#'
        if new_text.startswith("#"):
            chunk.role = "heading"
            chunk.text_content = new_text.lstrip("# ").strip()
        else:
            chunk.role = "paragraph"
            chunk.text_content = new_text

        chunk.status = "pending"
        chunk.audio_hash = None

    if req.status is not None:
        chunk.status = req.status

    db.add(chunk)
    await db.commit()
    await db.refresh(chunk)

    if chunk.status == "pending":
        synthesis_manager.notify_new_work(chunk.id)

    return chunk


@router.delete("/chunks/{chunk_id}")
async def delete_chunk(chunk_id: str, db: AsyncSession = Depends(get_session)):
    """[NEW] Fixed 405 Method Not Allowed."""
    chunk = await db.get(Chunk, chunk_id)
    if not chunk:
        raise HTTPException(404)
    await db.delete(chunk)
    await db.commit()
    return {"status": "success"}


@router.post("/chunks/{chunk_id}/reorder")
async def reorder_chunk(
    chunk_id: str, req: ReorderRequest, db: AsyncSession = Depends(get_session)
):
    """Moves a chunk to a specific position and shifts others."""
    chunk = await db.get(Chunk, chunk_id)
    if not chunk:
        raise HTTPException(404)

    project_id = chunk.project_id
    new_idx = max(0, req.target_index - 1)
    old_idx = chunk.ordinal_index

    if new_idx == old_idx:
        return {"status": "no-change"}

    # Fetch all chunks in project to recalculate indices
    res = await db.execute(
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.ordinal_index)
    )
    all_chunks = res.scalars().all()

    # Remove moving chunk and re-insert at target
    all_chunks.remove(chunk)
    all_chunks.insert(new_idx, chunk)

    # Update all ordinal indices
    for i, c in enumerate(all_chunks):
        c.ordinal_index = i
        db.add(c)

    await db.commit()
    return {"status": "success", "new_index": new_idx}


@router.post("/chunks/swap")
async def swap_chunks(req: dict, db: AsyncSession = Depends(get_session)):
    a = await db.get(Chunk, req["idA"])
    b = await db.get(Chunk, req["idB"])
    if not a or not b:
        raise HTTPException(404)
    a.ordinal_index, b.ordinal_index = b.ordinal_index, a.ordinal_index
    db.add(a)
    db.add(b)
    await db.commit()
    return {"status": "success"}


# --- System & Audio ---


@router.get("/audio/{identifier}")
async def get_audio(identifier: str, db: AsyncSession = Depends(get_session)):
    """Serve generated audio file."""
    path = storage_service.get_audio_path(identifier)
    if not path.exists():
        chunk = await db.get(Chunk, identifier)
        if chunk and chunk.audio_hash:
            path = storage_service.get_audio_path(chunk.audio_hash)
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/wav")


@router.get("/voices")
async def list_voices():
    """Return available TTS voices."""
    return {"voices": get_tts_manager().get_available_voices()}


@router.get("/system/stats")
async def get_system_stats():
    return storage_service.get_storage_stats()


@router.post("/system/purge")
async def purge_system_cache():
    storage_service.purge_all()
    return {"status": "success"}


@router.post("/system/seed-demo")
async def seed_demo(db: AsyncSession = Depends(get_session)):
    """
    [CRITICAL FIX] Refactored to prevent 500 errors.
    Creates a fresh onboarding project from the backend template.
    """
    try:
        # Create the project and chunks atomically
        project = await create_project_from_template(db, "welcome")

        # [ROBUSTNESS] Fetch chunk IDs explicitly to avoid LazyLoading errors after commit
        res = await db.execute(select(Chunk.id).where(Chunk.project_id == project.id))
        chunk_ids = res.scalars().all()

        # Shift focus and notify worker
        await synthesis_manager.set_focus(project.id)
        for cid in chunk_ids:
            synthesis_manager.notify_new_work(cid)

        log.info(f"API: Successfully seeded demo project {project.id[:8]}")
        return project
    except Exception as e:
        log.error(f"API: Failed to seed demo: {e}")
        raise HTTPException(500, detail="Internal Server Error during seeding")


@router.get("/projects/{project_id}/export")
async def export_project_audio(
    project_id: str,
    chapter_ids: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
):
    """
    [FEATURE: CHAPTERED EXPORT]
    Bundles all generated audio into a structured ZIP.
    If chapter_ids (comma separated) provided, only those are exported.
    """
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Fetch chunks
    stmt = (
        select(Chunk)
        .where(Chunk.project_id == project_id)
        .order_by(Chunk.ordinal_index)
    )
    res = await db.execute(stmt)
    all_chunks = res.scalars().all()

    # Manual chapterization for the export service
    # (Mimics frontend's deriveChapters logic)
    chapters_data = []
    current_chapter = {"heading": None, "chunks": []}

    selected_filter = set(chapter_ids.split(",")) if chapter_ids else None

    for c in all_chunks:
        if c.role == "heading":
            if current_chapter["chunks"] or current_chapter["heading"]:
                chapters_data.append(current_chapter)
            current_chapter = {"heading": c, "chunks": [c]}
        else:
            current_chapter["chunks"].append(c)

    if current_chapter["chunks"]:
        chapters_data.append(current_chapter)

    # Filter by selected chapters if provided
    if selected_filter:
        # Chapter ID is the ID of the heading chunk (or 'start' for the first)
        # For simplicity in export, we match against the heading ID
        chapters_data = [
            ch
            for ch in chapters_data
            if (ch["heading"] and ch["heading"].id in selected_filter)
        ]

    if not chapters_data:
        raise HTTPException(400, "No content found for export")

    # [CRITICAL] Zip processing moved to storage service
    zip_buffer = storage_service.create_project_zip(project.name, chapters_data)

    clean_name = "".join(c for c in project.name if c.isalnum() or c in " _-").strip()
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={clean_name}_export.zip"
        },
    )


@router.get("/system/models")
async def list_system_models():
    """Returns the download status of all supported TTS models."""
    return model_manager.get_registry()


@router.post("/system/models/{model_id}/download")
async def trigger_model_download(model_id: str, background_tasks: BackgroundTasks):
    """Starts the HF snapshot download in the background."""
    if model_id not in model_manager.supported_models:
        raise HTTPException(404, "Model not supported")

    background_tasks.add_task(model_manager.download_model, model_id)
    return {"status": "started"}


@router.delete("/system/models/{model_id}")
async def delete_model_cache(model_id: str):
    """Wipes the specific model folder to save disk space."""
    import shutil

    path = model_manager.get_model_path(model_id)
    if path.exists():
        await asyncio.to_thread(shutil.rmtree, path)
    return {"status": "deleted"}


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_session)):
    """[MONITORING] Checks database and model presence."""
    try:
        # Check DB
        await db.execute(text("SELECT 1"))

        # Check Models
        models = model_manager.get_registry()
        is_ready = any(m["is_downloaded"] for m in models)

        return {
            "status": "healthy",
            "db": "connected",
            "model_ready": is_ready,
            "storage": storage_service.get_storage_stats(),
        }
    except Exception as e:
        log.error(f"HEALTH: Failed: {e}")
        raise HTTPException(500, detail="unhealthy")
