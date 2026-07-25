"""Top-level orchestrated generation pipeline.

Replaces the simple consensus engine with a true multi-agent system:
  1. Route the request → select specialist pipeline.
  2. Run Vision Agent (if applicable) → extract structured UI understanding.
  3. Run Coder Agent → generate initial code.
  4. Run specialist critics in parallel → collect structured critiques.
  5. Run debate rounds if quality threshold not met.
  6. Run Senior Reviewer final pass.
  7. Return consensus output + telemetry.
"""

from __future__ import annotations

import asyncio
import json
import time
import traceback
import uuid
from typing import Any, Callable, Coroutine, Dict, List, Optional, cast

import openai
from openai.types.chat import ChatCompletionMessageParam

from agent.runner import Agent
from llm import Llm, MODEL_PROVIDER, GEMINI_MODELS, OPENAI_MODELS, ANTHROPIC_MODELS
from orchestration.agent_roles import (
    AGENT_DISPLAY,
    AgentRole,
    AgentSpec,
)
from orchestration.debate import (
    CritiqueResult,
    DebateResult,
    DebateRound,
    SendFn,
    _build_critique_messages,
    _build_refinement_messages,
    check_vetoes,
    compute_weighted_score,
    parse_critique_response,
)
from orchestration.router import PipelineSpec, classify_request
from orchestration.specialist_prompts import get_specialist_prompt
from orchestration.telemetry import OrchestrationTelemetry, AgentTurnRecord


