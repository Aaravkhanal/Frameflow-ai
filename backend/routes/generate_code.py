import asyncio
import os
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import traceback
from typing import Callable, Awaitable
from fastapi import APIRouter, WebSocket
import openai
from starlette.websockets import WebSocketDisconnect
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError
from config import (
    ANTHROPIC_API_KEY,
    GEMINI_API_KEY,
    IS_DEBUG_ENABLED,
    IS_PROD,
    NUM_VARIANTS,
    NUM_VARIANTS_VIDEO,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    REPLICATE_API_KEY,
    CONSENSUS_ENABLED,
    ORCHESTRATION_ENABLED,
    ORCHESTRATION_QUALITY_THRESHOLD,
    ORCHESTRATION_MAX_DEBATE_ROUNDS,
)
from consensus.engine import ConsensusGenerationStage
from custom_types import InputMode
from llm import (
    Llm,
)
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    List,
    Literal,
    cast,
    get_args,
)
from openai.types.chat import ChatCompletionMessageParam

from utils import print_prompt_preview

from core.pipeline import (
    MessageType,
    PipelineContext,
    Middleware,
    Pipeline,
    WebSocketCommunicator,
)
from core.errors import format_llm_generation_error

from prompts.request_parsing import parse_prompt_content, parse_prompt_history
from prompts.prompt_types import PromptHistoryMessage, Stack, UserTurnInput
from uploaded_assets import (
    append_uploaded_asset_ids_to_history,
    append_uploaded_asset_ids_to_prompt,
    infer_local_asset_base_url,
)
from agent.runner import Agent
from routes.model_choice_sets import (
    ALL_KEYS_MODELS_DEFAULT,
    ALL_KEYS_MODELS_TEXT_CREATE,
    ALL_KEYS_MODELS_UPDATE,
    ANTHROPIC_ONLY_MODELS,
    GEMINI_ANTHROPIC_MODELS,
    GEMINI_OPENAI_MODELS,
    GEMINI_ONLY_MODELS,
    OPENAI_ANTHROPIC_MODELS,
    OPENAI_ONLY_MODELS,
    VIDEO_VARIANT_MODELS,
)

from ws.constants import APP_ERROR_WEB_SOCKET_CODE  # type: ignore

router = APIRouter()


@dataclass
class ExtractedParams:
    stack: Stack
    input_mode: InputMode
    should_generate_images: bool
    openai_api_key: str | None
    anthropic_api_key: str | None
    gemini_api_key: str | None
    replicate_api_key: str | None
    openai_base_url: str | None
    generation_type: Literal["create", "update"]
    prompt: UserTurnInput
    history: List[PromptHistoryMessage]
    file_state: Dict[str, str] | None
    option_codes: List[str]
    should_extract_assets: bool = True
    asset_base_url: str = ""
    design_system: str | None = None


