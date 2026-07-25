import os

NUM_VARIANTS = 4
NUM_VARIANTS_VIDEO = 2

# LLM-related
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", None)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", None)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", None)
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", None)

# Image generation (optional)
REPLICATE_API_KEY = os.environ.get("REPLICATE_API_KEY", None)

# NVIDIA NIM (OpenAI-compatible endpoint for GLM-5.2 and Kimi K2.6)
NVIDIA_API_KEY_GLM = os.environ.get("NVIDIA_API_KEY_GLM", None)
NVIDIA_API_KEY_KIMI = os.environ.get("NVIDIA_API_KEY_KIMI", None)
NVIDIA_BASE_URL = os.environ.get(
    "NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"
)

# Multi-model consensus pipeline
# When enabled, multiple models generate + critique each other before the
# final output is returned to the user.
CONSENSUS_ENABLED = (
    os.environ.get("CONSENSUS_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
)

# Multi-agent Orchestration Engine
ORCHESTRATION_ENABLED = (
    os.environ.get("ORCHESTRATION_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
)
ORCHESTRATION_QUALITY_THRESHOLD = float(os.environ.get("ORCHESTRATION_QUALITY_THRESHOLD", "6.5"))
ORCHESTRATION_MAX_DEBATE_ROUNDS = int(os.environ.get("ORCHESTRATION_MAX_DEBATE_ROUNDS", "2"))
ORCHESTRATION_CONFIDENCE_TARGET = float(os.environ.get("ORCHESTRATION_CONFIDENCE_TARGET", "7.5"))

# Agent settings
# Maximum wall-clock seconds a single agent run is allowed to take.
# Override with AGENT_TIMEOUT_SECONDS env var.
AGENT_TIMEOUT_SECONDS = int(os.environ.get("AGENT_TIMEOUT_SECONDS", 300))

# Debugging-related
# Use a proper string comparison so that IS_DEBUG_ENABLED=False in .env
# does NOT accidentally enable debug mode (bool("False") is True).
IS_DEBUG_ENABLED = (
    os.environ.get("IS_DEBUG_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
)
DEBUG_DIR = os.environ.get("DEBUG_DIR", "")

# When enabled, every LLM request is written to run_logs/prompt_reports as a
# JSON report viewable at /evals/prompt-reports.
PROMPT_REPORTS_ENABLED = os.environ.get(
    "PROMPT_REPORTS_ENABLED", ""
).strip().lower() in {"1", "true", "yes", "on"}
LOCAL_ASSET_DIR = os.environ.get(
    "LOCAL_ASSET_DIR", os.path.join(os.path.dirname(__file__), "local_assets")
)
# Base URL the backend serves /local-assets from. The live (websocket) path
# infers this per-request; the evals path has no request, so it uses this.
LOCAL_ASSET_BASE_URL = os.environ.get("LOCAL_ASSET_BASE_URL", "http://127.0.0.1:7001")

# Set to True when running in production (on the hosted version).
# Use a proper string comparison — bool("False") is True.
IS_PROD = (
    os.environ.get("IS_PROD", "").strip().lower() in {"1", "true", "yes", "on"}
)
