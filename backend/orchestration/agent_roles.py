"""Agent role definitions for the multi-agent orchestration engine.

Each AgentRole represents a specialized AI persona that participates in the
collaborative pipeline.  An AgentSpec bundles the role with its preferred
model, system prompt key, and consensus weight so the orchestrator can
assemble dynamic pipelines at runtime.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from llm import Llm


class AgentRole(str, Enum):
    """Specialist roles available in the orchestration pipeline."""

    VISION = "vision"
    CODER = "coder"
    ACCESSIBILITY = "accessibility"
    PERFORMANCE = "performance"
    UX = "ux"
    ANIMATION = "animation"
    SECURITY = "security"
    REVIEWER = "reviewer"


# Display-friendly metadata for the frontend
AGENT_DISPLAY: dict[AgentRole, dict[str, str]] = {
    AgentRole.VISION: {
        "name": "Vision Analyst",
        "icon": "👁️",
        "color": "#8B5CF6",
        "description": "UI understanding, layout analysis, OCR, component detection",
    },
    AgentRole.CODER: {
        "name": "Frontend Coder",
        "icon": "💻",
        "color": "#3B82F6",
        "description": "Clean, production-ready frontend code generation",
    },
    AgentRole.ACCESSIBILITY: {
        "name": "Accessibility Expert",
        "icon": "♿",
        "color": "#10B981",
        "description": "WCAG 2.1, ARIA, semantic HTML, keyboard navigation",
    },
    AgentRole.PERFORMANCE: {
        "name": "Performance Expert",
        "icon": "⚡",
        "color": "#F59E0B",
        "description": "Core Web Vitals, lazy loading, bundle optimisation",
    },
    AgentRole.UX: {
        "name": "UX Expert",
        "icon": "🎨",
        "color": "#EC4899",
        "description": "Layout flow, visual hierarchy, responsiveness",
    },
    AgentRole.ANIMATION: {
        "name": "Animation Expert",
        "icon": "✨",
        "color": "#6366F1",
        "description": "CSS animations, Framer Motion, transitions, scroll effects",
    },
    AgentRole.SECURITY: {
        "name": "Security Expert",
        "icon": "🔒",
        "color": "#EF4444",
        "description": "XSS prevention, CSP, injection risks, secure defaults",
    },
    AgentRole.REVIEWER: {
        "name": "Senior Reviewer",
        "icon": "🏛️",
        "color": "#8B5CF6",
        "description": "Final architecture review, production readiness gate",
    },
}


@dataclass(frozen=True)
class AgentSpec:
    """Specification for a single specialist agent in the pipeline."""

    role: AgentRole

    # Preferred model for this role.  May be overridden by the router when the
    # user only has certain API keys available.
    preferred_model: Llm = Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL

    # Fallback model if the preferred one's API key is missing.
    fallback_model: Optional[Llm] = None

    # Weight of this agent's score in the consensus calculation (0.0–1.0).
    consensus_weight: float = 1.0

    # If True this agent runs in the critique/debate phase (reviews code
    # produced by the Coder).  If False it runs as a pipeline stage that
    # transforms data before the Coder.
    is_critic: bool = True

    # If True this agent's critique can veto the entire output and force a
    # regeneration pass.
    can_veto: bool = False


# ---------------------------------------------------------------------------
# Default agent specs — used by the router when assembling pipelines.
# ---------------------------------------------------------------------------

VISION_AGENT = AgentSpec(
    role=AgentRole.VISION,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_HIGH,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=0.8,
    is_critic=False,  # produces structured analysis, doesn't critique code
)

CODER_AGENT = AgentSpec(
    role=AgentRole.CODER,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_HIGH,
    consensus_weight=0.0,  # the coder produces code, doesn't score it
    is_critic=False,
)

ACCESSIBILITY_AGENT = AgentSpec(
    role=AgentRole.ACCESSIBILITY,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=1.0,
    is_critic=True,
    can_veto=True,  # critical A11y failures should block output
)

PERFORMANCE_AGENT = AgentSpec(
    role=AgentRole.PERFORMANCE,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=0.8,
    is_critic=True,
)

UX_AGENT = AgentSpec(
    role=AgentRole.UX,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=0.9,
    is_critic=True,
)

ANIMATION_AGENT = AgentSpec(
    role=AgentRole.ANIMATION,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=0.6,
    is_critic=True,
)

SECURITY_AGENT = AgentSpec(
    role=AgentRole.SECURITY,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL,
    fallback_model=Llm.GPT_5_5_LOW,
    consensus_weight=1.0,
    is_critic=True,
    can_veto=True,  # security issues should block output
)

REVIEWER_AGENT = AgentSpec(
    role=AgentRole.REVIEWER,
    preferred_model=Llm.GEMINI_3_FLASH_PREVIEW_HIGH,
    fallback_model=Llm.GPT_5_5_HIGH,
    consensus_weight=1.5,  # senior reviewer has extra weight
    is_critic=True,
    can_veto=True,
)


# Master registry — importable by the router.
ALL_AGENTS: dict[AgentRole, AgentSpec] = {
    AgentRole.VISION: VISION_AGENT,
    AgentRole.CODER: CODER_AGENT,
    AgentRole.ACCESSIBILITY: ACCESSIBILITY_AGENT,
    AgentRole.PERFORMANCE: PERFORMANCE_AGENT,
    AgentRole.UX: UX_AGENT,
    AgentRole.ANIMATION: ANIMATION_AGENT,
    AgentRole.SECURITY: SECURITY_AGENT,
    AgentRole.REVIEWER: REVIEWER_AGENT,
}
