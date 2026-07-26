import httpx
from bs4 import BeautifulSoup
import logging
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

async def extract_design_system_from_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return ""
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Extract main components
            components = []
            
            # Look for navigation
            nav = soup.find("nav")
            if nav:
                components.append("Navigation exists")
                
            # Look for main sections
            sections = soup.find_all("section")
            components.append(f"Found {len(sections)} sections")
            
            # Extract basic text content to give context
            headings = [h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3"]) if h.get_text(strip=True)]
            
            # Extract inline styles or link references for CSS context
            css_links = [urljoin(url, link.get("href")) for link in soup.find_all("link", rel="stylesheet") if link.get("href")]
            
            design_context = f"URL Context Extraction:\n"
            design_context += f"- Headings: {', '.join(headings[:50])}...\n"
            design_context += f"- Structure: {', '.join(components)}\n"
            design_context += f"- CSS References: {len(css_links)} external stylesheets\n"
            design_context += f"\nRaw Text Snippet:\n{soup.get_text(separator=' ', strip=True)[:5000]}"
            
            # Truncate to maximum token limit (roughly 10,000 chars)
            if len(design_context) > 10000:
                design_context = design_context[:10000] + "\n...[TRUNCATED]"
            
            return design_context
    except Exception as e:
        logger.warning(f"Error extracting DOM/CSS from {url}: {e}")
        return ""
