"""Unit tests for refresh-token hashing."""

from app.utils.refresh_token_hash import hash_refresh_token


def test_hash_refresh_token_is_stable_sha256_hex() -> None:
    """Same input always yields the same 64-char hex digest."""

    digest = hash_refresh_token("eyJhbGciOiJIUzI1NiJ9.payload.sig")

    assert len(digest) == 64
    assert digest == hash_refresh_token("eyJhbGciOiJIUzI1NiJ9.payload.sig")
    assert digest != hash_refresh_token("other-token")