class OrchestratedPipeline:
    """Multi-agent orchestrated code generation pipeline."""

    def __init__(
        self,
        send_message: SendFn,
        openai_api_key: Optional[str],
        openai_base_url: Optional[str],
        anthropic_api_key: Optional[str],
        gemini_api_key: Optional[str],
        replicate_api_key: Optional[str],
        should_generate_images: bool,
        should_extract_assets: bool,
        file_state: Optional[Dict[str, str]],
        asset_base_url: str,
        option_codes: Optional[List[str]],
        quality_threshold: float = 6.5,
        max_debate_rounds: int = 2,
    ):
        self.send_message = send_message
        self.openai_api_key = openai_api_key
        self.openai_base_url = openai_base_url
        self.anthropic_api_key = anthropic_api_key
        self.gemini_api_key = gemini_api_key
        self.replicate_api_key = replicate_api_key
        self.should_generate_images = should_generate_images
        self.should_extract_assets = should_extract_assets
        self.file_state = file_state
        self.asset_base_url = asset_base_url
        self.option_codes = option_codes or []
        self.quality_threshold = quality_threshold
        self.max_debate_rounds = max_debate_rounds

        self._telemetry = OrchestrationTelemetry(run_id=str(uuid.uuid4()))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def process_variants(
        self,
        variant_models: List[Llm],
        prompt_messages: List[ChatCompletionMessageParam],
    ) -> Dict[int, str]:
        """Run the orchestrated pipeline and return variant completions."""
        start_time = time.monotonic()

        # Extract the user's text prompt for routing.
        prompt_text = self._extract_prompt_text(prompt_messages)
        has_images = self._has_images(prompt_messages)
        input_mode = "image" if has_images else "text"

        # Stage 1: Route the request.
        await self._send_pipeline_stage("routing")
        pipeline_spec = classify_request(
            input_mode=input_mode,
            prompt_text=prompt_text,
            has_images=has_images,
            has_video=False,  # TODO: detect video from prompt_messages
            quality_threshold=self.quality_threshold,
            max_debate_rounds=self.max_debate_rounds,
        )
        self._telemetry.pipeline_complexity = pipeline_spec.complexity.value
        self._telemetry.agents_used = [s.role.value for s in pipeline_spec.agent_specs]

        print(f"[ORCHESTRATION] Complexity: {pipeline_spec.complexity.value}")
        print(f"[ORCHESTRATION] Agents: {[s.role.value for s in pipeline_spec.agent_specs]}")
        print(f"[ORCHESTRATION] Quality threshold: {pipeline_spec.quality_threshold}")

        # Stage 2: Vision analysis (if Vision agent is in the pipeline).
        vision_analysis: Optional[str] = None
        if AgentRole.VISION in pipeline_spec.agent_roles:
            await self._send_pipeline_stage("vision")
            vision_analysis = await self._run_vision_agent(
                pipeline_spec, prompt_messages
            )

        # Stage 3: Code generation.
        await self._send_pipeline_stage("coding")
        initial_code = await self._run_coder_agent(
            pipeline_spec, prompt_messages, vision_analysis
        )

        if not initial_code:
            print("[ORCHESTRATION] Coder agent produced no code, falling back")
            return {}

        await self.send_message("setCode", initial_code, 0, None, None)

        # Stage 4: Critic debate (if there are critic agents).
        critics = pipeline_spec.critics
        # Exclude the Reviewer from debate critics — it runs separately at the end.
        debate_critics = [c for c in critics if c.role != AgentRole.REVIEWER]

        final_code = initial_code
        debate_result: Optional[DebateResult] = None

        if debate_critics:
            await self._send_pipeline_stage("debate")
            debate_result = await self._run_debate(
                code=initial_code,
                critics=debate_critics,
                pipeline_spec=pipeline_spec,
                prompt_text=prompt_text,
                prompt_messages=prompt_messages,
                vision_analysis=vision_analysis,
            )
            final_code = debate_result.final_code

            if debate_result.final_code != initial_code:
                await self.send_message("setCode", final_code, 0, None, None)

        # Stage 5: Senior Reviewer final pass.
        if AgentRole.REVIEWER in pipeline_spec.agent_roles:
            await self._send_pipeline_stage("review")
            reviewed_code = await self._run_reviewer(
                final_code,
                debate_result.rounds[-1].critiques if debate_result and debate_result.rounds else [],
                prompt_messages,
                pipeline_spec,
            )
            if reviewed_code:
                final_code = reviewed_code
                await self.send_message("setCode", final_code, 0, None, None)

        # Stage 6: Consensus.
        await self._send_pipeline_stage("consensus")

        # Record telemetry.
        self._telemetry.duration_ms = int((time.monotonic() - start_time) * 1000)
        self._telemetry.final_score = (
            debate_result.final_score if debate_result else 10.0
        )
        self._telemetry.debate_rounds = (
            len(debate_result.rounds) if debate_result else 0
        )
        self._telemetry.save()

        # Emit variantComplete.
        await self.send_message(
            "variantComplete", "Multi-agent consensus complete", 0, None, None
        )

        return {0: final_code}

    # ------------------------------------------------------------------
    # Internal stages
    # ------------------------------------------------------------------

    async def _run_vision_agent(
        self,
        pipeline_spec: PipelineSpec,
        prompt_messages: List[ChatCompletionMessageParam],
    ) -> Optional[str]:
        """Run the Vision Agent to extract structured UI analysis."""
        vision_spec = next(
            (s for s in pipeline_spec.agent_specs if s.role == AgentRole.VISION),
            None,
        )
        if not vision_spec:
            return None

        model = self._resolve_model(vision_spec)
        if not model:
            print("[ORCHESTRATION] No model available for Vision agent, skipping")
            return None

        await self._send_agent_start(AgentRole.VISION, model)

        vision_prompt = get_specialist_prompt(AgentRole.VISION)
        messages: List[ChatCompletionMessageParam] = [
            {"role": "system", "content": vision_prompt},
        ]
        # Carry over the user messages (which contain images).
        for msg in prompt_messages:
            if msg.get("role") == "user":
                messages.append(msg)
                break

        start = time.monotonic()
        try:
            result = await self._run_lightweight_llm(model, messages)
            duration_ms = int((time.monotonic() - start) * 1000)
            self._telemetry.agent_turns.append(AgentTurnRecord(
                agent_role=AgentRole.VISION.value,
                model=model.value,
                duration_ms=duration_ms,
            ))
            await self._send_agent_complete(AgentRole.VISION, model, score=None)
            return result
        except Exception as e:
            print(f"[ORCHESTRATION] Vision agent failed: {e}")
            traceback.print_exc()
            await self._send_agent_complete(AgentRole.VISION, model, score=None, error=str(e))
            return None

    async def _run_coder_agent(
        self,
        pipeline_spec: PipelineSpec,
        prompt_messages: List[ChatCompletionMessageParam],
        vision_analysis: Optional[str],
    ) -> str:
        """Run the Coder Agent to generate the initial code."""
        coder_spec = next(
            (s for s in pipeline_spec.agent_specs if s.role == AgentRole.CODER),
            None,
        )
        model = self._resolve_model(coder_spec) if coder_spec else self._best_available_model()
        if not model:
            raise Exception("No model available for code generation")

        await self._send_agent_start(AgentRole.CODER, model)

        # Build an augmented prompt if we have vision analysis.
        augmented_messages = list(prompt_messages)
        if vision_analysis:
            # Insert the vision analysis just before the last user message.
            vision_context = {
                "role": "user",
                "content": (
                    "## Vision Agent Analysis\n\n"
                    "The following is a structured analysis of the UI from a Vision Agent. "
                    "Use this to inform your code generation — match the detected components, "
                    "colors, typography, spacing, and layout.\n\n"
                    f"```json\n{vision_analysis}\n```"
                ),
            }
            # Insert before the last user message.
            last_user_idx = None
            for i in range(len(augmented_messages) - 1, -1, -1):
                if augmented_messages[i].get("role") == "user":
                    last_user_idx = i
                    break
            if last_user_idx is not None:
                augmented_messages.insert(last_user_idx, vision_context)
            else:
                augmented_messages.append(vision_context)

        start = time.monotonic()
        try:
            # Use the existing Agent tool-calling loop for full code generation.
            code = await self._run_agent_with_tools(model, augmented_messages)
            duration_ms = int((time.monotonic() - start) * 1000)
            self._telemetry.agent_turns.append(AgentTurnRecord(
                agent_role=AgentRole.CODER.value,
                model=model.value,
                duration_ms=duration_ms,
            ))
            await self._send_agent_complete(AgentRole.CODER, model, score=None)
            return code
        except Exception as e:
            print(f"[ORCHESTRATION] Coder agent failed: {e}")
            traceback.print_exc()
            await self._send_agent_complete(AgentRole.CODER, model, score=None, error=str(e))
            return ""

    async def _run_debate(
        self,
        code: str,
        critics: List[AgentSpec],
        pipeline_spec: PipelineSpec,
        prompt_text: str,
        prompt_messages: List[ChatCompletionMessageParam],
        vision_analysis: Optional[str],
    ) -> DebateResult:
        """Run iterative debate rounds with critic agents."""
        rounds: List[DebateRound] = []
        current_code = code

        for round_num in range(1, pipeline_spec.max_debate_rounds + 1):
            print(f"[ORCHESTRATION] Debate round {round_num}")

            # Run all critics in parallel.
            critiques = await self._run_critics_parallel(
                critics=critics,
                code=current_code,
                prompt_text=prompt_text,
                previous_critiques=rounds[-1].critiques if rounds else None,
            )

            weighted_score = compute_weighted_score(critiques, list(pipeline_spec.agent_specs))
            passed = weighted_score >= pipeline_spec.quality_threshold

            # Send debate round event to frontend.
            await self.send_message(
                "debateRound",
                None,
                0,
                {
                    "round": round_num,
                    "averageScore": round(weighted_score, 1),
                    "threshold": pipeline_spec.quality_threshold,
                    "passed": passed,
                    "critiques": [
                        {
                            "role": c.agent_role.value,
                            "score": c.score,
                            "approved": c.approved,
                            "summary": c.summary,
                            "issueCount": len(c.issues),
                        }
                        for c in critiques
                    ],
                },
                None,
            )

            round_result = DebateRound(
                round_number=round_num,
                critiques=critiques,
                weighted_score=weighted_score,
                passed_threshold=passed,
                code_at_start=current_code,
            )

            # Check for vetoes.
            veto_reason = check_vetoes(critiques, list(pipeline_spec.agent_specs))
            if veto_reason and round_num < pipeline_spec.max_debate_rounds:
                print(f"[ORCHESTRATION] Veto triggered: {veto_reason}")
                # Force a refinement pass.
                passed = False

            if passed:
                round_result.code_at_end = current_code
                rounds.append(round_result)
                print(f"[ORCHESTRATION] Consensus reached at round {round_num} (score: {weighted_score:.1f})")
                break

            # Refine: ask the coder to fix the issues.
            if round_num < pipeline_spec.max_debate_rounds:
                await self._send_pipeline_stage("refining")
                refined_code = await self._run_refinement(
                    current_code, critiques, prompt_text, prompt_messages
                )
                if refined_code and refined_code != current_code:
                    round_result.code_at_end = refined_code
                    current_code = refined_code
                    await self.send_message("setCode", current_code, 0, None, None)
                else:
                    round_result.code_at_end = current_code
            else:
                round_result.code_at_end = current_code

            rounds.append(round_result)

        final_score = rounds[-1].weighted_score if rounds else 0.0
        return DebateResult(
            final_code=current_code,
            rounds=rounds,
            final_score=final_score,
            passed=final_score >= pipeline_spec.quality_threshold,
            total_critiques=sum(len(r.critiques) for r in rounds),
        )

    async def _run_critics_parallel(
        self,
        critics: List[AgentSpec],
        code: str,
        prompt_text: str,
        previous_critiques: Optional[List[CritiqueResult]] = None,
    ) -> List[CritiqueResult]:
        """Run all critic agents in parallel."""
        tasks = []
        for spec in critics:
            tasks.append(self._run_single_critic(spec, code, prompt_text, previous_critiques))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        critiques: List[CritiqueResult] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"[ORCHESTRATION] Critic {critics[i].role.value} failed: {result}")
                # Insert a neutral critique so the pipeline doesn't stall.
                critiques.append(CritiqueResult(
                    agent_role=critics[i].role,
                    score=6.0,
                    approved=True,
                    summary=f"Agent failed: {str(result)[:100]}",
                    issues=[],
                    suggestions=[],
                    strengths=[],
                ))
            else:
                critiques.append(result)
        return critiques

    async def _run_single_critic(
        self,
        spec: AgentSpec,
        code: str,
        prompt_text: str,
        previous_critiques: Optional[List[CritiqueResult]] = None,
    ) -> CritiqueResult:
        """Run a single critic agent."""
        model = self._resolve_model(spec)
        if not model:
            return CritiqueResult(
                agent_role=spec.role,
                score=6.0,
                approved=True,
                summary="No model available for this agent",
                issues=[], suggestions=[], strengths=[],
            )

        await self._send_agent_start(spec.role, model)

        messages = _build_critique_messages(
            spec.role, code, prompt_text, previous_critiques
        )

        start = time.monotonic()
        try:
            raw_response = await self._run_lightweight_llm(model, messages)
            duration_ms = int((time.monotonic() - start) * 1000)

            critique = parse_critique_response(spec.role, raw_response)

            self._telemetry.agent_turns.append(AgentTurnRecord(
                agent_role=spec.role.value,
                model=model.value,
                duration_ms=duration_ms,
                score=critique.score,
            ))

            await self._send_agent_complete(spec.role, model, score=critique.score)
            await self._send_agent_critique(critique)

            return critique
        except Exception as e:
            print(f"[ORCHESTRATION] Critic {spec.role.value} error: {e}")
            traceback.print_exc()
            await self._send_agent_complete(spec.role, model, score=None, error=str(e))
            return CritiqueResult(
                agent_role=spec.role,
                score=6.0,
                approved=True,
                summary=f"Error: {str(e)[:100]}",
                issues=[], suggestions=[], strengths=[],
            )

    async def _run_refinement(
        self,
        code: str,
        critiques: List[CritiqueResult],
        prompt_text: str,
        prompt_messages: List[ChatCompletionMessageParam],
    ) -> Optional[str]:
        """Ask the Coder agent to refine code based on critiques."""
        model = self._best_available_model()
        if not model:
            return None

        await self._send_agent_start(AgentRole.CODER, model)

        messages = _build_refinement_messages(code, critiques, prompt_text)

        start = time.monotonic()
        try:
            refined = await self._run_agent_with_tools(model, messages)
            duration_ms = int((time.monotonic() - start) * 1000)
            self._telemetry.agent_turns.append(AgentTurnRecord(
                agent_role="coder_refinement",
                model=model.value,
                duration_ms=duration_ms,
            ))
            await self._send_agent_complete(AgentRole.CODER, model, score=None)
            return refined
        except Exception as e:
            print(f"[ORCHESTRATION] Refinement failed: {e}")
            await self._send_agent_complete(AgentRole.CODER, model, score=None, error=str(e))
            return None

    async def _run_reviewer(
        self,
        code: str,
        critiques: List[CritiqueResult],
        prompt_messages: List[ChatCompletionMessageParam],
        pipeline_spec: PipelineSpec,
    ) -> Optional[str]:
        """Run the Senior Reviewer as the final pass."""
        reviewer_spec = next(
            (s for s in pipeline_spec.agent_specs if s.role == AgentRole.REVIEWER),
            None,
        )
        if not reviewer_spec:
            return None

        model = self._resolve_model(reviewer_spec)
        if not model:
            return None

        await self._send_agent_start(AgentRole.REVIEWER, model)

        reviewer_prompt = get_specialist_prompt(AgentRole.REVIEWER)

        critique_summary = ""
        for c in critiques:
            display = AGENT_DISPLAY.get(c.agent_role, {})
            name = display.get("name", c.agent_role.value)
            critique_summary += f"\n### {name} — Score: {c.score}/10\n"
            critique_summary += f"{c.summary}\n"
            for issue in c.issues[:3]:
                critique_summary += f"- [{issue.get('severity')}] {issue.get('problem', '')}\n"

        messages: List[ChatCompletionMessageParam] = [
            {"role": "system", "content": reviewer_prompt},
            {
                "role": "user",
                "content": (
                    f"## Code to Review\n\n```html\n{code}\n```\n\n"
                    f"## Specialist Agent Critiques\n{critique_summary}\n\n"
                    "Apply fixes and output the final production-ready code using the `create_file` tool."
                ),
            },
        ]

        start = time.monotonic()
        try:
            reviewed = await self._run_agent_with_tools(model, messages)
            duration_ms = int((time.monotonic() - start) * 1000)
            self._telemetry.agent_turns.append(AgentTurnRecord(
                agent_role=AgentRole.REVIEWER.value,
                model=model.value,
                duration_ms=duration_ms,
            ))
            await self._send_agent_complete(AgentRole.REVIEWER, model, score=None)
            return reviewed if reviewed else None
        except Exception as e:
            print(f"[ORCHESTRATION] Reviewer failed: {e}")
            await self._send_agent_complete(AgentRole.REVIEWER, model, score=None, error=str(e))
            return None

    # ------------------------------------------------------------------
    # Agent execution helpers
    # ------------------------------------------------------------------

    async def _run_agent_with_tools(
        self,
        model: Llm,
        messages: List[ChatCompletionMessageParam],
    ) -> str:
        """Run an agent with the full tool-calling loop (uses existing AgentEngine)."""
        code_result = ""

        async def capture_send(
            type: str,
            value: Optional[str],
            variant_index: int,
            data: Optional[Dict[str, Any]],
            event_id: Optional[str],
        ) -> None:
            nonlocal code_result
            if type == "setCode" and value:
                code_result = value
            # Don't forward variantComplete — we manage that at the pipeline level.
            if type in ("variantComplete", "variantError"):
                return
            # Forward other events (status, thinking, etc.) to the real send.
            await self.send_message(type, value, 0, data, event_id)

        runner = Agent(
            send_message=capture_send,
            variant_index=0,
            openai_api_key=self.openai_api_key,
            openai_base_url=self.openai_base_url,
            anthropic_api_key=self.anthropic_api_key,
            gemini_api_key=self.gemini_api_key,
            replicate_api_key=self.replicate_api_key,
            should_generate_images=self.should_generate_images,
            should_extract_assets=self.should_extract_assets,
            asset_base_url=self.asset_base_url,
            initial_file_state=self.file_state,
            option_codes=self.option_codes,
        )
        result = await runner.run(model, messages)
        return result or code_result

    async def _run_lightweight_llm(
        self,
        model: Llm,
        messages: List[ChatCompletionMessageParam],
    ) -> str:
        """Run a lightweight LLM call without the tool-calling loop.

        Used for critic agents that just need to return a JSON analysis.
        """
        provider = MODEL_PROVIDER.get(model, "")

        if provider == "gemini":
            return await self._run_gemini_simple(model, messages)
        elif provider == "openai":
            return await self._run_openai_simple(model, messages)
        elif provider == "anthropic":
            return await self._run_anthropic_simple(model, messages)
        else:
            raise ValueError(f"No lightweight runner for provider: {provider}")

    async def _run_gemini_simple(
        self, model: Llm, messages: List[ChatCompletionMessageParam]
    ) -> str:
        """Simple Gemini call without tools."""
        from google import genai
        from google.genai import types

        if not self.gemini_api_key:
            raise Exception("Gemini API key missing")

        client = genai.Client(api_key=self.gemini_api_key)

        # Separate system and user messages.
        system_text = ""
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                # Extract text from content parts.
                text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                content = "\n".join(text_parts)
            if role == "system":
                system_text = str(content)
            else:
                contents.append(types.Content(
                    role="user" if role == "user" else "model",
                    parts=[types.Part(text=str(content))],
                ))

        config = types.GenerateContentConfig(
            system_instruction=system_text,
            temperature=0.3,  # lower temperature for structured critique output
            max_output_tokens=4000,
        )

        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=config,
        )

        return response.text or ""

    async def _run_openai_simple(
        self, model: Llm, messages: List[ChatCompletionMessageParam]
    ) -> str:
        """Simple OpenAI call without tools."""
        from openai import AsyncOpenAI
        from llm import get_openai_api_name, get_openai_reasoning_effort

        if not self.openai_api_key:
            raise Exception("OpenAI API key missing")

        client = AsyncOpenAI(api_key=self.openai_api_key, base_url=self.openai_base_url)
        api_name = get_openai_api_name(model)
        reasoning = get_openai_reasoning_effort(model)

        kwargs: Dict[str, Any] = {
            "model": api_name,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 4000,
        }
        if reasoning and reasoning != "none":
            kwargs["reasoning_effort"] = reasoning

        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    async def _run_anthropic_simple(
        self, model: Llm, messages: List[ChatCompletionMessageParam]
    ) -> str:
        """Simple Anthropic call without tools."""
        from anthropic import AsyncAnthropic

        if not self.anthropic_api_key:
            raise Exception("Anthropic API key missing")

        client = AsyncAnthropic(api_key=self.anthropic_api_key)

        # Separate system prompt.
        system_text = ""
        user_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                content = "\n".join(text_parts)
            if role == "system":
                system_text = str(content)
            else:
                user_messages.append({"role": role, "content": str(content)})

        # Anthropic requires alternating user/assistant messages.
        if not user_messages:
            user_messages = [{"role": "user", "content": "Please proceed."}]

        from agent.providers.anthropic.provider import _get_anthropic_api_model_name
        api_name = _get_anthropic_api_model_name(model)

        response = await client.messages.create(
            model=api_name,
            system=system_text,
            messages=user_messages,  # type: ignore
            max_tokens=4000,
            temperature=0.3,
        )

        return response.content[0].text if response.content else ""

    # ------------------------------------------------------------------
    # Model resolution
    # ------------------------------------------------------------------

    def _resolve_model(self, spec: AgentSpec) -> Optional[Llm]:
        """Pick the best available model for the given agent spec."""
        if self._model_available(spec.preferred_model):
            return spec.preferred_model
        if spec.fallback_model and self._model_available(spec.fallback_model):
            return spec.fallback_model
        return self._best_available_model()

    def _model_available(self, model: Llm) -> bool:
        """Check if we have an API key for this model."""
        provider = MODEL_PROVIDER.get(model, "")
        if provider == "gemini":
            return bool(self.gemini_api_key)
        if provider == "openai":
            return bool(self.openai_api_key)
        if provider == "anthropic":
            return bool(self.anthropic_api_key)
        return False

    def _best_available_model(self) -> Optional[Llm]:
        """Return the best model we have a key for."""
        if self.gemini_api_key:
            return Llm.GEMINI_3_FLASH_PREVIEW_MINIMAL
        if self.openai_api_key:
            return Llm.GPT_5_5_LOW
        if self.anthropic_api_key:
            return Llm.CLAUDE_SONNET_4_6
        return None

    # ------------------------------------------------------------------
    # Message helpers
    # ------------------------------------------------------------------

    async def _send_pipeline_stage(self, stage: str) -> None:
        """Notify the frontend of a pipeline stage transition."""
        await self.send_message("pipelineStage", stage, 0, {"stage": stage}, None)

    async def _send_agent_start(self, role: AgentRole, model: Llm) -> None:
        display = AGENT_DISPLAY.get(role, {})
        await self.send_message(
            "agentStart",
            display.get("name", role.value),
            0,
            {
                "agentRole": role.value,
                "agentName": display.get("name", role.value),
                "model": model.value,
                "icon": display.get("icon", "🤖"),
                "color": display.get("color", "#6B7280"),
            },
            None,
        )

    async def _send_agent_complete(
        self, role: AgentRole, model: Llm, score: Optional[float], error: Optional[str] = None
    ) -> None:
        display = AGENT_DISPLAY.get(role, {})
        await self.send_message(
            "agentComplete",
            display.get("name", role.value),
            0,
            {
                "agentRole": role.value,
                "agentName": display.get("name", role.value),
                "score": score,
                "approved": score is not None and score >= 6.0,
                "error": error,
            },
            None,
        )

    async def _send_agent_critique(self, critique: CritiqueResult) -> None:
        display = AGENT_DISPLAY.get(critique.agent_role, {})
        await self.send_message(
            "agentCritique",
            display.get("name", critique.agent_role.value),
            0,
            {
                "agentRole": critique.agent_role.value,
                "score": critique.score,
                "approved": critique.approved,
                "summary": critique.summary,
                "issues": critique.issues[:5],
                "suggestions": critique.suggestions[:3],
                "strengths": critique.strengths[:3],
            },
            None,
        )

    # ------------------------------------------------------------------
    # Prompt extraction
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_prompt_text(
        messages: List[ChatCompletionMessageParam],
    ) -> str:
        """Extract the user's text prompt from the message list."""
        for msg in reversed(messages):
            if msg.get("role") != "user":
                continue
            content = msg.get("content", "")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                texts = []
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        texts.append(part.get("text", ""))
                return " ".join(texts)
        return ""

    @staticmethod
    def _has_images(messages: List[ChatCompletionMessageParam]) -> bool:
        """Check if any message contains image data."""
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "image_url":
                        return True
        return False
