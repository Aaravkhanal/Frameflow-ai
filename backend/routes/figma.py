import base64
import os
import re
from urllib.parse import parse_qs, urlparse
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class FigmaRenderRequest(BaseModel):
    figmaUrl: str
    personalAccessToken: str | None = None


class FigmaRenderResponse(BaseModel):
    dataUrl: str
    fileKey: str
    nodeId: str


def parse_figma_url(url: str) -> tuple[str, str | None]:
    """
    Extracts (file_key, node_id) from a Figma URL.
    Examples:
    https://www.figma.com/file/LKQ42.../Title?node-id=123%3A456
    https://www.figma.com/design/LKQ42.../Title?node-id=123-456
    """
    parsed = urlparse(url.strip())
    path_parts = [p for p in parsed.path.split("/") if p]

    if "file" not in path_parts and "design" not in path_parts:
        raise ValueError("URL must be a valid Figma file or design link (e.g. figma.com/file/... or figma.com/design/...)")

    try:
        key_index = path_parts.index("file") + 1 if "file" in path_parts else path_parts.index("design") + 1
        file_key = path_parts[key_index]
    except (ValueError, IndexError):
        raise ValueError("Could not find file key in Figma URL")

    query_params = parse_qs(parsed.query)
    node_id_param = query_params.get("node-id", [None])[0]

    node_id = None
    if node_id_param:
        # Convert '123-456' to '123:456' standard Figma node ID format
        node_id = node_id_param.replace("-", ":")

    return file_key, node_id


@router.post("/api/figma/render")
async def render_figma_node(request: FigmaRenderRequest) -> FigmaRenderResponse:
    url = request.figmaUrl
    token = request.personalAccessToken or os.environ.get("FIGMA_ACCESS_TOKEN")

    if not token:
        raise HTTPException(
            status_code=400,
            detail="Figma Personal Access Token is required. Please provide it or set FIGMA_ACCESS_TOKEN in backend environment.",
        )

    try:
        file_key, node_id = parse_figma_url(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    headers = {"X-Figma-Token": token}

    async with httpx.AsyncClient(timeout=30) as client:
        figma_api_url = f"https://api.figma.com/v1/images/{file_key}"
        params: dict[str, str] = {"format": "png", "scale": "2"}
        if node_id:
            params["ids"] = node_id

        res = await client.get(figma_api_url, headers=headers, params=params)

        if res.status_code != 200:
            raise HTTPException(
                status_code=res.status_code,
                detail=f"Figma API error: {res.text[:200]}",
            )

        data = res.json()
        images = data.get("images", {})

        image_url = None
        if node_id and node_id in images:
            image_url = images[node_id]
        elif images:
            image_url = next(iter(images.values()))

        if not image_url:
            raise HTTPException(
                status_code=404,
                detail="Figma API returned no rendered image for this node/file.",
            )

        img_res = await client.get(image_url)
        if img_res.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail="Failed to download rendered PNG from Figma CDN.",
            )

        base64_encoded = base64.b64encode(img_res.content).decode("utf-8")
        data_url = f"data:image/png;base64,{base64_encoded}"

        return FigmaRenderResponse(
            dataUrl=data_url,
            fileKey=file_key,
            nodeId=node_id or "",
        )
