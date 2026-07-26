import traceback

def format_llm_generation_error(e: Exception) -> str:
    """Format known LLM and API errors into user-friendly strings."""
    err_str = str(e)
    
    if "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
        return "API Rate Limit or Quota Exceeded (429). Please check your API key quota or try another model in Settings."
    
    if "credit balance is too low" in err_str.lower() or "invalid_api_key" in err_str.lower():
        return "Anthropic API Error: Credit balance is too low or invalid key. Please update your Anthropic API key in Settings."
    
    if "authenticationerror" in err_str.lower() or "invalid api key" in err_str.lower():
        return "Authentication Error: Invalid API key. Please check your API keys in Settings."
    
    return f"Generation error: {err_str[:250]}"
