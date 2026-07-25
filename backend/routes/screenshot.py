import base64
import ipaddress
import logging
import socket
import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Private / reserved IP ranges that must never be reached via SSRF
# ---------------------------------------------------------------------------
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),         # RFC-1918 private
    ipaddress.ip_network("172.16.0.0/12"),       # RFC-1918 private
    ipaddress.ip_network("192.168.0.0/16"),      # RFC-1918 private
    ipaddress.ip_network("127.0.0.0/8"),         # Loopback
    ipaddress.ip_network("169.254.0.0/16"),      # Link-local / AWS IMDS
    ipaddress.ip_network("0.0.0.0/8"),           # "This" network
    ipaddress.ip_network("100.64.0.0/10"),       # Shared address space (RFC 6598)
    ipaddress.ip_network("192.0.0.0/24"),        # IETF protocol assignments
    ipaddress.ip_network("198.18.0.0/15"),       # Benchmarking
    ipaddress.ip_network("198.51.100.0/24"),     # Documentation TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),      # Documentation TEST-NET-3
    ipaddress.ip_network("240.0.0.0/4"),         # Reserved (future use)
    ipaddress.ip_network("::1/128"),             # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),            # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),           # IPv6 link-local
]

# Cloud metadata hostnames that should never be reached
_BLOCKED_HOSTNAMES = frozenset(
    {
        "metadata.google.internal",
        "metadata.internal",
        "169.254.169.254",  # Also caught by IP range, but block by name too
    }
)


def _is_ip_blocked(ip_str: str) -> bool:
    """Return True if the resolved IP falls in any blocked range."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _BLOCKED_NETWORKS)
    except ValueError:
        return True  # Unparseable IP → block it


def is_safe_url(url: str) -> bool:
    """
    Return True iff the URL is safe to proxy.
    Raises ValueError with a human-readable message if unsafe.
    """
    parsed = urlparse(url)

    # Only HTTP(S) allowed
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"Only http/https URLs are allowed, got: {parsed.scheme!r}")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname")

    # Block by known dangerous hostnames
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        raise ValueError(f"Hostname {hostname!r} is not allowed")

    # Resolve to IP and check all returned addresses
    try:
        resolved = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve hostname {hostname!r}: {exc}") from exc

    for _family, _type, _proto, _canonname, sockaddr in resolved:
        ip = str(sockaddr[0])
        if _is_ip_blocked(ip):
            raise ValueError(
                f"URL resolves to a private/reserved IP address ({ip}) "
                "and cannot be used for security reasons"
            )

    return True


def normalize_url(url: str) -> str:
    """
    Normalize URL to ensure it has a proper protocol.
    If no protocol is specified, default to https://
    """
    url = url.strip()

    parsed = urlparse(url)

    if not parsed.scheme:
        url = f"https://{url}"
    elif parsed.scheme in ["http", "https"]:
        pass
    else:
        # Check if this might be a domain with port (like example.com:8080)
        if ":" in url and not url.startswith(("http://", "https://", "ftp://", "file://")):
            url = f"https://{url}"
        else:
            raise ValueError(f"Unsupported protocol: {parsed.scheme}")

    return url


def bytes_to_data_url(image_bytes: bytes, mime_type: str) -> str:
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{base64_image}"


async def capture_screenshot(
    target_url: str, api_key: str | None = None, device: str = "desktop"
) -> bytes:
    if api_key:
        api_base_url = "https://api.screenshotone.com/take"

        params = {
            "access_key": api_key,
            "url": target_url,
            "full_page": "true",
            "device_scale_factor": "1",
            "format": "png",
            "block_ads": "true",
            "block_cookie_banners": "true",
            "block_trackers": "true",
            "cache": "false",
            "viewport_width": "342",
            "viewport_height": "684",
        }

        if device == "desktop":
            params["viewport_width"] = "1280"
            params["viewport_height"] = "832"

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(api_base_url, params=params)
                if response.status_code == 200 and response.content:
                    return response.content
        except Exception as e:
            logger.warning(f"ScreenshotOne API failed ({e}), falling back to local Playwright screenshot")

    # Local Playwright fallback (zero-config, works out of the box)
    logger.info("Using local Playwright to capture website screenshot")
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 832} if device == "desktop" else {"width": 375, "height": 812}
            )
            page = await context.new_page()
            await page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(1000)
            screenshot_bytes = await page.screenshot(full_page=True)
            await browser.close()
            return screenshot_bytes
    except Exception as exc:
        raise Exception(f"Error capturing screenshot via Playwright fallback: {exc}")


class ScreenshotRequest(BaseModel):
    url: str
    apiKey: str | None = None


class ScreenshotResponse(BaseModel):
    url: str


@router.post("/api/screenshot")
async def app_screenshot(request: ScreenshotRequest) -> ScreenshotResponse:
    url = request.url
    api_key = request.apiKey or os.environ.get("SCREENSHOTONE_API_KEY")

    try:
        # Normalize the URL first
        normalized_url = normalize_url(url)
        is_safe_url(normalized_url)

        image_bytes = await capture_screenshot(normalized_url, api_key=api_key)
        data_url = bytes_to_data_url(image_bytes, "image/png")
        return ScreenshotResponse(url=data_url)

    except ValueError as exc:
        # URL normalization or SSRF check failed
        logger.warning("Blocked unsafe screenshot URL %r: %s", url, exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Error capturing screenshot: {exc}"
        )