class ParameterExtractionStage:
    """Handles parameter extraction and validation from WebSocket requests"""

    def __init__(
        self,
        throw_error: Callable[[str], Coroutine[Any, Any, None]],
        asset_base_url: str = "",
    ):
        self.throw_error = throw_error
        self.asset_base_url = asset_base_url

    async def extract_and_validate(self, params: Dict[str, Any]) -> ExtractedParams:
        """Extract and validate all parameters from the request"""
        # Read the code config settings (stack) from the request.
        generated_code_config = params.get("generatedCodeConfig", "")
        if generated_code_config not in get_args(Stack):
            await self.throw_error(
                f"Invalid generated code config: {generated_code_config}"
            )
            raise ValueError(f"Invalid generated code config: {generated_code_config}")
        validated_stack = cast(Stack, generated_code_config)

        # Validate the input mode
        input_mode = params.get("inputMode")
        if input_mode not in get_args(InputMode):
            await self.throw_error(f"Invalid input mode: {input_mode}")
            raise ValueError(f"Invalid input mode: {input_mode}")
        validated_input_mode = cast(InputMode, input_mode)

        openai_api_key = self._get_from_settings_dialog_or_env(
            params, "openAiApiKey", OPENAI_API_KEY
        )

        # If neither is provided, we throw an error later only if Claude is used.
        anthropic_api_key = self._get_from_settings_dialog_or_env(
            params, "anthropicApiKey", ANTHROPIC_API_KEY
        )
        gemini_api_key = self._get_from_settings_dialog_or_env(
            params, "geminiApiKey", GEMINI_API_KEY
        )
        replicate_api_key = self._get_from_settings_dialog_or_env(
            params, "replicateApiKey", REPLICATE_API_KEY
        )

        # Base URL for OpenAI API
        openai_base_url: str | None = None
        # Disable user-specified OpenAI Base URL in prod
        if not IS_PROD:
            openai_base_url = self._get_from_settings_dialog_or_env(
                params, "openAiBaseURL", OPENAI_BASE_URL
            )
        if not openai_base_url:
            print("Using official OpenAI URL")

        # Feature preferences default to enabled for older clients.
        should_generate_images = bool(params.get("isImageGenerationEnabled", True))
        should_extract_assets = bool(params.get("isAssetExtractionEnabled", True))

        # Extract and validate generation type
        generation_type = params.get("generationType", "create")
        if generation_type not in ["create", "update"]:
            await self.throw_error(f"Invalid generation type: {generation_type}")
            raise ValueError(f"Invalid generation type: {generation_type}")
        generation_type = cast(Literal["create", "update"], generation_type)

        # Extract prompt content
        prompt: UserTurnInput = parse_prompt_content(params.get("prompt"))

        # Extract history (default to empty list)
        history: List[PromptHistoryMessage] = parse_prompt_history(
            params.get("history")
        )

        prompt = append_uploaded_asset_ids_to_prompt(prompt, self.asset_base_url)
        history = append_uploaded_asset_ids_to_history(history, self.asset_base_url)

        # Extract file state for agent edits
        raw_file_state = params.get("fileState")
        file_state: Dict[str, str] | None = None
        if isinstance(raw_file_state, dict):
            content = raw_file_state.get("content")
            if isinstance(content, str) and content.strip():
                path = raw_file_state.get("path") or "index.html"
                file_state = {"path": path, "content": content}

        raw_option_codes = params.get("optionCodes")
        option_codes: List[str] = []
        if isinstance(raw_option_codes, list):
            for entry in raw_option_codes:
                if isinstance(entry, str):
                    option_codes.append(entry)
                elif entry is None:
                    option_codes.append("")
                else:
                    option_codes.append(str(entry))

        raw_design_system = params.get("designSystem")
        design_system = (
            raw_design_system.strip()
            if isinstance(raw_design_system, str) and raw_design_system.strip()
            else None
        )

        return ExtractedParams(
            stack=validated_stack,
            input_mode=validated_input_mode,
            should_generate_images=should_generate_images,
            should_extract_assets=should_extract_assets,
            openai_api_key=openai_api_key,
            anthropic_api_key=anthropic_api_key,
            gemini_api_key=gemini_api_key,
            replicate_api_key=replicate_api_key,
            openai_base_url=openai_base_url,
            generation_type=generation_type,
            prompt=prompt,
            history=history,
            file_state=file_state,
            option_codes=option_codes,
            asset_base_url=self.asset_base_url,
            design_system=design_system,
        )

    def _get_from_settings_dialog_or_env(
        self, params: dict[str, Any], key: str, env_var: str | None
    ) -> str | None:
        """Get value from client settings or environment variable"""
        value = params.get(key)
        if value:
            print(f"Using {key} from client-side settings dialog")
            return value

        if env_var:
            print(f"Using {key} from environment variable")
            return env_var

        return None


