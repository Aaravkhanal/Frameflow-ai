import os
from typing import Optional

from anthropic import AsyncAnthropic
from google import genai
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from agent.providers.anthropic import AnthropicProviderSession, serialize_anthropic_tools
from agent.providers.base import ProviderSession
from agent.providers.gemini import GeminiProviderSession, serialize_gemini_tools
from agent.providers.openai import OpenAIProviderSession, serialize_openai_tools
from agent.tools import canonical_tool_definitions
from config import NVIDIA_BASE_URL, REPLICATE_API_KEY
from llm import (
    ANTHROPIC_MODELS,
    GEMINI_MODELS,
    NVIDIA_MODEL_API_NAME,
    NVIDIA_MODELS,
    OPENAI_MODELS,
    Llm,
)
from preview_screenshot import is_screenshot_preview_available


def create_provider_session(
    model: Llm,
    prompt_messages: list[ChatCompletionMessageParam],
    should_generate_images: bool,
    openai_api_key: Optional[str],
    openai_base_url: Optional[str],
    anthropic_api_key: Optional[str],
    gemini_api_key: Optional[str],
    replicate_api_key: Optional[str],
    should_extract_assets: bool = True,
    # NVIDIA NIM keys
    nvidia_api_key_glm: Optional[str] = None,
    nvidia_api_key_kimi: Optional[str] = None,
) -> ProviderSession:
    canonical_tools = canonical_tool_definitions(
        image_generation_enabled=should_generate_images,
        # The edit_image tool calls Replicate, so don't offer it without a key.
        image_editing_enabled=bool(replicate_api_key or REPLICATE_API_KEY),
        # The extract_assets tool calls Gemini, so don't offer it without a key.
        asset_extraction_enabled=should_extract_assets and bool(gemini_api_key),
        # screenshot_preview needs headless Chromium; skip it if it can't launch.
        screenshot_enabled=is_screenshot_preview_available(),
    )

    if model in OPENAI_MODELS:
        if not openai_api_key:
            raise Exception("OpenAI API key is missing.")

        client = AsyncOpenAI(api_key=openai_api_key, base_url=openai_base_url)
        return OpenAIProviderSession(
            client=client,
            model=model,
            prompt_messages=prompt_messages,
            tools=serialize_openai_tools(canonical_tools),
        )

    if model in ANTHROPIC_MODELS:
        if not anthropic_api_key:
            raise Exception("Anthropic API key is missing.")

        client = AsyncAnthropic(api_key=anthropic_api_key)
        return AnthropicProviderSession(
            client=client,
            model=model,
            prompt_messages=prompt_messages,
            tools=serialize_anthropic_tools(canonical_tools),
        )

    if model in GEMINI_MODELS:
        if not gemini_api_key:
            raise Exception("Gemini API key is missing.")

        client = genai.Client(api_key=gemini_api_key)
        return GeminiProviderSession(
            client=client,
            model=model,
            prompt_messages=prompt_messages,
            tools=serialize_gemini_tools(canonical_tools),
        )

    if model in NVIDIA_MODELS:
        # NVIDIA NIM uses the OpenAI-compatible API with a different base URL
        # and model-specific API keys.
        if model == Llm.GLM_5_2:
            api_key = nvidia_api_key_glm or os.environ.get("NVIDIA_API_KEY_GLM") or NVIDIA_API_KEY_GLM
            if not api_key:
                raise Exception(
                    "NVIDIA GLM-5.2 API key is missing. "
                    "Set NVIDIA_API_KEY_GLM in backend/.env"
                )
        elif model == Llm.KIMI_K2_6:
            api_key = nvidia_api_key_kimi or os.environ.get("NVIDIA_API_KEY_KIMI") or NVIDIA_API_KEY_KIMI
            if not api_key:
                raise Exception(
                    "NVIDIA Kimi K2.6 API key is missing. "
                    "Set NVIDIA_API_KEY_KIMI in backend/.env"
                )
        else:
            raise ValueError(f"Unknown NVIDIA model: {model.value}")

        # Use OpenAI SDK pointed at the NVIDIA NIM base URL.
        # The actual model name (e.g. "z-ai/glm-5.2") is stored separately
        # and injected by the OpenAIProviderSession via get_openai_api_name.
        # We temporarily patch the OPENAI_MODEL_CONFIG for NVIDIA models by
        # using a wrapper that returns the NVIDIA API name directly.
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=NVIDIA_BASE_URL,
        )
        return OpenAIProviderSession(
            client=client,
            model=model,
            prompt_messages=prompt_messages,
            tools=serialize_openai_tools(canonical_tools),
            # NVIDIA models don't support reasoning_effort parameter
            override_api_name=NVIDIA_MODEL_API_NAME[model],
            override_reasoning_effort=None,
        )

    raise ValueError(f"Unsupported model: {model.value}")
