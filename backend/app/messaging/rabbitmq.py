"""RabbitMQ connection, publish, and consumer lifecycle (aio-pika)."""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import aio_pika
from aio_pika import Message
from aio_pika.abc import (
    AbstractChannel,
    AbstractIncomingMessage,
    AbstractRobustConnection,
)

from app.config import settings
from app.messaging.watch_worker import process_watch_message

_logger = logging.getLogger("uvicorn.error")


class RabbitMQClient:
    """Owns the shared RabbitMQ connection, channel, and consumer lifecycle."""

    def __init__(self) -> None:
        self._connection: Optional[AbstractRobustConnection] = None
        self._channel: Optional[AbstractChannel] = None
        self._consumer_tag: Optional[str] = None

    async def _get_connection(self) -> AbstractRobustConnection:
        """Return a robust connection, creating it if needed."""

        if self._connection is None or self._connection.is_closed:
            self._connection = await aio_pika.connect_robust(
                settings.rabbitmq_url,
            )

        return self._connection

    async def _get_channel(self) -> AbstractChannel:
        """Return a channel with the watch queue declared."""

        connection = await self._get_connection()

        if self._channel is None or self._channel.is_closed:
            self._channel = await connection.channel()
            await self._channel.set_qos(prefetch_count=32)
            await self._channel.declare_queue(
                settings.rabbitmq_watch_queue,
                durable=True,
            )

        return self._channel

    async def publish_watch_message(self, payload: dict[str, Any]) -> None:
        """Publish a watch pipeline message to the configured queue.

        When RabbitMQ is disabled, process the message inline.
        """

        if not settings.rabbitmq_enabled:
            await process_watch_message(payload)

            return

        channel = await self._get_channel()
        body = json.dumps(payload, default=str).encode("utf-8")
        message = Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            content_type="application/json",
        )
        await channel.default_exchange.publish(
            message,
            routing_key=settings.rabbitmq_watch_queue,
        )

    async def start_watch_consumer(self) -> None:
        """Start consuming the watch queue (no-op when RabbitMQ is disabled)."""

        if not settings.rabbitmq_enabled:
            _logger.info("RabbitMQ disabled — watch consumer not started")

            return

        channel = await self._get_channel()
        queue = await channel.declare_queue(
            settings.rabbitmq_watch_queue,
            durable=True,
        )

        async def on_message(message: AbstractIncomingMessage) -> None:
            async with message.process(requeue=False):
                try:
                    payload = json.loads(message.body.decode("utf-8"))
                    await process_watch_message(payload)
                except json.JSONDecodeError, KeyError, TypeError, ValueError:
                    _logger.exception("Failed to process watch message")

        self._consumer_tag = await queue.consume(on_message)
        _logger.info(
            "RabbitMQ watch consumer started queue=%s",
            settings.rabbitmq_watch_queue,
        )

    async def close(self) -> None:
        """Close channel and connection."""

        self._consumer_tag = None

        if self._channel is not None and not self._channel.is_closed:
            await self._channel.close()

        self._channel = None

        if self._connection is not None and not self._connection.is_closed:
            await self._connection.close()

        self._connection = None


_client = RabbitMQClient()


async def publish_watch_message(payload: dict[str, Any]) -> None:
    """Publish a watch pipeline message via the shared client."""

    await _client.publish_watch_message(payload)


async def start_watch_consumer() -> None:
    """Start the shared client's watch consumer."""

    await _client.start_watch_consumer()


async def close_rabbitmq() -> None:
    """Close the shared RabbitMQ client."""

    await _client.close()
