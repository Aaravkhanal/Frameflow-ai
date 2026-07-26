import base64
import io
import math
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageChops

router = APIRouter()

class VisualDiffRequest(BaseModel):
    image1_b64: str  # Original / Figma image
    image2_b64: str  # Generated / Live preview image

class VisualDiffResponse(BaseModel):
    match_percentage: float
    diff_image_b64: str

def base64_to_image(b64_str: str) -> Image.Image:
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]
    image_data = base64.b64decode(b64_str)
    return Image.open(io.BytesIO(image_data)).convert("RGB")

def image_to_base64(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

@router.post("/api/visual-diff", response_model=VisualDiffResponse)
async def visual_diff(request: VisualDiffRequest):
    try:
        img1 = base64_to_image(request.image1_b64)
        img2 = base64_to_image(request.image2_b64)

        # Resize to match the smallest image to allow diffing
        if img1.size != img2.size:
            width = min(img1.size[0], img2.size[0])
            height = min(img1.size[1], img2.size[1])
            img1 = img1.resize((width, height))
            img2 = img2.resize((width, height))

        # Get diff using ImageChops
        diff = ImageChops.difference(img1, img2)
        
        # Calculate match percentage based on root mean square (RMS)
        h = diff.histogram()
        sq = (value * ((idx % 256) ** 2) for idx, value in enumerate(h))
        sum_of_squares = sum(sq)
        rms = math.sqrt(sum_of_squares / float(img1.size[0] * img1.size[1]))
        
        # RMS of 0 is perfect match. Max RMS is 255 (completely different)
        # Convert to percentage
        match_percentage = max(0.0, 100.0 - (rms / 255.0 * 100.0))

        # Enhance the diff image for visualization (make diffs red)
        diff_vis = Image.new("RGBA", img1.size, (0, 0, 0, 0))
        # Mask where pixels are different
        mask = diff.convert("L").point(lambda x: 255 if x > 10 else 0)
        
        # Create a red overlay
        red_layer = Image.new("RGBA", img1.size, (255, 0, 0, 128))
        diff_vis.paste(red_layer, (0, 0), mask)

        # Composite original image with the red diff overlay
        img1_rgba = img1.convert("RGBA")
        final_diff = Image.alpha_composite(img1_rgba, diff_vis)

        return VisualDiffResponse(
            match_percentage=round(match_percentage, 2),
            diff_image_b64=image_to_base64(final_diff)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
