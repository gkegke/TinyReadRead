from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4
from sqlmodel import Field, SQLModel, Relationship, select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from pydantic import ConfigDict
from app.core.config import settings
from app.core.logger import log


class TRRBaseModel(SQLModel):
    model_config = ConfigDict(from_attributes=True)


class Project(TRRBaseModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    name: str
    voice_id: str = "Jasper"
    speed: float = 1.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    chunks: List["Chunk"] = Relationship(back_populates="project", cascade_delete=True)


class Chunk(TRRBaseModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="project.id", ondelete="CASCADE")
    role: str = "paragraph"
    text_content: str
    status: str = "pending"
    error_message: Optional[str] = None
    ordinal_index: int = 0
    audio_hash: Optional[str] = Field(default=None, index=True)

    project: Optional[Project] = Relationship(back_populates="chunks")


PROJECT_TEMPLATES = {
    "welcome": {
        "name": "Tiny-ReadRead Tour",
        "chunks": [
            {"role": "heading", "content": "Welcome to the Studio"},
            {
                "role": "paragraph",
                "content": "Tiny-ReadRead is a hyper-portable AI audio studio. It is designed to run on CPUs, making it perfect for any modern device (not crazy expensive, which is necessary for most AI stuff).",
            },
            {"role": "heading", "content": "How it works"},
            {
                "role": "paragraph",
                "content": "Text is broken into chunks. You can edit, reorder, or regenerate any block individually without re-synthesizing the whole document.",
            },
            {"role": "heading", "content": "Pro-Tips"},
            {
                "role": "paragraph",
                "content": "Use the '#' prefix to create headings and define chapters. Use the sidebar to switch voices or change the TTS model variant.",
            },
            {
                "role": "paragraph",
                "content": "Once satisfied, use the Export button to bundle your audio into a perfectly ordered ZIP file.",
            },
        ],
    }
}

DB_FILE = settings.STORAGE_DIR.parent / "readread.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_FILE}"

# [ARCHITECTURE] SQLITE OPTIMIZATION
# Using connect_args to set a busy_timeout (prevents immediate lock errors)
async_engine = create_async_engine(
    DATABASE_URL, echo=False, poolclass=NullPool, connect_args={"timeout": 30}
)


async def init_db(engine_override=None):
    global async_engine
    if engine_override:
        async_engine = engine_override
        log.info("DB: Using engine override (Test Mode)")

    log.info(f"Initializing SQLite database at {DB_FILE}")

    # [ROBUSTNESS] Enable WAL mode for SQLite
    async with async_engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(SQLModel.metadata.create_all)

        # Migration check
        res = await conn.execute(text("PRAGMA table_info(chunk)"))
        columns = [row[1] for row in res.fetchall()]
        if "error_message" not in columns:
            log.warning("DB: Migrating 'chunk' table to add 'error_message' column.")
            await conn.execute(
                text("ALTER TABLE chunk ADD COLUMN error_message VARCHAR")
            )

    async_session = sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        count = (await session.execute(select(func.count(Project.id)))).scalar()
        if count == 0:
            log.info("DB: Seeding welcome project.")
            await create_project_from_template(session, "welcome")


async def create_project_from_template(
    session: AsyncSession, template_key: str
) -> Project:
    tpl = PROJECT_TEMPLATES.get(template_key, PROJECT_TEMPLATES["welcome"])
    project = Project(name=tpl["name"])
    session.add(project)
    await session.flush()
    for i, c_data in enumerate(tpl["chunks"]):
        chunk = Chunk(
            project_id=project.id,
            role=c_data["role"],
            text_content=c_data["content"],
            ordinal_index=i,
        )
        session.add(chunk)
    await session.commit()
    await session.refresh(project)
    return project


async def get_session() -> AsyncSession:
    async_session = sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
