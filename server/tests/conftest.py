import pytest
import pytest_asyncio
import tempfile
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlalchemy.pool import NullPool
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock

from app.main import app
from app.models.database import get_session
import app.models.database as db_module
from app.services.tts_service import get_tts_manager
from app.services.synthesis import synthesis_manager


@pytest.fixture(scope="session", name="engine")
def engine_fixture():
    """
    [ARCHITECTURE] Session-scoped engine.
    Using a temporary file database with NullPool prevents severe locking and
    concurrent transaction deadlocks associated with SQLite :memory: and StaticPool
    when testing background asyncio workers.
    """
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)

    DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"

    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 15},
        poolclass=NullPool,
    )

    # Overwrite the global engine so routes and workers use the test DB
    db_module.async_engine = engine

    yield engine

    if os.path.exists(db_path):
        os.remove(db_path)


@pytest_asyncio.fixture(name="session")
async def session_fixture(engine):
    """Provides a clean database for every test function."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)


@pytest_asyncio.fixture(name="client")
async def client_fixture(session: AsyncSession):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as client:
        yield client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_synthesis_worker():
    """
    Clean up the synthesis singleton between tests.
    Prevents background workers from one test leaking into another
    and accessing the wrong database engine.
    """
    yield
    await synthesis_manager.stop_worker()
    # Reset stats for the next test
    synthesis_manager.stats = {
        "chunks_processed": 0,
        "total_synth_time_ms": 0,
        "last_rtf": 0.0,
        "status": "idle",
    }


@pytest.fixture(autouse=True)
def mock_tts_engine():
    """Globally prevent tests from loading real models."""
    manager = get_tts_manager()
    manager.engine = MagicMock()
    # Mock generate to return a dummy numpy array (1 second of silence at 24kHz)
    import numpy as np

    # Return 0.1 seconds of audio to keep tests fast
    manager.engine.generate.return_value = np.zeros(2400)
    manager.engine.get_voices.return_value = ["Jasper", "Luna"]
    return manager.engine
