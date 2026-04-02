import pytest
import asyncio
from app.services.synthesis import synthesis_manager
from app.models.database import Project, Chunk, init_db


@pytest.mark.asyncio
async def test_worker_focus_pivot(session, engine):
    """
    Validates that the synthesis worker correctly ignores non-focused projects
    and pivots immediately when focus changes.
    """
    # 0. Clean slate: Stop worker before re-init
    await synthesis_manager.stop_worker()
    await init_db(engine_override=engine)

    # 1. Setup two projects
    p1 = Project(name="Project A")
    p2 = Project(name="Project B")
    session.add(p1)
    session.add(p2)
    await session.commit()
    await session.refresh(p1)
    await session.refresh(p2)

    # 2. Add chunks to both
    c1 = Chunk(
        project_id=p1.id, text_content="P1 Content", ordinal_index=0, status="pending"
    )
    c2 = Chunk(
        project_id=p2.id, text_content="P2 Content", ordinal_index=0, status="pending"
    )
    session.add(c1)
    session.add(c2)
    await session.commit()

    # 3. Start worker
    await synthesis_manager.start_worker()

    # 4. Focus on P2
    await synthesis_manager.set_focus(p2.id)

    # Wait for completion (using loop wait rather than sleep for better integration)
    for _ in range(15):
        await asyncio.sleep(0.1)

        # [CRITICAL FIX: IDENTITY MAP]
        # Explicitly refresh the object to overwrite the SQLAlchemy Identity Map cache
        # with the fresh values modified by the background worker.
        await session.refresh(c2)
        status = c2.status

        # [CRITICAL: DEADLOCK AVOIDANCE]
        # Release the SQLite read-lock so the background worker can acquire
        # a write-lock to commit its "processing" / "generated" updates.
        await session.commit()

        if status == "generated":
            break

    # 5. Assertions
    await session.refresh(c2)
    assert c2.status == "generated", "Project B should be generated"

    await session.refresh(c1)
    assert c1.status == "pending", "Project A should remain pending"

    # 6. Pivot focus
    await synthesis_manager.set_focus(p1.id)

    for _ in range(15):
        await asyncio.sleep(0.1)

        await session.refresh(c1)
        status = c1.status

        await session.commit()

        if status == "generated":
            break

    await session.refresh(c1)
    assert c1.status == "generated", "Project A should now be generated"
