"""Lightweight user-agent labels for session listings."""

from __future__ import annotations

from typing import Optional

BROWSER_MAPPINGS = {
    "edg/": "Microsoft Edge",
    "edge/": "Microsoft Edge",
    "opr/": "Opera",
    "opera": "Opera",
    "firefox/": "Firefox",
    "fxios/": "Firefox",
    "chrome/": "Chrome",
    "crios/": "Chrome",
    "safari/": "Safari",
    "msie": "Internet Explorer",
    "trident/": "Internet Explorer",
}


OS_MAPPINGS = {
    "android": "Android",
    "iphone": "iOS",
    "ipad": "iOS",
    "ios": "iOS",
    "mac os x": "macOS",
    "macintosh": "macOS",
    "windows": "Windows",
    "cros": "Chrome OS",
    "linux": "Linux",
}


def format_user_agent(user_agent: Optional[str]) -> str:
    """Return a short browser/OS label from a raw User-Agent string.

    Falls back to ``Unknown browser`` when the string is missing or
    unrecognised.
    """

    if user_agent is None or not user_agent.strip():
        return "Unknown browser"

    ua = user_agent.strip()
    browser = _detect_browser(ua)
    os_name = _detect_os(ua)

    if os_name is None:
        return browser

    return f"{browser} on {os_name}"


def _detect_browser(ua: str) -> str:
    lower = ua.lower()

    for key, value in BROWSER_MAPPINGS.items():
        if key in lower:
            return value

    return "Unknown browser"


def _detect_os(ua: str) -> Optional[str]:
    lower = ua.lower()

    for key, value in OS_MAPPINGS.items():
        if key in lower:
            return value

    return None
