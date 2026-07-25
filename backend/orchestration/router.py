"""Intelligent request router for the multi-agent orchestration engine.

Classifies every incoming generation request and selects the optimal pipeline
of specialist agents.  Simple prompts get a fast, lean pipeline (Coder +
Reviewer).  Complex inputs like multi-section dashboards get the full suite.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from orchestration.agent_roles import (
    ACCESSIBILITY_AGENT,
    ANIMATION_AGENT,
    CODER_AGENT,
    PERFORMANCE_AGENT,
    REVIEWER_AGENT,
    SECURITY_AGENT,
    UX_AGENT,
    VISION_AGENT,
    AgentRole,
    AgentSpec,
)


class InputComplexity(str, Enum):
    """Estimated complexity of the generation request."""

    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    ENTERPRISE = "enterprise"


@dataclass(frozen=True)
class PipelineSpec:
    """Describes which agents participate and how the pipeline runs."""

    complexity: InputComplexity

    # Ordered list of agent specs.  The orchestrator runs them in this order,
    # but may parallelise the critic agents.
    agent_specs: tuple[AgentSpec, ...]

    # Quality threshold — minimum weighted average score to accept the output.
    quality_threshold: float = 6.5

    # Maximum debate/refinement rounds.
    max_debate_rounds: int = 2

    @property
    def agent_roles(self) -> List[AgentRole]:
        return [s.role for s in self.agent_specs]

    @property
    def critics(self) -> List[AgentSpec]:
        return [s for s in self.agent_specs if s.is_critic]

    @property
    def producers(self) -> List[AgentSpec]:
        return [s for s in self.agent_specs if not s.is_critic]


# ---------------------------------------------------------------------------
# Complexity heuristics
# ---------------------------------------------------------------------------

# Keywords/phrases that hint at a complex request.
_COMPLEX_KEYWORDS = {
    "dashboard", "admin", "saas", "ecommerce", "e-commerce",
    "multi-page", "multi page", "authentication", "login",
    "sign up", "signup", "checkout", "cart", "payment",
    "analytics", "chart", "graph", "data table", "kanban",
    "calendar", "scheduling", "drag and drop", "real-time",
    "responsive", "mobile", "tablet", "desktop", "dark mode",
    "theme", "design system",
}

_ANIMATION_KEYWORDS = {
    "animation", "animate", "transition", "scroll effect",
    "parallax", "hover effect", "loading animation",
    "skeleton", "framer motion", "gsap", "lottie",
    "slide in", "fade in", "bounce", "pulse", "spin",
}

_ENTERPRISE_KEYWORDS = {
    "enterprise", "production", "full stack", "fullstack",
    "complete", "comprehensive", "professional", "advanced",
    "complex", "multi-section", "entire", "everything",
}


def _estimate_complexity(
    input_mode: str,
    prompt_text: str,
    has_images: bool,
    has_video: bool,
) -> InputComplexity:
    """Classify the request complexity from the input metadata."""
    prompt_lower = prompt_text.lower()
    prompt_len = len(prompt_text)

    # Video always gets at least MODERATE
    if has_video:
        return InputComplexity.COMPLEX

    # Check for enterprise keywords
    enterprise_hits = sum(1 for kw in _ENTERPRISE_KEYWORDS if kw in prompt_lower)
    if enterprise_hits >= 2 or prompt_len > 1500:
        return InputComplexity.ENTERPRISE

    # Check for complex keywords
    complex_hits = sum(1 for kw in _COMPLEX_KEYWORDS if kw in prompt_lower)
    if complex_hits >= 3 or (has_images and complex_hits >= 1):
        return InputComplexity.COMPLEX

    # Images add complexity
    if has_images:
        if prompt_len > 200 or complex_hits >= 1:
            return InputComplexity.COMPLEX
        return InputComplexity.MODERATE

    # Text-only
    if complex_hits >= 1 or prompt_len > 500:
        return InputComplexity.MODERATE

    return InputComplexity.SIMPLE


def _needs_animation_agents(prompt_text: str) -> bool:
    """Detect if animation expertise is warranted."""
    prompt_lower = prompt_text.lower()
    return any(kw in prompt_lower for kw in _ANIMATION_KEYWORDS)


# ---------------------------------------------------------------------------
# Pipeline assembly
# ---------------------------------------------------------------------------

# Pre-defined pipeline templates by complexity.
_PIPELINES: dict[InputComplexity, tuple[AgentSpec, ...]] = {
    InputComplexity.SIMPLE: (
        CODER_AGENT,
        REVIEWER_AGENT,
    ),
    InputComplexity.MODERATE: (
        CODER_AGENT,
        ACCESSIBILITY_AGENT,
        UX_AGENT,
        REVIEWER_AGENT,
    ),
    InputComplexity.COMPLEX: (
        VISION_AGENT,
        CODER_AGENT,
        ACCESSIBILITY_AGENT,
        PERFORMANCE_AGENT,
        UX_AGENT,
        REVIEWER_AGENT,
    ),
    InputComplexity.ENTERPRISE: (
        VISION_AGENT,
        CODER_AGENT,
        ACCESSIBILITY_AGENT,
        PERFORMANCE_AGENT,
        UX_AGENT,
        SECURITY_AGENT,
        REVIEWER_AGENT,
    ),
}


def classify_request(
    input_mode: str,
    prompt_text: str,
    has_images: bool,
    has_video: bool,
    *,
    quality_threshold: float = 6.5,
    max_debate_rounds: int = 2,
) -> PipelineSpec:
    """Classify a generation request and return the pipeline specification.

    Parameters
    ----------
    input_mode : str
        One of "image", "video", "text".
    prompt_text : str
        The user's text prompt.
    has_images : bool
        Whether the request includes screenshot/image data.
    has_video : bool
        Whether the request includes screen recording data.
    quality_threshold : float
        Minimum weighted average score to accept output.
    max_debate_rounds : int
        Maximum debate/refinement iterations.

    Returns
    -------
    PipelineSpec
        The assembled pipeline for this request.
    """
    complexity = _estimate_complexity(input_mode, prompt_text, has_images, has_video)

    agents = list(_PIPELINES[complexity])

    # Dynamically inject animation agent when warranted.
    if _needs_animation_agents(prompt_text):
        # Insert before reviewer (always last).
        reviewer_idx = next(
            (i for i, a in enumerate(agents) if a.role == AgentRole.REVIEWER),
            len(agents),
        )
        if ANIMATION_AGENT not in agents:
            agents.insert(reviewer_idx, ANIMATION_AGENT)

    # Adjust quality threshold by complexity.
    thresholds = {
        InputComplexity.SIMPLE: max(quality_threshold - 1.0, 4.0),
        InputComplexity.MODERATE: quality_threshold,
        InputComplexity.COMPLEX: quality_threshold,
        InputComplexity.ENTERPRISE: min(quality_threshold + 0.5, 9.0),
    }

    return PipelineSpec(
        complexity=complexity,
        agent_specs=tuple(agents),
        quality_threshold=thresholds[complexity],
        max_debate_rounds=max_debate_rounds,
    )