class ModelSelectionStage:
    """Handles selection of variant models based on available API keys and generation type"""

    def __init__(self, throw_error: Callable[[str], Coroutine[Any, Any, None]]):
        self.throw_error = throw_error

    async def select_models(
        self,
        generation_type: Literal["create", "update"],
        input_mode: InputMode,
        openai_api_key: str | None,
        anthropic_api_key: str | None,
        gemini_api_key: str | None = None,
    ) -> List[Llm]:
        """Select appropriate models based on available API keys"""
        try:
            num_variants = 2 if generation_type == "update" else NUM_VARIANTS
            variant_models = self._get_variant_models(
                generation_type,
                input_mode,
                num_variants,
                openai_api_key,
                anthropic_api_key,
                gemini_api_key,
            )

            # Print the variant models (one per line)
            print("Variant models:")
            for index, model in enumerate(variant_models):
                print(f"Variant {index + 1}: {model.value}")

            return variant_models
        except Exception:
            await self.throw_error(
                "No OpenAI, Anthropic, or Gemini API key found. Please add the environment variable "
                "OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to backend/.env or in the settings dialog. "
                "If you add it to .env, make sure to restart the backend server."
            )
            raise Exception("No API key")

    def _get_variant_models(
        self,
        generation_type: Literal["create", "update"],
        input_mode: InputMode,
        num_variants: int,
        openai_api_key: str | None,
        anthropic_api_key: str | None,
        gemini_api_key: str | None,
    ) -> List[Llm]:
        """Simple model cycling that scales with num_variants"""

        # Video mode requires Gemini - 2 variants for comparison
        if input_mode == "video":
            if not gemini_api_key:
                raise Exception(
                    "Video mode requires a Gemini API key. "
                    "Please add GEMINI_API_KEY to backend/.env or in the settings dialog"
                )
            return list(VIDEO_VARIANT_MODELS)

        from config import settings
        nvidia_key = settings.NVIDIA_API_KEY_GLM or settings.NVIDIA_API_KEY_KIMI

        # Define models based on available API keys
        if gemini_api_key and anthropic_api_key and openai_api_key:
            if input_mode == "text" and generation_type == "create":
                models = list(ALL_KEYS_MODELS_TEXT_CREATE)
            elif generation_type == "update":
                models = list(ALL_KEYS_MODELS_UPDATE)
            else:
                models = list(ALL_KEYS_MODELS_DEFAULT)
        elif gemini_api_key and anthropic_api_key:
            models = list(GEMINI_ANTHROPIC_MODELS)
        elif gemini_api_key and openai_api_key:
            models = list(GEMINI_OPENAI_MODELS)
        elif openai_api_key and anthropic_api_key:
            models = list(OPENAI_ANTHROPIC_MODELS)
        elif gemini_api_key:
            models = list(GEMINI_ONLY_MODELS)
        elif anthropic_api_key:
            models = list(ANTHROPIC_ONLY_MODELS)
        elif openai_api_key:
            models = list(OPENAI_ONLY_MODELS)
        elif nvidia_key:
            models = [Llm.GLM_5_2]
        else:
            raise Exception("No valid LLM provider API key found")

        # Cycle through models: [A, B] with num=5 becomes [A, B, A, B, A]
        selected_models: List[Llm] = []
        for i in range(num_variants):
            selected_models.append(models[i % len(models)])

        return selected_models


class PromptCreationStage:
    """Handles prompt assembly for code generation"""

    def __init__(self, throw_error: Callable[[str], Coroutine[Any, Any, None]]):
        self.throw_error = throw_error

    async def build_prompt_messages(
        self,
        extracted_params: ExtractedParams,
    ) -> List[ChatCompletionMessageParam]:
        """Create prompt messages"""
        try:
            from prompts.pipeline import build_prompt_messages
            prompt_messages = await build_prompt_messages(
                stack=extracted_params.stack,
                input_mode=extracted_params.input_mode,
                generation_type=extracted_params.generation_type,
                prompt=extracted_params.prompt,
                history=extracted_params.history,
                file_state=extracted_params.file_state,
                image_generation_enabled=extracted_params.should_generate_images,
                design_system=extracted_params.design_system,
            )
            print_prompt_preview(prompt_messages)

            return prompt_messages
        except Exception:
            await self.throw_error(
                "Error assembling prompt. Contact support at support@getwhimsyworks.com"
            )
            raise


