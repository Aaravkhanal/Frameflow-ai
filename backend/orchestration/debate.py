"""Multi-agent debate and consensus engine.

Implements the iterative critique → refine → re-critique loop that makes the
multi-agent system genuinely collaborative rather than a simple sequential
pipeline.
"""

from __future__ import annotations

import json
import traceback
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, List, Optional

from openai.types.chat import ChatCompletionMessageParam

from llm import Llm, MODEL_PROVIDER
from orchestration.agent_roles import AgentRole, AgentSpec, AGENT_DISPLAY
from orchestration.specialist_prompts import get_specialist_prompt


@dataclass
class CritiqueResult:
    """Result of a single specialist agent's review of generated code."""

    agent_role: AgentRole
    score: float  # 0–10
    approved: bool
    summary: str
    issues: List[Dict[str, str]]
    suggestions: List[str]
    strengths: List[str]
    raw_response: str = ""

    @property
    def has_critical_issues(self) -> bool:
        return any(
            issue.get("severity") == "critical"
            for issue in self.issues
        )


@dataclass
class DebateRound:
    """One round of multi-agent debate."""

    round_number: int
    critiques: List[CritiqueResult]
    weighted_score: float
    passed_threshold: bool
    code_at_start: str
    code_at_end: str = ""


@dataclass
class DebateResult:
    """Final result of the debate process."""

    final_code: str
    rounds: List[DebateRound]
    final_score: float
    passed: bool
    total_critiques: int
    vetoed: bool = False
    veto_reason: str = ""


# Type alias for the WebSocket send function.
SendFn = Callable[
    [str, Optional[str], int, Optional[Dict[str, Any]], Optional[str]],
    Coroutine[Any, Any, None],
]


def _build_critique_messages(
    critic_role: AgentRole,
    code: str,
    original_prompt: str,
    previous_critiques: Optional[List[CritiqueResult]] = None,
) -> List[ChatCompletionMessageParam]:
    """Assemble the prompt messages for a critic agent."""
    system_prompt = get_specialist_prompt(critic_role)

    user_content = f"""## Original Request

{original_prompt}

## Generated Code

```html
{code}
```
"""

    if previous_critiques:
        user_content += "\n## Previous Critiques from Other Agents\n\n"
        for critique in previous_critiques:
            display = AGENT_DISPLAY.get(critique.agent_role, {})
            name = display.get("name", critique.agent_role.value)
            user_content += f"### {name} (Score: {critique.score}/10)\n"
            user_content += f"Summary: {critique.summary}\n"
            if critique.issues:
                user_content += "Issues:\n"
                for issue in critique.issues[:5]:  # cap to avoid prompt bloat
                    user_content += f"- [{issue.get('severity', 'minor')}] {issue.get('problem', '')}\n"
            user_content += "\n"

        user_content += (
            "\nConsider these critiques in your own review.  "
            "You may agree, disagree, or add new observations.\n"
        )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def _build_refinement_messages(
    code: str,
    critiques: List[CritiqueResult],
    original_prompt: str,
) -> List[ChatCompletionMessageParam]:
    """Build the prompt for the Coder agent to refine code based on critiques."""
    coder_prompt = get_specialist_prompt(AgentRole.CODER)

    critique_summary = ""
    for critique in critiques:
        display = AGENT_DISPLAY.get(critique.agent_role, {})
        name = display.get("name", critique.agent_role.value)
        critique_summary += f"\n### {name} — Score: {critique.score}/10\n"
        critique_summary += f"**Summary**: {critique.summary}\n"

        if critique.issues:
            critique_summary += "**Issues to fix**:\n"
            for issue in critique.issues:
                severity = issue.get("severity", "minor")
                problem = issue.get("problem", "")
                fix = issue.get("fix", "")
                critique_summary += f"- [{severity}] {problem}"
                if fix:
                    critique_summary += f" → Fix: {fix}"
                critique_summary += "\n"

        if critique.suggestions:
            critique_summary += "**Suggestions**:\n"
            for suggestion in critique.suggestions[:3]:
                critique_summary += f"- {suggestion}\n"

    user_content = f"""## REFINEMENT REQUEST

The following code was reviewed by multiple expert agents.  Apply their feedback to produce an improved version.

### Original Request
{original_prompt}

### Current Code
```html
{code}
```

### Expert Agent Critiques
{critique_summary}

## Instructions

1. Address ALL critical and major issues identified by the experts.
2. Apply as many minor improvements and suggestions as practical.
3. Maintain the overall structure and design intent — don't rebuild from scratch.
4. Use `create_file` to write the complete refined HTML to `index.html`.
"""

    return [
        {"role": "system", "content": coder_prompt},
        {"role": "user", "content": user_content},
    ]


def parse_critique_response(
    agent_role: AgentRole,
    raw_response: str,
) -> CritiqueResult:
    """Parse a raw LLM response into a structured CritiqueResult.

    Handles both clean JSON and responses wrapped in markdown code fences.
    """
    # Try to extract JSON from the response.
    text = raw_response.strip()

    # Strip markdown code fences if present.
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (fences).
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON in the response.
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start:end])
            except json.JSONDecodeError:
                # Fallback: treat entire response as a summary.
                return CritiqueResult(
                    agent_role=agent_role,
                    score=5.0,
                    approved=False,
                    summary=text[:200],
                    issues=[],
                    suggestions=[],
                    strengths=[],
                    raw_response=raw_response,
                )
        else:
            return CritiqueResult(
                agent_role=agent_role,
                score=5.0,
                approved=False,
                summary=text[:200],
                issues=[],
                suggestions=[],
                strengths=[],
                raw_response=raw_response,
            )

    return CritiqueResult(
        agent_role=agent_role,
        score=float(data.get("score", 5)),
        approved=bool(data.get("approved", False)),
        summary=str(data.get("summary", "")),
        issues=data.get("issues", []),
        suggestions=data.get("suggestions", []),
        strengths=data.get("strengths", []),
        raw_response=raw_response,
    )


def compute_weighted_score(
    critiques: List[CritiqueResult],
    agent_specs: List[AgentSpec],
) -> float:
    """Compute the weighted average score across all critiques."""
    spec_map = {s.role: s for s in agent_specs}
    total_weight = 0.0
    weighted_sum = 0.0

    for critique in critiques:
        spec = spec_map.get(critique.agent_role)
        weight = spec.consensus_weight if spec else 1.0
        weighted_sum += critique.score * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0
    return weighted_sum / total_weight


def check_vetoes(
    critiques: List[CritiqueResult],
    agent_specs: List[AgentSpec],
) -> Optional[str]:
    """Check if any agent with veto power has vetoed the output.

    Returns the veto reason string if vetoed, None otherwise.
    """
    spec_map = {s.role: s for s in agent_specs}
    for critique in critiques:
        spec = spec_map.get(critique.agent_role)
        if spec and spec.can_veto and critique.has_critical_issues:
            display = AGENT_DISPLAY.get(critique.agent_role, {})
            name = display.get("name", critique.agent_role.value)
            return (
                f"{name} vetoed: {critique.summary} "
                f"(score: {critique.score}/10, "
                f"{len([i for i in critique.issues if i.get('severity') == 'critical'])} critical issues)"
            )
    return None
