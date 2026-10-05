"""Unit tests for ``app.schemas.user_bio``."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.user_bio import UserBioResponse, UserBioUpdateRequest


def test_update_request_accepts_full_payload() -> None:
    """All biography fields pass validation when well-formed."""

    payload = UserBioUpdateRequest(
        full_name="Alice Example",
        date_of_birth=date(1990, 5, 15),
        country="USA",
        gender="Female",
        biography="Director and editor.",
        link="https://example.com/alice",
    )

    assert payload.full_name == "Alice Example"
    assert payload.date_of_birth == date(1990, 5, 15)
    assert payload.country == "USA"
    assert payload.gender == "Female"
    assert payload.biography == "Director and editor."
    assert payload.link == "https://example.com/alice"


def test_update_request_allows_empty_body() -> None:
    """An empty body is valid (all fields optional)."""

    payload = UserBioUpdateRequest()

    assert payload.full_name is None
    assert payload.date_of_birth is None
    assert payload.country is None
    assert payload.gender is None
    assert payload.biography is None
    assert payload.link is None


def test_update_request_strips_and_nullifies_blank_strings() -> None:
    """Whitespace-only strings become None after normalization."""

    payload = UserBioUpdateRequest(
        full_name="  ",
        country="\t",
        gender="  ",
        biography="   ",
        link="  ",
    )

    assert payload.full_name is None
    assert payload.country is None
    assert payload.gender is None
    assert payload.biography is None
    assert payload.link is None


def test_update_request_rejects_future_date_of_birth() -> None:
    """Date of birth must not be in the future."""

    tomorrow = date.today() + timedelta(days=1)

    with pytest.raises(ValidationError) as exc_info:
        UserBioUpdateRequest(date_of_birth=tomorrow)

    assert "future" in str(exc_info.value).lower()


def test_update_request_rejects_non_http_link() -> None:
    """Link must be an absolute http or https URL."""

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(link="ftp://example.com/file")

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(link="not-a-url")

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(link="example.com")


def test_update_request_accepts_https_link() -> None:
    """Absolute https URLs are accepted."""

    payload = UserBioUpdateRequest(link="https://example.com/path?q=1")

    assert payload.link == "https://example.com/path?q=1"


def test_update_request_rejects_overlong_biography() -> None:
    """Biography longer than 500 characters is rejected."""

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(biography="x" * 501)


def test_update_request_normalizes_country_to_uppercase_alpha3() -> None:
    """Country codes are uppercased and validated as ISO alpha-3."""

    payload = UserBioUpdateRequest(country="vnm")

    assert payload.country == "VNM"


def test_update_request_rejects_non_alpha3_country() -> None:
    """Full country names and invalid codes are rejected."""

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(country="United States")

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(country="VN")

    with pytest.raises(ValidationError):
        UserBioUpdateRequest(country="VIET")


def test_update_request_accepts_supported_gender_values() -> None:
    """Each frontend gender option is accepted by the request schema."""

    from app.schemas.user_bio import Gender

    for value in Gender:
        payload = UserBioUpdateRequest(gender=value.value)

        assert payload.gender == value.value


def test_response_defaults_all_null() -> None:
    """Empty response represents a user with no bio filled in."""

    response = UserBioResponse()

    assert response.full_name is None
    assert response.date_of_birth is None
    assert response.country is None
    assert response.gender is None
    assert response.biography is None
    assert response.link is None
    assert response.updated_at is None