class PostProcessingStage:
    """Handles post-processing after code generation completes"""

    def __init__(self):
        pass

    async def process_completions(
        self,
        completions: List[str],
        websocket: WebSocket,
        context: PipelineContext,
    ) -> None:
        """Process completions and perform cleanup."""
        # Save to database if we have a valid completion and a user
        if not completions or not completions[0]:
            return
            
        user = context.metadata.get("user")
        if not user:
            return
            
        from core.security import supabase
        if not supabase:
            return
            
        try:
            # 1. Check if they provided a projectId, otherwise create a new project
            project_id = context.params.get("projectId")
            if not project_id:
                # Create a new project
                prompt_text = context.extracted_params.prompt.get("text", "New Project")[:50]
                title = prompt_text if prompt_text.strip() else "Untitled Project"
                
                proj_res = supabase.table("projects").insert({
                    "user_id": user.id,
                    "title": title
                }).execute()
                
                if proj_res.data and len(proj_res.data) > 0:
                    project_id = proj_res.data[0]["id"]
            
            # 2. Insert the generation
            if project_id:
                supabase.table("generations").insert({
                    "project_id": project_id,
                    "prompt": context.extracted_params.prompt.get("text", ""),
                    "code": completions[0]
                }).execute()
                print(f"Successfully saved generation to project {project_id}")
        except Exception as e:
            print(f"Error saving generation to database: {e}")
            
        return None


