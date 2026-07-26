import { DesignDecodeResult } from "../types";
import { HTTP_BACKEND_URL } from "../config";

export async function decodeDesign(
  code: string,
  image?: string,
  openaiApiKey?: string
): Promise<DesignDecodeResult> {
  const response = await fetch(`${HTTP_BACKEND_URL}/api/design-decode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      image,
      openai_api_key: openaiApiKey,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to decode design");
  }

  return response.json();
}
