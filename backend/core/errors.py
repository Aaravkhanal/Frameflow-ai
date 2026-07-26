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
        
    if "timeout" in err_str.lower() or "timed out" in err_str.lower() or "deadline_exceeded" in err_str.lower():
        return "Request Timed Out. The model took too long to respond. Please try again."

    if "bad gateway" in err_str.lower() or "502" in err_str:
        return "Bad Gateway (502). The LLM provider is currently experiencing issues. Please try again later."
        
    if "service unavailable" in err_str.lower() or "503" in err_str:
        return "Service Unavailable (503). The LLM provider is currently overloaded. Please try again later."
        
    if "connection error" in err_str.lower() or "connection aborted" in err_str.lower():
        return "Connection Error. Failed to connect to the AI provider. Check your network or try again."

    return f"Generation error: {err_str[:250]}"
