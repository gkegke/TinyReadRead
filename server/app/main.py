from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from pathlib import Path

from app.core.config import settings
from app.core.logger import log
from app.api.routes import router as api_router
from app.models.database import init_db
from app.services.synthesis import synthesis_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(f"--- {settings.PROJECT_NAME} Appliance Start ---")
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    await init_db()
    await synthesis_manager.start_worker()
    yield
    log.info("--- Lifecycle Shutdown ---")


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. API Routes
app.include_router(api_router, prefix=settings.API_PREFIX)

# 2. Static Files (Frontend Build)
dist_path = Path(__file__).parent / "dist"

if dist_path.exists():
    log.info(f"MAIN: Serving production assets from {dist_path}")

    # Mount assets folder for bundled JS/CSS
    if (dist_path / "assets").exists():
        app.mount("/assets", StaticFiles(directory=dist_path / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Prevent catching API calls that didn't match (return 404 instead of index.html)
        if full_path.startswith("api/"):
            return None

        file_path = dist_path / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # [CRITICAL: SPA FALLBACK]
        # Return index.html for all non-file paths to support React Router
        return FileResponse(dist_path / "index.html")
else:
    log.warning("MAIN: /dist folder not found. Running in API-only mode.")


@app.get("/health")
async def root_health():
    return {"status": "online"}
