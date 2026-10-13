"""IP → location helpers for session listings."""

from __future__ import annotations

import ipaddress
import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class IpLocation:
    """Resolved city/country for a client IP."""

    city: Optional[str]
    country: Optional[str]


def is_private_or_loopback(ip_address: Optional[str]) -> bool:
    """Return True for missing, loopback, private, or link-local addresses."""

    if ip_address is None or not ip_address.strip():
        return True

    try:
        parsed = ipaddress.ip_address(ip_address.strip())
    except ValueError:
        return True

    return bool(
        parsed.is_loopback
        or parsed.is_private
        or parsed.is_link_local
        or parsed.is_reserved
        or parsed.is_unspecified
    )


def format_location(location: Optional[IpLocation]) -> Optional[str]:
    """Format ``City, Country`` or ``Country``; omit empty city."""

    if location is None:
        return None

    city = (location.city or "").strip() or None
    country = (location.country or "").strip() or None

    if city is not None and country is not None:
        return f"{city}, {country}"

    if country is not None:
        return country

    if city is not None:
        return city

    return None


def resolve_ip_location(ip_address: Optional[str]) -> Optional[IpLocation]:
    """Best-effort geo lookup for a public IP.

    Private/loopback addresses map to a local network label without a
    network call. Public IPs use a short-timeout lookup and fail soft
    when the lookup is unavailable.
    """

    if ip_address is None or not ip_address.strip():
        return None

    cleaned = ip_address.strip()

    if is_private_or_loopback(cleaned):
        return IpLocation(city=None, country="Local network")

    return _lookup_public_ip(cleaned)


def _lookup_public_ip(ip_address: str) -> Optional[IpLocation]:
    """Query a public geo endpoint; never raises to callers."""

    url = f"http://ip-api.com/json/{ip_address}?fields=status,city,country"

    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "VelvetSessionGeo/1.0"},
            method="GET",
        )

        with urllib.request.urlopen(request, timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError:
        return None

    if not isinstance(payload, dict):
        return None

    if payload.get("status") != "success":
        return None

    city_raw = payload.get("city")
    country_raw = payload.get("country")
    city = city_raw.strip() if isinstance(city_raw, str) else None
    country = country_raw.strip() if isinstance(country_raw, str) else None

    if city is None and country is None:
        return None

    return IpLocation(city=city or None, country=country or None)
