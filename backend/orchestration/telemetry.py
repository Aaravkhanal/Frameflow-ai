"""Telemetry and observability for orchestration runs.

Every completed orchestration run produces a JSON telemetry record written
to ``run_logs/orchestration/``.  These records power the debug dashboard
and continuous improvement loop.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class AgentTurnRecord:
    """Metrics for a single agent turn within an orchestration run."""

    agent_role: str
    model: str
    duration_ms: int = 0
    score: Optional[float] = None
    tokens_in: int = 0
    tokens_out: int = 0
    error: Optional[str] = None


@dataclass
class OrchestrationTelemetry:
    """Aggregated telemetry for one orchestration run."""

    run_id: str
    timestamp: float = field(default_factory=time.time)
    pipeline_complexity: str = ""
    agents_used: List[str] = field(default_factory=list)
    agent_turns: List[AgentTurnRecord] = field(default_factory=list)
    duration_ms: int = 0
    final_score: float = 0.0
    debate_rounds: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0

    # Set after the run.
    success: bool = True
    error: Optional[str] = None

    def save(self, log_dir: str = "run_logs/orchestration") -> None:
        """Persist the telemetry record as a JSON file."""
        try:
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            filename = f"{self.run_id}.json"
            filepath = os.path.join(log_dir, filename)

            data = asdict(self)
            with open(filepath, "w") as f:
                json.dump(data, f, indent=2, default=str)

            print(f"[TELEMETRY] Saved orchestration telemetry to {filepath}")
        except Exception as e:
            # Telemetry should never crash the pipeline.
            print(f"[TELEMETRY] Failed to save: {e}")

    @classmethod
    def load_recent(cls, log_dir: str = "run_logs/orchestration", limit: int = 50) -> List[dict]:
        """Load the most recent telemetry records."""
        log_path = Path(log_dir)
        if not log_path.exists():
            return []

        files = sorted(log_path.glob("*.json"), key=os.path.getmtime, reverse=True)
        records = []
        for f in files[:limit]:
            try:
                with open(f) as fp:
                    records.append(json.load(fp))
            except Exception:
                continue
        return records
