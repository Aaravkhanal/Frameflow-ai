from fastapi import APIRouter
from fastapi.responses import JSONResponse
from orchestration.telemetry import OrchestrationTelemetry

router = APIRouter(prefix="/api/orchestration", tags=["orchestration"])

@router.get("/telemetry")
async def get_telemetry():
    """Returns the 50 most recent orchestration telemetry records."""
    records = OrchestrationTelemetry.load_recent()
    return JSONResponse({"records": records})
