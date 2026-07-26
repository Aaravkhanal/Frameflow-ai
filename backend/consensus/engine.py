import asyncio
import traceback
from typing import Any, Callable, Coroutine, Dict, List, Literal, cast

import openai
from openai.types.chat import ChatCompletionMessageParam

from agent.runner import Agent
from custom_types import InputMode
from llm import Llm

MessageType = Literal[
    "search", "search_complete", "status", "setCode", "variantComplete", "error"
]


class ConsensusGenerationStage:
    """Handles agent tool-calling generation using a multi-model consensus approach."""

    def __init__(
        self,
        send_message: Callable[
            [MessageType, str | None, int, Dict[str, Any] | None, str | None],
            Coroutine[Any, Any, None],
        ],
        openai_api_key: str | None,
        openai_base_url: str | None,
        anthropic_api_key: str | None,
        gemini_api_key: str | None,
        replicate_api_key: str | None,
        should_generate_images: bool,
        file_state: Dict[str, str] | None,
        asset_base_url: str,
        option_codes: List[str] | None,
        should_extract_assets: bool = True,
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

    async def process_variants(
        self,
        variant_models: List[Llm],
        prompt_messages: List[ChatCompletionMessageParam],
    ) -> Dict[int, str]:
        """
        Runs the consensus pipeline:
        1. Parallel generation of drafts by multiple models.
        2. Synthesis by a judge model to combine the best aspects.
        """
        # We need at least 2 models for consensus to make sense, but we'll adapt to however many are passed.
        # If there's only 1 model, just run it normally.
        if len(variant_models) == 1:
            return {0: await self._run_agent(0, variant_models[0], prompt_messages)}

        print(f"[CONSENSUS] Starting pipeline with {len(variant_models)} models")

        # Step 1: Parallel Drafting
        # Tell the frontend what's happening
        await self.send_message("status", "Phase 1: Generating independent drafts...", 0, None, None)

        draft_tasks: List[asyncio.Task[str]] = []
        for index, model in enumerate(variant_models):
            # We don't send the draft code to the frontend yet, so we intercept the messages
            draft_tasks.append(
                asyncio.create_task(
                    self._run_agent(index, model, prompt_messages, intercept_set_code=True)
                )
            )

        drafts = await asyncio.gather(*draft_tasks, return_exceptions=True)
        valid_drafts: List[str] = []
        for i, draft in enumerate(drafts):
            if isinstance(draft, BaseException) or not draft:
                print(f"[CONSENSUS] Model {i+1} failed to generate a draft: {draft}")
            else:
                valid_drafts.append(draft)

        if not valid_drafts:
            raise Exception("All models failed during the drafting phase.")

        if len(valid_drafts) == 1:
            print("[CONSENSUS] Only 1 valid draft generated. Skipping synthesis.")
            await self.send_message("setCode", valid_drafts[0], 0, None, None)
            await self.send_message("variantComplete", "Variant generation complete", 0, None, None)
            return {0: valid_drafts[0]}

        # Step 2: Synthesis Phase
        await self.send_message("status", "Phase 2: Synthesizing final consensus...", 0, None, None)
        print("[CONSENSUS] Starting synthesis phase...")

        synthesis_prompt = self._build_synthesis_prompt(prompt_messages, valid_drafts)

        # Use the first model (usually the primary/best model) as the judge
        judge_model = variant_models[0]
        
        # We send the synthesized code to variant index 0
        final_code = await self._run_agent(
            index=0,
            model=judge_model,
            prompt_messages=synthesis_prompt,
            intercept_set_code=False,
            is_synthesis=True
        )

        await self.send_message("status", "Phase 3: Evaluating Quality & Fidelity...", 0, None, None)
        try:
            from consensus.quality_scorer import evaluate_code_quality
            quality_result = await evaluate_code_quality(
                code=final_code,
                original_prompt=str(original_prompt),
                model=judge_model,
                api_key=self.openai_api_key or self.anthropic_api_key or self.gemini_api_key or "",
                base_url=self.openai_base_url
            )
            await self.send_message(
                "qualityScore", 
                None, 
                0, 
                {"score": quality_result.score, "feedback": quality_result.feedback}, 
                None
            )
            print(f"[CONSENSUS] Final Code Quality Score: {quality_result.score}/100")
            if quality_result.score < 75:
                await self.send_message("status", f"Warning: Quality score {quality_result.score}/100 is below threshold (75).", 0, None, None)
        except Exception as e:
            print(f"[CONSENSUS] Quality scoring failed: {e}")

        await self.send_message("variantComplete", "Consensus synthesis complete", 0, None, None)
        return {0: final_code}

    def _build_synthesis_prompt(
        self, original_prompt: List[ChatCompletionMessageParam], drafts: List[str]
    ) -> List[ChatCompletionMessageParam]:
        """Creates the prompt for the judge model to synthesize the drafts."""
        
        synthesis_messages = list(original_prompt)
        
        drafts_text = "Here are several independent drafts generated by different expert AI models for the same request:\n\n"
        for i, draft in enumerate(drafts):
            drafts_text += f"=== DRAFT {i+1} ===\n{draft}\n\n"
            
        drafts_text += (
            "Your task is to act as a Principal Staff Engineer and synthesize these drafts into a single, perfect final result. "
            "Analyze the strengths and weaknesses of each draft. Combine the best architectural choices, UI design, and functionality. "
            "Ensure the final output strictly follows all original system instructions (e.g., single file HTML, Tailwind if applicable, etc). "
            "Output ONLY the final merged code."
        )
        
        synthesis_messages.append({
            "role": "user",
            "content": drafts_text
        })
        
        return synthesis_messages

    async def _run_agent(
        self,
        index: int,
        model: Llm,
        prompt_messages: List[ChatCompletionMessageParam],
        intercept_set_code: bool = False,
        is_synthesis: bool = False
    ) -> str:
        try:
            async def send_runner_message(
                type: str,
                value: str | None,
                variant_index: int,
                data: Dict[str, Any] | None,
                event_id: str | None,
            ) -> None:
                if type == "setCode" and intercept_set_code:
                    # Do not broadcast the intermediate drafts to the frontend editor
                    return
                if type == "variantComplete" and intercept_set_code:
                    return
                    
                # For status messages during drafting, prefix them so the user knows
                if type == "status" and not is_synthesis:
                    value = f"[Drafting Model {index + 1}] {value}"
                    
                await self.send_message(
                    cast(MessageType, type),
                    value,
                    0 if is_synthesis else variant_index,
                    data,
                    event_id,
                )

            runner = Agent(
                send_message=send_runner_message,
                variant_index=index,
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
            completion = await runner.run(model, prompt_messages)
            if completion and not intercept_set_code:
                await self.send_message("setCode", completion, 0 if is_synthesis else index, None, None)
            return completion
        except openai.AuthenticationError as e:
            print(f"[VARIANT {index + 1}] OpenAI Authentication failed", e)
            return ""
        except openai.NotFoundError as e:
            print(f"[VARIANT {index + 1}] OpenAI Model not found", e)
            return ""
        except openai.RateLimitError as e:
            print(f"[VARIANT {index + 1}] OpenAI Rate limit exceeded", e)
            return ""
        except Exception as e:
            print(f"Error in variant {index + 1}: {e}")
            traceback.print_exception(type(e), e, e.__traceback__)
            return ""
