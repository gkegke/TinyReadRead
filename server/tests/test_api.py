import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_full_project_lifecycle(client: AsyncClient):
    # 1. Create Project
    response = await client.post("/projects", json={"name": "Lifecycle Test"})
    assert response.status_code == 200
    project_id = response.json()["id"]

    # 2. Import Text
    text = "Block One.\n\nBlock Two."
    await client.post(f"/projects/{project_id}/import", json={"text": text})

    # 3. Verify Chunks exist
    res = await client.get(f"/projects/{project_id}/chunks")
    chunks = res.json()
    assert len(chunks) == 2
    chunk_id = chunks[0]["id"]

    # 4. Test Deletion (Fixes 405 Method Not Allowed check)
    del_res = await client.delete(f"/chunks/{chunk_id}")
    assert del_res.status_code == 200

    # Verify deletion
    res_after = await client.get(f"/projects/{project_id}/chunks")
    assert len(res_after.json()) == 1

    # 5. Test Reset/Regenerate All (Fixes 404 check)
    reset_res = await client.post(
        f"/projects/{project_id}/reset-chunks", json={"purge_files": False}
    )
    assert reset_res.status_code == 200


@pytest.mark.asyncio
async def test_bulk_import_demo(client: AsyncClient):
    # Tests the endpoint used by DemoService
    proj = (await client.post("/projects", json={"name": "Bulk Test"})).json()
    pid = proj["id"]

    payload = {
        "chunks": [
            {"text_content": "Heading", "role": "heading"},
            {"text_content": "Para", "role": "paragraph"},
        ]
    }
    res = await client.post(f"/projects/{pid}/bulk-chunks", json=payload)
    assert res.status_code == 200

    chunks = (await client.get(f"/projects/{pid}/chunks")).json()
    assert len(chunks) == 2
    assert chunks[0]["role"] == "heading"
