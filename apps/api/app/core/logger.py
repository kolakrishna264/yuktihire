"""
Structured logging for YuktiHire.

Usage:
    from app.core.logger import log

    log.info("request_completed", route="/api/v1/tailor", method="POST", duration_ms=234, user_id="xxx")
    log.warning("rate_limit_hit", user_id="xxx", route="/api/v1/answers/generate")
    log.error("ai_call_failed", job_type="tailor_resume", error="timeout")
"""
import json
import time
import logging
import sys
from datetime import datetime, timezone
from typing import Optional


class StructuredLogger:
    """JSON-structured logger for production observability."""

    def __init__(self, name: str = "yukti"):
        self._logger = logging.getLogger(name)
        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter("%(message)s"))
            self._logger.addHandler(handler)
            self._logger.setLevel(logging.INFO)

    def _emit(self, level: str, event: str, **kwargs):
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "event": event,
        }
        # Add all kwargs, but redact sensitive fields
        for k, v in kwargs.items():
            if k in ("password", "token", "api_key", "secret"):
                entry[k] = "***"
            elif k in ("prompt", "resume_text", "jd_text") and isinstance(v, str) and len(v) > 200:
                entry[k] = v[:200] + "...[truncated]"
            else:
                entry[k] = v

        self._logger.log(
            getattr(logging, level.upper(), logging.INFO),
            json.dumps(entry, default=str),
        )

    def info(self, event: str, **kwargs):
        self._emit("info", event, **kwargs)

    def warning(self, event: str, **kwargs):
        self._emit("warning", event, **kwargs)

    def error(self, event: str, **kwargs):
        self._emit("error", event, **kwargs)

    def debug(self, event: str, **kwargs):
        self._emit("debug", event, **kwargs)


# Singleton
log = StructuredLogger()


# ── Request Logging Middleware ──

class RequestLoggingMiddleware:
    """Logs every request with timing, status, and user_id."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.time()
        path = scope.get("path", "")
        method = scope.get("method", "")
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = round((time.time() - start) * 1000)
            # Only log API requests (skip static, health)
            if path.startswith("/api/") and path != "/health":
                log.info("request",
                    route=path, method=method,
                    status=status_code, duration_ms=duration_ms,
                )
