# Load environment variables first
from dotenv import load_dotenv

load_dotenv()

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import IS_DEBUG_ENABLED
from routes import (
    screenshot,
    generate_code,
    home,
    evals,
    export,
    design_systems,
    prompt_reports,
    figma,
    orchestration,
)
from uploaded_assets import configure_uploaded_asset_routes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    debug_status = "ENABLED" if IS_DEBUG_ENABLED else "DISABLED"
    logger.info(f"Backend startup complete. Debug mode is {debug_status}.")

    # Detect (and warm up) headless Chromium so the screenshot_preview tool is
    # only offered when it can actually run.
    from preview_screenshot import probe_screenshot_preview

    await probe_screenshot_preview()

    yield
    # Shutdown (nothing to clean up for now)


app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None, lifespan=lifespan)
configure_uploaded_asset_routes(app)

import traceback
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again or contact support if the issue persists."},
    )

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# IMPORTANT: allow_origins=["*"] and allow_credentials=True cannot be used
# together — the Fetch spec forbids credentials with a wildcard origin and
# all modern browsers will reject such responses.
#
# In development (no ALLOWED_ORIGINS set) we allow the default Vite dev
# server origin.  In production set ALLOWED_ORIGINS to a comma-separated
# list of your actual frontend origins, e.g.:
#   ALLOWED_ORIGINS=https://screenshottocode.com,https://www.screenshottocode.com
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
if _raw_origins.strip():
    _allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
else:
    # Development default — the Vite dev server and same-origin proxy
    _allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:7001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes — always available
from auth.routes import router as auth_router

app.include_router(auth_router)
app.include_router(generate_code.router)
app.include_router(screenshot.router)
app.include_router(home.router)
app.include_router(export.router)
app.include_router(design_systems.router)
app.include_router(figma.router)


# ---------------------------------------------------------------------------
# Routes — debug/dev only
# Evals and prompt-reports expose internal LLM prompt contents; only register
# them when IS_DEBUG_ENABLED is explicitly set.
# ---------------------------------------------------------------------------
if IS_DEBUG_ENABLED:
    app.include_router(evals.router)
    app.include_router(prompt_reports.router)
    app.include_router(orchestration.router)
    logger.info("Debug routes enabled: /evals, /prompt-reports, /api/orchestration")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "debug": IS_DEBUG_ENABLED})
