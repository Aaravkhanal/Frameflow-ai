import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import openai

router = APIRouter()

# --- Pydantic Schemas for Structured Output ---

class ColorPalette(BaseModel):
    primary: List[str] = Field(description="Primary colors used in the design (e.g. HEX or RGB)")
    secondary: List[str] = Field(description="Secondary colors")
    background: List[str] = Field(description="Background surface colors")
    text: List[str] = Field(description="Text colors")
    theme: str = Field(description="Detected theme: Light, Dark, or Mixed")

class Typography(BaseModel):
    font_families: List[str]
    heading_sizes: List[str]
    paragraph_sizes: List[str]
    hierarchy_explanation: str = Field(description="Why these typography choices create hierarchy")

class LayoutAnalysis(BaseModel):
    grid_system: str = Field(description="Description of the grid or flexbox system used")
    spacing_scale: str = Field(description="The general padding/margin scale (e.g., 4px, 8px, 16px)")
    responsive_behavior: str = Field(description="How the layout adapts to mobile/tablet")
    explanation: str = Field(description="Why the layout guides user attention effectively")

class UIComponent(BaseModel):
    name: str = Field(description="Name of the component (e.g., Hero Section, Primary Button, Navbar)")
    css_selector: str = Field(description="A CSS selector that uniquely identifies this component in the provided HTML. E.g., 'header.sticky' or 'button.bg-blue-500' or '#hero-section'.")
    purpose: str = Field(description="The purpose of this component")
    styling: str = Field(description="Brief description of its styling (colors, padding, borders)")

class DesignSystem(BaseModel):
    frameworks: List[str] = Field(description="Detected frameworks e.g., Tailwind CSS, shadcn/ui, etc.")
    icon_library: Optional[str] = Field(description="Icon library used, e.g., Lucide, FontAwesome")

class UXAnalysis(BaseModel):
    accessibility: str = Field(description="Accessibility considerations and potential improvements")
    interactions: str = Field(description="Expected hover, focus, and active states")
    overall_experience: str = Field(description="Summary of the overall user experience and visual balance")

class DesignDecodeResult(BaseModel):
    visual_design: ColorPalette
    typography: Typography
    layout: LayoutAnalysis
    components: List[UIComponent]
    design_system: DesignSystem
    ux_analysis: UXAnalysis
    ai_explanation: str = Field(description="A deep dive explaining why this interface is designed this way and what modern principles it follows.")

# --- API Models ---

class DesignDecodeRequest(BaseModel):
    code: str
    image: Optional[str] = None
    openai_api_key: Optional[str] = None

# --- Route ---

@router.post("/api/design-decode", response_model=DesignDecodeResult)
async def decode_design(request: DesignDecodeRequest):
    api_key = request.openai_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")

    client = openai.AsyncOpenAI(api_key=api_key)

    system_prompt = """
You are an expert UI/UX Designer and Frontend Engineer.
Your task is to analyze the provided HTML/Tailwind code and reverse-engineer the design decisions.
Provide a comprehensive breakdown of the design, including colors, typography, layout, components, and UX.
For each component you identify, provide a precise CSS selector that can be used to query that element in the DOM (e.g., 'nav', '.max-w-7xl', 'button.bg-primary').
Focus on explaining *why* these design decisions were made to help the user learn.
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Analyze this HTML code and decode its design:\n\n```html\n{request.code}\n```"}
    ]

    try:
        completion = await client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format=DesignDecodeResult,
        )
        result = completion.choices[0].message.parsed
        if result is None:
            raise ValueError("Failed to parse design decode result.")
        return result
    except Exception as e:
        print("Error during design decode:", e)
        raise HTTPException(status_code=500, detail=str(e))