class AgenticGenerationStage:
    """Handles agent tool-calling generation for each variant."""

    def __init__(
        self,
        send_message: Callable[[str, str | None, int, Dict[str, Any] | None, str | None], Coroutine[Any, Any, None]],
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
        tasks: List[asyncio.Task[str]] = []
        for index, model in enumerate(variant_models):
            tasks.append(
                asyncio.create_task(
                    self._run_variant(index, model, prompt_messages)
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)
        variant_completions: Dict[int, str] = {}
        for index, result in enumerate(results):
            if isinstance(result, BaseException):
                print(f"Variant {index + 1} failed: {result}")
                continue
            if result:
                variant_completions[index] = result

        return variant_completions

    async def _run_variant(
        self,
        index: int,
        model: Llm,
        prompt_messages: List[ChatCompletionMessageParam],
    ) -> str:
        try:
            async def send_runner_message(
                type: str,
                value: str | None,
                variant_index: int,
                data: Dict[str, Any] | None,
                event_id: str | None,
            ) -> None:
                await self.send_message(
                    cast(MessageType, type),
                    value,
                    variant_index,
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
            if completion:
                await self.send_message("setCode", completion, index, None, None)
            await self.send_message(
                "variantComplete",
                "Variant generation complete",
                index,
                None,
                None,
            )
            return completion
        except openai.AuthenticationError as e:
            print(f"[VARIANT {index + 1}] OpenAI Authentication failed", e)
            error_message = (
                "Incorrect OpenAI key. Please make sure your OpenAI API key is correct, "
                "or create a new OpenAI API key on your OpenAI dashboard."
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, index, None, None)
            return ""
        except openai.NotFoundError as e:
            print(f"[VARIANT {index + 1}] OpenAI Model not found", e)
            error_message = (
                e.message
                + ". Please make sure you have followed the instructions correctly to obtain "
                "an OpenAI key with GPT vision access: "
                "https://github.com/abi/screenshot-to-code/blob/main/Troubleshooting.md"
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, index, None, None)
            return ""
        except openai.RateLimitError as e:
            print(f"[VARIANT {index + 1}] OpenAI Rate limit exceeded", e)
            error_message = (
                "OpenAI error - 'You exceeded your current quota, please check your plan and billing details.'"
                + (
                    " Alternatively, you can purchase code generation credits directly on this website."
                    if IS_PROD
                    else ""
                )
            )
            await self.send_message("variantError", error_message, index, None, None)
            return ""
        except Exception as e:
            err_str = str(e)
            print(f"Error in variant {index + 1}: {err_str}")
            traceback.print_exception(type(e), e, e.__traceback__)

            user_msg = format_llm_generation_error(e)

            await self.send_message("variantError", user_msg, index, None, None)
            return ""


# Pipeline Middleware Implementations


class WebSocketSetupMiddleware(Middleware):
    """Handles WebSocket setup and teardown"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # Create and setup WebSocket communicator
        context.ws_comm = WebSocketCommunicator(context.websocket)
        await context.ws_comm.accept()

        try:
            await next_func()
        finally:
            # Always close the WebSocket
            await context.ws_comm.close()


class ParameterExtractionMiddleware(Middleware):
    """Handles parameter extraction and validation"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # Receive parameters
        assert context.ws_comm is not None
        context.params = await context.ws_comm.receive_params()

        # Validate JWT token
        token = context.params.get("token")
        if not token:
            await context.throw_error("Unauthorized: Please sign in to generate code.")
            raise ValueError("No authentication token provided")
            
        from core.security import get_current_user_from_token
        user = get_current_user_from_token(token)
        if not user:
            await context.throw_error("Unauthorized: Invalid or expired session. Please sign in again.")
            raise ValueError("Invalid authentication token")
            
        context.metadata["user"] = user

        # Extract and validate
        param_extractor = ParameterExtractionStage(
            context.throw_error,
            infer_local_asset_base_url(context.websocket),
        )
        context.extracted_params = await param_extractor.extract_and_validate(
            context.params
        )

        # Log what we're generating
        print(
            f"Generating {context.extracted_params.stack} code in {context.extracted_params.input_mode} mode for user {user.id}"
        )

        await next_func()


class StatusBroadcastMiddleware(Middleware):
    """Sends initial status messages to all variants"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        # Determine variant count based on input mode and generation type.
        # Edit/update flows use two variants to keep latency and cost down.
        assert context.extracted_params is not None
        is_video_mode = context.extracted_params.input_mode == "video"
        is_update = context.extracted_params.generation_type == "update"
        num_variants = (
            NUM_VARIANTS_VIDEO if is_video_mode else 2 if is_update else NUM_VARIANTS
        )
        if CONSENSUS_ENABLED or ORCHESTRATION_ENABLED:
            num_variants = 1

        # Tell frontend how many variants we're using
        await context.send_message("variantCount", str(num_variants), 0)

        for i in range(num_variants):
            await context.send_message("status", "Generating code...", i)

        await next_func()


class PromptCreationMiddleware(Middleware):
    """Handles prompt creation"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        prompt_creator = PromptCreationStage(context.throw_error)
        assert context.extracted_params is not None
        context.prompt_messages = await prompt_creator.build_prompt_messages(
            context.extracted_params,
        )
        await next_func()


class CodeGenerationMiddleware(Middleware):
    """Handles the main code generation logic"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        try:
            assert context.extracted_params is not None

            # Select models (handles video mode internally)
            model_selector = ModelSelectionStage(context.throw_error)
            context.variant_models = await model_selector.select_models(
                generation_type=context.extracted_params.generation_type,
                input_mode=context.extracted_params.input_mode,
                openai_api_key=context.extracted_params.openai_api_key,
                anthropic_api_key=context.extracted_params.anthropic_api_key,
                gemini_api_key=context.extracted_params.gemini_api_key,
            )
            if IS_DEBUG_ENABLED:
                await context.send_message(
                    "variantModels",
                    None,
                    0,
                    {"models": [model.value for model in context.variant_models]},
                    None,
                )

            if ORCHESTRATION_ENABLED:
                print(f"[GENERATE_CODE] ORCHESTRATION_ENABLED=True, using OrchestratedPipeline")
                from orchestration.pipeline import OrchestratedPipeline
                generation_stage = OrchestratedPipeline(
                    send_message=context.send_message,
                    openai_api_key=context.extracted_params.openai_api_key,
                    openai_base_url=context.extracted_params.openai_base_url,
                    anthropic_api_key=context.extracted_params.anthropic_api_key,
                    gemini_api_key=context.extracted_params.gemini_api_key,
                    replicate_api_key=context.extracted_params.replicate_api_key,
                    should_generate_images=context.extracted_params.should_generate_images,
                    should_extract_assets=context.extracted_params.should_extract_assets,
                    file_state=context.extracted_params.file_state,
                    asset_base_url=context.extracted_params.asset_base_url,
                    option_codes=context.extracted_params.option_codes,
                    quality_threshold=ORCHESTRATION_QUALITY_THRESHOLD,
                    max_debate_rounds=ORCHESTRATION_MAX_DEBATE_ROUNDS,
                )
            elif CONSENSUS_ENABLED:
                print(f"[GENERATE_CODE] CONSENSUS_ENABLED=True, using ConsensusGenerationStage")
                generation_stage = ConsensusGenerationStage(
                    send_message=context.send_message,
                    openai_api_key=context.extracted_params.openai_api_key,
                    openai_base_url=context.extracted_params.openai_base_url,
                    anthropic_api_key=context.extracted_params.anthropic_api_key,
                    gemini_api_key=context.extracted_params.gemini_api_key,
                    replicate_api_key=context.extracted_params.replicate_api_key,
                    should_generate_images=context.extracted_params.should_generate_images,
                    should_extract_assets=context.extracted_params.should_extract_assets,
                    file_state=context.extracted_params.file_state,
                    asset_base_url=context.extracted_params.asset_base_url,
                    option_codes=context.extracted_params.option_codes,
                )
            else:
                generation_stage = AgenticGenerationStage(
                    send_message=context.send_message,
                    openai_api_key=context.extracted_params.openai_api_key,
                    openai_base_url=context.extracted_params.openai_base_url,
                    anthropic_api_key=context.extracted_params.anthropic_api_key,
                    gemini_api_key=context.extracted_params.gemini_api_key,
                    replicate_api_key=context.extracted_params.replicate_api_key,
                    should_generate_images=context.extracted_params.should_generate_images,
                    should_extract_assets=context.extracted_params.should_extract_assets,
                    file_state=context.extracted_params.file_state,
                    asset_base_url=context.extracted_params.asset_base_url,
                    option_codes=context.extracted_params.option_codes,
                )

            context.variant_completions = await generation_stage.process_variants(
                variant_models=context.variant_models,
                prompt_messages=context.prompt_messages,
            )

            # Check if all variants failed
            if len(context.variant_completions) == 0:
                await context.throw_error(
                    "Error generating code. This is likely because your API key is invalid, your account is out of credits, or you hit a rate limit (429 Too Many Requests). Check your OpenAI/Anthropic/Gemini dashboard, or see the backend terminal for exact logs."
                )
                return  # Don't continue the pipeline

            # Convert to list format
            context.completions = []
            for i in range(len(context.variant_models)):
                if i in context.variant_completions:
                    context.completions.append(context.variant_completions[i])
                else:
                    context.completions.append("")

        except Exception as e:
            err_msg = str(e)
            print(f"[GENERATE_CODE] Unexpected error: {err_msg}")
            
            user_msg = format_llm_generation_error(e)

            await context.throw_error(user_msg)
            return  # Don't continue the pipeline

        await next_func()


class PostProcessingMiddleware(Middleware):
    """Handles post-processing and logging"""

    async def process(
        self, context: PipelineContext, next_func: Callable[[], Awaitable[None]]
    ) -> None:
        post_processor = PostProcessingStage()
        await post_processor.process_completions(
            context.completions, context.websocket, context
        )

        await next_func()


from core.rate_limit import limiter

@router.websocket("/generate-code")
async def stream_code(websocket: WebSocket):
    """Handle WebSocket code generation requests using a pipeline pattern"""
    # Removed manual rate limit check here because slowapi isn't fully compatible with bare WebSockets 
    # and was causing unintended connection closures.
    pipeline = Pipeline()

    # Configure the pipeline
    pipeline.use(WebSocketSetupMiddleware())
    pipeline.use(ParameterExtractionMiddleware())
    pipeline.use(StatusBroadcastMiddleware())
    pipeline.use(PromptCreationMiddleware())
    pipeline.use(CodeGenerationMiddleware())
    pipeline.use(PostProcessingMiddleware())

    # Execute the pipeline
    await pipeline.execute(websocket)
