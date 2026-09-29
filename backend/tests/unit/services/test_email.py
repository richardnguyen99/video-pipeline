"""Unit tests for ``app.services.email.EmailService``."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from fastapi import HTTPException, status

from app.config import Settings
from app.services.email import EmailService


def _settings(**overrides: Any) -> Settings:
    """Build settings with Resend fields suitable for tests."""

    values: dict[str, Any] = {
        "app_name": "video-pipeline-test",
        "app_version": "0.0.0-test",
        "database_url": "postgresql://test:test@localhost:5432/test",
        "resend_api_key": "re_test_key",
        "resend_from_email": "Velvet <noreply@example.com>",
        "resend_webhook_secret": "whsec_test",
        "resend_audience_id": None,
    }
    values.update(overrides)

    return Settings(**values)


def test_is_configured_true_when_key_and_from_set() -> None:
    """``is_configured`` is true when API key and From address exist."""

    service = EmailService(settings=_settings())

    assert service.is_configured is True


def test_is_configured_false_when_api_key_missing() -> None:
    """``is_configured`` is false without an API key."""

    service = EmailService(
        settings=_settings(resend_api_key=None),
    )

    assert service.is_configured is False


def test_is_configured_false_when_from_email_blank() -> None:
    """``is_configured`` is false when From is blank."""

    service = EmailService(
        settings=_settings(resend_from_email="  "),
    )

    assert service.is_configured is False


def test_send_email_raises_503_when_not_configured() -> None:
    """``send_email`` raises 503 when Resend is not configured."""

    service = EmailService(
        settings=_settings(resend_api_key=None),
    )

    with pytest.raises(HTTPException) as exc_info:
        service.send_email(
            to=["user@example.com"],
            subject="Hello",
            html="<p>Hi</p>",
        )

    assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_send_email_raises_400_when_recipients_empty() -> None:
    """``send_email`` raises 400 when every recipient is blank."""

    service = EmailService(settings=_settings())

    with pytest.raises(HTTPException) as exc_info:
        service.send_email(
            to=["  ", ""],
            subject="Hello",
            html="<p>Hi</p>",
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_send_email_success_returns_id() -> None:
    """``send_email`` returns the Resend message id on success."""

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Emails.send") as send_mock:
        send_mock.return_value = {"id": "email_123"}

        email_id = service.send_email(
            to=["user@example.com"],
            subject="Hello",
            html="<p>Hi</p>",
            text="Hi",
            reply_to=["reply@example.com"],
        )

    assert email_id == "email_123"
    send_mock.assert_called_once()
    params = send_mock.call_args.args[0]
    assert params["from"] == "Velvet <noreply@example.com>"
    assert params["to"] == ["user@example.com"]
    assert params["subject"] == "Hello"
    assert params["html"] == "<p>Hi</p>"
    assert params["text"] == "Hi"
    assert params["reply_to"] == ["reply@example.com"]


def test_send_email_uses_from_address_override() -> None:
    """``send_email`` prefers an explicit From override."""

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Emails.send") as send_mock:
        send_mock.return_value = {"id": "email_override"}

        service.send_email(
            to=["user@example.com"],
            subject="Hello",
            html="<p>Hi</p>",
            from_address="Support <support@example.com>",
        )

    params = send_mock.call_args.args[0]
    assert params["from"] == "Support <support@example.com>"


def test_send_email_raises_502_on_resend_error() -> None:
    """``send_email`` maps Resend API failures to 502."""

    from resend.exceptions import ResendError

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Emails.send") as send_mock:
        send_mock.side_effect = ResendError(
            502,
            "application_error",
            "upstream failure",
            "retry later",
        )

        with pytest.raises(HTTPException) as exc_info:
            service.send_email(
                to=["user@example.com"],
                subject="Hello",
                html="<p>Hi</p>",
            )

    assert exc_info.value.status_code == status.HTTP_502_BAD_GATEWAY


def test_send_email_raises_502_when_response_missing_id() -> None:
    """``send_email`` raises 502 when Resend omits the message id."""

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Emails.send") as send_mock:
        send_mock.return_value = {}

        with pytest.raises(HTTPException) as exc_info:
            service.send_email(
                to=["user@example.com"],
                subject="Hello",
                html="<p>Hi</p>",
            )

    assert exc_info.value.status_code == status.HTTP_502_BAD_GATEWAY


def test_verify_webhook_raises_503_when_secret_missing() -> None:
    """``verify_webhook`` raises 503 without a webhook secret."""

    service = EmailService(
        settings=_settings(resend_webhook_secret=None),
    )

    with pytest.raises(HTTPException) as exc_info:
        service.verify_webhook(
            payload="{}",
            svix_id="msg_1",
            svix_timestamp="123",
            svix_signature="v1,sig",
        )

    assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_verify_webhook_success_returns_event() -> None:
    """``verify_webhook`` returns the parsed event after verification."""

    service = EmailService(settings=_settings())
    payload = '{"type": "email.delivered", "data": {}}'

    with patch("app.services.email.resend.Webhooks.verify") as verify_mock:
        verify_mock.return_value = None

        event = service.verify_webhook(
            payload=payload,
            svix_id="msg_1",
            svix_timestamp="123",
            svix_signature="v1,sig",
        )

    assert event["type"] == "email.delivered"
    verify_mock.assert_called_once()


def test_verify_webhook_raises_400_on_resend_error() -> None:
    """``verify_webhook`` maps signature failures to 400."""

    from resend.exceptions import ResendError

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Webhooks.verify") as verify_mock:
        verify_mock.side_effect = ResendError(
            400,
            "validation_error",
            "bad signature",
            "check webhook secret",
        )

        with pytest.raises(HTTPException) as exc_info:
            service.verify_webhook(
                payload="{}",
                svix_id="msg_1",
                svix_timestamp="123",
                svix_signature="v1,bad",
            )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_verify_webhook_raises_400_on_invalid_json() -> None:
    """``verify_webhook`` raises 400 when the payload is not JSON."""

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Webhooks.verify") as verify_mock:
        verify_mock.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            service.verify_webhook(
                payload="not-json",
                svix_id="msg_1",
                svix_timestamp="123",
                svix_signature="v1,sig",
            )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_verify_webhook_raises_400_when_payload_not_object() -> None:
    """``verify_webhook`` raises 400 when JSON root is not an object."""

    service = EmailService(settings=_settings())

    with patch("app.services.email.resend.Webhooks.verify") as verify_mock:
        verify_mock.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            service.verify_webhook(
                payload="[1, 2]",
                svix_id="msg_1",
                svix_timestamp="123",
                svix_signature="v1,sig",
            )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


def test_init_sets_resend_api_key() -> None:
    """Constructing the service assigns ``resend.api_key`` when configured."""

    with patch("app.services.email.resend") as resend_mod:
        resend_mod.api_key = None
        EmailService(settings=_settings(resend_api_key="re_live"))

    assert resend_mod.api_key == "re_live"
