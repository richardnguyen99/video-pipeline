"""Sustain vs burst Redis cache policies."""

CACHE_TTL_SECONDS = 300
BURST_RATE = "10/second"
SUSTAIN_RATE = "100/minute"
GLOBAL_RATE = "200/minute"

__all__ = [
    "CACHE_TTL_SECONDS",
    "BURST_RATE",
    "SUSTAIN_RATE",
    "GLOBAL_RATE",
]
