"""Hermes UI WebSocket gateway platform plugin.

This adapter serves hermes-ui's custom /client-ws protocol and converts
frontend messages into Hermes MessageEvent objects. The important routing rule
is explicit: inbound session_id/history_uid becomes SessionSource.thread_id.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import sqlite3
import struct
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import wave
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

try:
    from aiohttp import WSMsgType, web
    AIOHTTP_AVAILABLE = True
except Exception:  # pragma: no cover - import-time dependency probe
    WSMsgType = None  # type: ignore[assignment]
    web = None  # type: ignore[assignment]
    AIOHTTP_AVAILABLE = False

from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import BasePlatformAdapter, MessageEvent, MessageType, SendResult
from gateway.session import SessionSource

logger = logging.getLogger(__name__)

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 18765
DEFAULT_SESSION_ID = "chat-main"
DEFAULT_SAMPLE_RATE = 16_000
MAX_WS_BYTES = 12_000_000
DEFAULT_CONFIG_FILE = "Nami.yaml"
DEFAULT_CHARACTER_DIRS = [
    Path("/Users/bread/Documents/hermes-ui/characters"),
    Path("/Users/bread/Documents/Open-LLM-VTuber/characters"),
]
DEFAULT_MODEL_DICT = Path("/Users/bread/Documents/hermes-ui/model_dict.json")
DEFAULT_FRONTEND_ROOT = Path("/Users/bread/Documents/hermes-ui/src/renderer/public")
HERMES_CONFIG_PATH = Path("/Users/bread/.hermes/config.yaml")
HERMES_SESSIONS_PATH = Path("/Users/bread/.hermes/sessions/sessions.json")
HERMES_STATE_DB_PATH = Path("/Users/bread/.hermes/state.db")
HERMES_UI_USAGE_DB_PATH = Path("/Users/bread/.hermes/hermes_ui_usage.db")


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_id(value: Any, default: str) -> str:
    text = str(value or "").strip()
    if not text:
        return default
    return text[:128]


def _write_float32_wav(samples: list[float], sample_rate: int) -> str:
    fd, path = tempfile.mkstemp(prefix="hermes_ui_voice_", suffix=".wav")
    os.close(fd)
    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        frames = bytearray()
        for sample in samples:
            try:
                value = float(sample)
            except (TypeError, ValueError):
                value = 0.0
            if not math.isfinite(value):
                value = 0.0
            value = max(-1.0, min(1.0, value))
            frames.extend(struct.pack("<h", int(value * 32767.0)))
        wav.writeframes(bytes(frames))
    return path


async def _add_cors_headers(request: web.Request, response: web.StreamResponse) -> None:
    response.headers.setdefault("Access-Control-Allow-Origin", "*")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "*")


class HermesUIAdapter(BasePlatformAdapter):
    """Local WebSocket server for hermes-ui."""

    def __init__(self, config: PlatformConfig):
        super().__init__(config, Platform("hermes_ui"))
        extra = getattr(config, "extra", {}) or {}
        self.host = os.getenv("HERMES_UI_HOST") or extra.get("host") or DEFAULT_HOST
        self.port = _coerce_int(os.getenv("HERMES_UI_PORT") or extra.get("port"), DEFAULT_PORT)
        self.sample_rate = _coerce_int(
            os.getenv("HERMES_UI_SAMPLE_RATE") or extra.get("sample_rate"),
            DEFAULT_SAMPLE_RATE,
        )
        self.client_token = os.getenv("HERMES_UI_CLIENT_TOKEN") or extra.get("client_token") or ""
        self.path = extra.get("path") or "/client-ws"

        self._app: Optional[web.Application] = None if web is None else web.Application(client_max_size=MAX_WS_BYTES)
        if self._app is not None:
            self._app.on_response_prepare.append(_add_cors_headers)
        self._runner: Optional[web.AppRunner] = None
        self._site: Optional[web.TCPSite] = None
        self._clients: Dict[str, web.WebSocketResponse] = {}
        self._client_sessions: Dict[str, str] = {}
        self._client_configs: Dict[str, str] = {}
        self._audio_buffers: Dict[tuple[str, str], list[float]] = {}
        self._histories: Dict[str, list[Dict[str, Any]]] = {}
        self._history_messages: Dict[tuple[str, str], list[Dict[str, Any]]] = {}
        self._session_runtime: Dict[str, Dict[str, Any]] = {}

        if self._app is not None:
            self._app.router.add_get(self.path, self._handle_ws)
            self._app.router.add_get("/health", self._handle_health)
            self._app.router.add_get("/dashboard", self._handle_dashboard)
            self._app.router.add_get("/api/dashboard/usage", self._handle_dashboard_usage)
            self._app.router.add_get("/api/infra/tts-health", self._handle_tts_health)
            self._app.router.add_post("/api/infra/tts-speech", self._handle_tts_speech)
            self._app.router.add_options("/api/infra/tts-speech", self._handle_options)
            self._app.router.add_get("/", self._handle_health)
            self._add_static_routes()

    @property
    def enforces_own_access_policy(self) -> bool:
        # This adapter is intended for a local trusted UI. Optional token auth is
        # enforced at WebSocket intake; do not require gateway allowlist env vars.
        return True

    async def connect(self) -> bool:
        if not AIOHTTP_AVAILABLE or self._app is None:
            logger.error("aiohttp is required for hermes_ui platform adapter")
            return False
        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, self.host, self.port)
        await self._site.start()
        self._mark_connected()
        logger.info("Hermes UI adapter listening on ws://%s:%s%s", self.host, self.port, self.path)
        return True

    async def disconnect(self) -> None:
        self._running = False
        for ws in list(self._clients.values()):
            try:
                await ws.close()
            except Exception:
                pass
        self._clients.clear()
        self._client_sessions.clear()
        self._client_configs.clear()
        self._audio_buffers.clear()
        self._histories.clear()
        self._history_messages.clear()
        self._session_runtime.clear()
        if self._runner is not None:
            await self._runner.cleanup()
        self._runner = None
        self._site = None

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SendResult:
        target = str(chat_id)
        ws = self._clients.get(target)
        client_id = target if ws is not None and not ws.closed else None

        # Cross-platform delivery (webhooks/send_message) often addresses
        # Hermes UI by stable conversation/session id (for example
        # "chat-main"), while websocket connections are keyed by ephemeral
        # client_id values generated by the browser.  Resolve a session target
        # to a currently connected client before failing.
        if client_id is None:
            for candidate_id, candidate_session in list(self._client_sessions.items()):
                candidate_ws = self._clients.get(candidate_id)
                if candidate_session == target and candidate_ws is not None and not candidate_ws.closed:
                    client_id = candidate_id
                    ws = candidate_ws
                    break

        # If callers target the default session and no client has sent a
        # message yet, every new browser client is still implicitly on
        # DEFAULT_SESSION_ID. Route to the first live client so passive webhook
        # notifications can land in an open UI without requiring a prior chat.
        if client_id is None and target == DEFAULT_SESSION_ID:
            for candidate_id, candidate_ws in list(self._clients.items()):
                if candidate_ws is not None and not candidate_ws.closed:
                    client_id = candidate_id
                    ws = candidate_ws
                    break

        if ws is None or ws.closed or client_id is None:
            return SendResult(success=False, error=f"Hermes UI client not connected: {chat_id}")
        session_id = self._session_id_from_metadata(metadata) or self._client_sessions.get(client_id) or target or DEFAULT_SESSION_ID
        message_id = str(uuid.uuid4())
        payload = {
            "type": "full-text",
            "text": content,
            "session_id": session_id,
            "message_id": message_id,
            "timestamp": int(time.time() * 1000),
        }
        if metadata:
            if metadata.get("run_id"):
                payload["run_id"] = metadata.get("run_id")
            if metadata.get("hermes_session_id"):
                payload["hermes_session_id"] = metadata.get("hermes_session_id")
        try:
            await ws.send_json(payload)
            await self._send_runtime_status(client_id, session_id, state="complete")
            await ws.send_json({"type": "control", "text": "conversation-chain-end", "session_id": session_id})
            return SendResult(success=True, message_id=message_id)
        except Exception as exc:
            return SendResult(success=False, error=str(exc), retryable=True)

    async def send_typing(self, chat_id: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        ws = self._clients.get(str(chat_id))
        if ws is None or ws.closed:
            return
        session_id = self._session_id_from_metadata(metadata) or self._client_sessions.get(str(chat_id)) or DEFAULT_SESSION_ID
        try:
            self._session_runtime[session_id] = {
                "state": "running",
                "prompt_started_at": int(time.time() * 1000),
                "prompt_elapsed_ms": 0,
            }
            await self._send_runtime_status(str(chat_id), session_id, state="running")
            await ws.send_json({"type": "control", "text": "conversation-chain-start", "session_id": session_id})
        except Exception:
            pass

    async def get_chat_info(self, chat_id: str) -> Dict[str, Any]:
        return {"name": f"hermes-ui:{chat_id}", "type": "dm"}

    async def _handle_health(self, request: web.Request) -> web.Response:
        session_id = request.query.get("session_id") or DEFAULT_SESSION_ID
        return web.json_response({
            "ok": True,
            "platform": "hermes_ui",
            "clients": len(self._clients),
            "runtime": self._build_runtime_status(session_id=session_id),
        })

    def _load_runtime_config(self) -> Dict[str, Any]:
        try:
            if HERMES_CONFIG_PATH.exists():
                data = yaml.safe_load(HERMES_CONFIG_PATH.read_text()) or {}
                return data if isinstance(data, dict) else {}
        except Exception as exc:
            logger.debug("Hermes UI runtime config read failed: %s", exc)
        return {}

    def _load_session_entry(self, session_id: str) -> Dict[str, Any]:
        try:
            if not HERMES_SESSIONS_PATH.exists():
                return {}
            data = json.loads(HERMES_SESSIONS_PATH.read_text() or "{}")
            if not isinstance(data, dict):
                return {}
            matches = []
            for entry in data.values():
                if not isinstance(entry, dict):
                    continue
                origin = entry.get("origin") or {}
                if entry.get("platform") != "hermes_ui" and origin.get("platform") != "hermes_ui":
                    continue
                if origin.get("thread_id") == session_id or entry.get("session_key", "").endswith(f":{session_id}"):
                    matches.append(entry)
            if not matches:
                return {}
            matches.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
            return matches[0]
        except Exception as exc:
            logger.debug("Hermes UI runtime session read failed: %s", exc)
        return {}

    def _resolve_model_status(self) -> Dict[str, Any]:
        cfg = self._load_runtime_config()
        model_cfg = cfg.get("model") if isinstance(cfg.get("model"), dict) else {}
        model = os.getenv("HERMES_MODEL") or model_cfg.get("default") or model_cfg.get("model") or "Hermes"
        provider = os.getenv("HERMES_PROVIDER") or model_cfg.get("provider") or ""
        base_url = os.getenv("HERMES_BASE_URL") or model_cfg.get("base_url") or ""
        context_length = None
        try:
            raw_context = model_cfg.get("context_length")
            if raw_context:
                context_length = int(raw_context)
        except Exception:
            context_length = None
        if not context_length and model:
            try:
                from agent.model_metadata import get_model_context_length
                context_length = get_model_context_length(
                    str(model),
                    base_url=str(base_url or ""),
                    provider=str(provider or ""),
                    config_context_length=None,
                    custom_providers=cfg.get("custom_providers") if isinstance(cfg.get("custom_providers"), list) else None,
                )
            except Exception as exc:
                logger.debug("Hermes UI context length lookup failed: %s", exc)
                context_length = None
        model_short = str(model).rsplit("/", 1)[-1] if model else "Hermes"
        if model_short.endswith(".gguf"):
            model_short = model_short[:-5]
        return {
            "model": model,
            "model_short": model_short[:26],
            "provider": provider,
            "context_length": context_length,
        }

    def _build_runtime_status(self, session_id: str = DEFAULT_SESSION_ID, state: Optional[str] = None) -> Dict[str, Any]:
        model_status = self._resolve_model_status()
        entry = self._load_session_entry(session_id)
        runtime = dict(self._session_runtime.get(session_id) or {})
        now_ms = int(time.time() * 1000)
        prompt_started_at = runtime.get("prompt_started_at")
        prompt_elapsed_ms = runtime.get("prompt_elapsed_ms") or 0
        effective_state = state or runtime.get("state") or "idle"
        if effective_state == "running" and prompt_started_at:
            prompt_elapsed_ms = max(0, now_ms - int(prompt_started_at))
        elif prompt_started_at and not prompt_elapsed_ms:
            prompt_elapsed_ms = max(0, now_ms - int(prompt_started_at))

        context_tokens = int(entry.get("last_prompt_tokens") or 0)
        context_length = model_status.get("context_length")
        context_percent = None
        if context_length:
            context_percent = max(0, min(100, round((context_tokens / int(context_length)) * 100)))
        status = {
            **model_status,
            "session_id": session_id,
            "hermes_session_id": entry.get("session_id"),
            "context_tokens": context_tokens,
            "context_percent": context_percent,
            "compressions": runtime.get("compressions", 0),
            "active_background_tasks": 0,
            "active_background_processes": 0,
            "session_total_tokens": int(entry.get("total_tokens") or 0),
            "state": effective_state,
            "prompt_started_at": prompt_started_at if effective_state == "running" else None,
            "prompt_elapsed_ms": prompt_elapsed_ms,
            "updated_at": entry.get("updated_at"),
            "timestamp": now_ms,
        }
        try:
            from tools.process_registry import process_registry
            status["active_background_processes"] = process_registry.count_running()
        except Exception:
            pass
        return status

    async def _send_runtime_status(self, client_id: str, session_id: str, state: Optional[str] = None) -> None:
        ws = self._clients.get(str(client_id))
        if ws is None or ws.closed:
            return
        status = self._build_runtime_status(session_id=session_id, state=state)
        if state == "complete":
            existing = self._session_runtime.get(session_id) or {}
            started_at = existing.get("prompt_started_at")
            if started_at:
                status["prompt_elapsed_ms"] = max(0, int(time.time() * 1000) - int(started_at))
            status["prompt_started_at"] = None
            status["state"] = "idle"
            self._session_runtime[session_id] = {
                "state": "idle",
                "prompt_elapsed_ms": status["prompt_elapsed_ms"],
            }
        await ws.send_json({"type": "runtime-status", "runtime": status, **status})

    async def _handle_options(self, request: web.Request) -> web.Response:
        return web.Response(status=204)

    @staticmethod
    def _period_sql(period: str) -> tuple[str, str]:
        if period == "week":
            return "%Y-W%W", "week"
        if period == "month":
            return "%Y-%m", "month"
        if period == "year":
            return "%Y", "year"
        return "%Y-%m-%d", "day"

    @staticmethod
    def _usage_limit(period: str, raw_limit: Any) -> int:
        default = {"day": 31, "week": 12, "month": 12, "year": 5}.get(period, 31)
        limit = _coerce_int(raw_limit, default)
        return max(1, min(limit, 366))

    @staticmethod
    def _init_usage_db() -> None:
        HERMES_UI_USAGE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(HERMES_UI_USAGE_DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at REAL NOT NULL,
                    provider TEXT NOT NULL,
                    category TEXT NOT NULL,
                    model TEXT,
                    unit TEXT NOT NULL,
                    amount INTEGER NOT NULL DEFAULT 0,
                    input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                    audio_bytes INTEGER NOT NULL DEFAULT 0,
                    request_count INTEGER NOT NULL DEFAULT 1,
                    metadata TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_usage_events_provider ON usage_events(provider, category)")

    @staticmethod
    def _record_usage_event(
        *,
        provider: str,
        category: str,
        model: str = "",
        unit: str = "tokens",
        amount: int = 0,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cache_read_tokens: int = 0,
        cache_write_tokens: int = 0,
        reasoning_tokens: int = 0,
        audio_bytes: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            HermesUIAdapter._init_usage_db()
            with sqlite3.connect(HERMES_UI_USAGE_DB_PATH) as conn:
                conn.execute(
                    """
                    INSERT INTO usage_events (
                        created_at, provider, category, model, unit, amount,
                        input_tokens, output_tokens, cache_read_tokens,
                        cache_write_tokens, reasoning_tokens, audio_bytes,
                        request_count, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                    """,
                    (
                        time.time(),
                        provider,
                        category,
                        model,
                        unit,
                        int(amount or 0),
                        int(input_tokens or 0),
                        int(output_tokens or 0),
                        int(cache_read_tokens or 0),
                        int(cache_write_tokens or 0),
                        int(reasoning_tokens or 0),
                        int(audio_bytes or 0),
                        json.dumps(metadata or {}, sort_keys=True),
                    ),
                )
        except Exception as exc:
            logger.warning("Failed to record Hermes UI usage event: %s", exc)

    @staticmethod
    def _query_llm_usage(period: str, limit: int) -> list[Dict[str, Any]]:
        if not HERMES_STATE_DB_PATH.exists():
            return []
        period_format, _ = HermesUIAdapter._period_sql(period)
        sql = f"""
            SELECT
                strftime('{period_format}', datetime(started_at, 'unixepoch', 'localtime')) AS bucket,
                COALESCE(NULLIF(billing_provider, ''), 'gpt') AS provider,
                COALESCE(NULLIF(model, ''), 'unknown') AS model,
                COUNT(*) AS request_count,
                SUM(COALESCE(input_tokens, 0)) AS input_tokens,
                SUM(COALESCE(output_tokens, 0)) AS output_tokens,
                SUM(COALESCE(cache_read_tokens, 0)) AS cache_read_tokens,
                SUM(COALESCE(cache_write_tokens, 0)) AS cache_write_tokens,
                SUM(COALESCE(reasoning_tokens, 0)) AS reasoning_tokens,
                SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) +
                    COALESCE(cache_read_tokens, 0) + COALESCE(cache_write_tokens, 0) +
                    COALESCE(reasoning_tokens, 0)) AS amount,
                SUM(COALESCE(estimated_cost_usd, 0)) AS estimated_cost_usd,
                SUM(COALESCE(actual_cost_usd, 0)) AS actual_cost_usd
            FROM sessions
            WHERE started_at IS NOT NULL
            GROUP BY bucket, provider, model
            ORDER BY bucket DESC
            LIMIT ?
        """
        try:
            with sqlite3.connect(f"file:{HERMES_STATE_DB_PATH}?mode=ro", uri=True) as conn:
                conn.row_factory = sqlite3.Row
                return [dict(row) | {"category": "llm", "unit": "tokens"} for row in conn.execute(sql, (limit * 20,)).fetchall()]
        except Exception as exc:
            logger.warning("Failed to query Hermes LLM usage: %s", exc)
            return []

    @staticmethod
    def _query_plugin_usage(period: str, limit: int) -> list[Dict[str, Any]]:
        if not HERMES_UI_USAGE_DB_PATH.exists():
            return []
        period_format, _ = HermesUIAdapter._period_sql(period)
        sql = f"""
            SELECT
                strftime('{period_format}', datetime(created_at, 'unixepoch', 'localtime')) AS bucket,
                provider,
                category,
                COALESCE(NULLIF(model, ''), 'default') AS model,
                unit,
                SUM(amount) AS amount,
                SUM(input_tokens) AS input_tokens,
                SUM(output_tokens) AS output_tokens,
                SUM(cache_read_tokens) AS cache_read_tokens,
                SUM(cache_write_tokens) AS cache_write_tokens,
                SUM(reasoning_tokens) AS reasoning_tokens,
                SUM(audio_bytes) AS audio_bytes,
                SUM(request_count) AS request_count,
                0.0 AS estimated_cost_usd,
                0.0 AS actual_cost_usd
            FROM usage_events
            GROUP BY bucket, provider, category, model, unit
            ORDER BY bucket DESC
            LIMIT ?
        """
        try:
            with sqlite3.connect(HERMES_UI_USAGE_DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                return [dict(row) for row in conn.execute(sql, (limit * 20,)).fetchall()]
        except Exception as exc:
            logger.warning("Failed to query Hermes UI usage: %s", exc)
            return []

    @staticmethod
    def _usage_dashboard_payload(period: str, limit: int) -> Dict[str, Any]:
        rows = HermesUIAdapter._query_llm_usage(period, limit) + HermesUIAdapter._query_plugin_usage(period, limit)
        rows.sort(key=lambda row: str(row.get("bucket") or ""), reverse=True)
        buckets = sorted({str(row.get("bucket") or "unknown") for row in rows}, reverse=True)[:limit]
        bucket_set = set(buckets)
        rows = [row for row in rows if str(row.get("bucket") or "unknown") in bucket_set]
        totals: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            provider = str(row.get("provider") or "unknown")
            entry = totals.setdefault(
                provider,
                {
                    "provider": provider,
                    "amount": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cache_read_tokens": 0,
                    "cache_write_tokens": 0,
                    "reasoning_tokens": 0,
                    "audio_bytes": 0,
                    "request_count": 0,
                    "estimated_cost_usd": 0.0,
                    "actual_cost_usd": 0.0,
                    "units": set(),
                    "categories": set(),
                },
            )
            for key in ["amount", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "audio_bytes", "request_count"]:
                entry[key] += int(row.get(key) or 0)
            entry["estimated_cost_usd"] += float(row.get("estimated_cost_usd") or 0.0)
            entry["actual_cost_usd"] += float(row.get("actual_cost_usd") or 0.0)
            entry["units"].add(str(row.get("unit") or "tokens"))
            entry["categories"].add(str(row.get("category") or "unknown"))
        serializable_totals = []
        for entry in totals.values():
            entry["units"] = sorted(entry["units"])
            entry["categories"] = sorted(entry["categories"])
            serializable_totals.append(entry)
        serializable_totals.sort(key=lambda row: int(row.get("amount") or 0), reverse=True)
        return {
            "ok": True,
            "period": period,
            "limit": limit,
            "generated_at": int(time.time()),
            "sources": {
                "llm_sessions": str(HERMES_STATE_DB_PATH),
                "ui_usage_events": str(HERMES_UI_USAGE_DB_PATH),
            },
            "rows": rows,
            "totals": serializable_totals,
        }

    async def _handle_dashboard_usage(self, request: web.Request) -> web.Response:
        period = str(request.query.get("period") or "day").strip().lower()
        _, period = self._period_sql(period)
        limit = self._usage_limit(period, request.query.get("limit"))
        payload = await asyncio.to_thread(self._usage_dashboard_payload, period, limit)
        return web.json_response(payload)

    async def _handle_dashboard(self, request: web.Request) -> web.Response:
        html = """<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Hermes Usage Dashboard</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background: #071312; color: #d8fff7; }
    body { margin: 0; padding: 28px; background: radial-gradient(circle at top left, #123934 0, #071312 34%, #050808 100%); }
    h1 { margin: 0 0 6px; color: #73ffe2; letter-spacing: -0.04em; }
    .sub { color: #89bcb2; margin-bottom: 22px; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
    button { background: #0d2b28; border: 1px solid #1e6c62; color: #d8fff7; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
    button.active, button:hover { background: #17d8b5; color: #031110; border-color: #73ffe2; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 22px; }
    .card { border: 1px solid rgba(115,255,226,.26); background: rgba(4,18,17,.72); border-radius: 16px; padding: 14px; box-shadow: 0 0 26px rgba(23,216,181,.08); }
    .provider { color: #73ffe2; font-weight: 700; text-transform: uppercase; font-size: 12px; }
    .amount { font-size: 28px; margin-top: 8px; }
    .muted { color: #89bcb2; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; background: rgba(4,18,17,.72); border: 1px solid rgba(115,255,226,.22); border-radius: 16px; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid rgba(115,255,226,.12); text-align: right; }
    th:first-child, td:first-child, th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3) { text-align: left; }
    th { color: #73ffe2; background: rgba(12,55,49,.7); font-size: 12px; text-transform: uppercase; }
    tr:hover td { background: rgba(23,216,181,.06); }
    .error { color: #ff8a8a; }
  </style>
</head>
<body>
  <h1>Hermes usage dashboard</h1>
  <div class=\"sub\">LLM tokens from Hermes sessions + TTS character usage recorded by the Hermes UI adapter.</div>
  <div class=\"controls\" id=\"controls\"></div>
  <div id=\"status\" class=\"sub\">Loading…</div>
  <div class=\"cards\" id=\"cards\"></div>
  <table>
    <thead><tr><th>Bucket</th><th>Provider</th><th>Category</th><th>Model</th><th>Unit</th><th>Amount</th><th>In</th><th>Out</th><th>Cache</th><th>Reason</th><th>Audio bytes</th><th>Requests</th></tr></thead>
    <tbody id=\"rows\"></tbody>
  </table>
<script>
const periods = ['day', 'week', 'month', 'year'];
let current = new URLSearchParams(location.search).get('period') || 'day';
const fmt = n => Number(n || 0).toLocaleString();
function esc(v) { return String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
async function load(period) {
  current = period;
  history.replaceState(null, '', `/dashboard?period=${period}`);
  document.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.period === period));
  const status = document.getElementById('status');
  status.textContent = 'Loading…';
  try {
    const res = await fetch(`/api/dashboard/usage?period=${period}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || res.statusText);
    status.textContent = `Showing ${data.rows.length} grouped rows. Generated ${new Date(data.generated_at * 1000).toLocaleString()}.`;
    document.getElementById('cards').innerHTML = data.totals.map(t => `<div class=\"card\"><div class=\"provider\">${esc(t.provider)}</div><div class=\"amount\">${fmt(t.amount)}</div><div class=\"muted\">${esc((t.units || []).join('+'))} • ${fmt(t.request_count)} requests</div><div class=\"muted\">in ${fmt(t.input_tokens)} / out ${fmt(t.output_tokens)} / audio ${fmt(t.audio_bytes)} bytes</div></div>`).join('');
    document.getElementById('rows').innerHTML = data.rows.map(r => `<tr><td>${esc(r.bucket)}</td><td>${esc(r.provider)}</td><td>${esc(r.category)}</td><td>${esc(r.model)}</td><td>${esc(r.unit)}</td><td>${fmt(r.amount)}</td><td>${fmt(r.input_tokens)}</td><td>${fmt(r.output_tokens)}</td><td>${fmt((r.cache_read_tokens||0)+(r.cache_write_tokens||0))}</td><td>${fmt(r.reasoning_tokens)}</td><td>${fmt(r.audio_bytes)}</td><td>${fmt(r.request_count)}</td></tr>`).join('');
  } catch (err) {
    status.innerHTML = `<span class=\"error\">${esc(err.message || err)}</span>`;
  }
}
document.getElementById('controls').innerHTML = periods.map(p => `<button data-period=\"${p}\">${p}</button>`).join('');
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => load(b.dataset.period)));
load(periods.includes(current) ? current : 'day');
</script>
</body>
</html>"""
        return web.Response(text=html, content_type="text/html")

    @staticmethod
    def _read_frontend_env() -> Dict[str, str]:
        env_path = Path("/Users/bread/Documents/hermes-ui/.env.local")
        values: Dict[str, str] = {}
        if not env_path.exists():
            return values
        for raw_line in env_path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
        return values

    @staticmethod
    def _tts_env_value(env_values: Dict[str, str], *names: str, default: str = "") -> str:
        for name in names:
            value = os.getenv(name) or env_values.get(name)
            if value:
                return value
        return default

    @staticmethod
    def _tts_int_env_value(env_values: Dict[str, str], *names: str, default: int) -> int:
        raw_value = HermesUIAdapter._tts_env_value(env_values, *names, default=str(default))
        try:
            return int(raw_value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _fish_tts_settings(env_values: Dict[str, str]) -> Dict[str, Any]:
        return {
            "api_key": HermesUIAdapter._tts_env_value(
                env_values,
                "VITE_FISH_AUDIO_API_KEY",
                "FISH_AUDIO_API_KEY",
                "VITE_FISH_API_KEY",
                "FISH_API_KEY",
            ),
            "reference_id": HermesUIAdapter._tts_env_value(
                env_values,
                "VITE_FISH_AUDIO_REFERENCE_ID",
                "FISH_AUDIO_REFERENCE_ID",
                "VITE_FISH_REFERENCE_ID",
                "FISH_REFERENCE_ID",
            ),
            "model_id": HermesUIAdapter._tts_env_value(
                env_values,
                "VITE_FISH_AUDIO_MODEL",
                "FISH_AUDIO_MODEL",
                default="s2-pro",
            ),
            "format": HermesUIAdapter._tts_env_value(
                env_values,
                "VITE_FISH_AUDIO_FORMAT",
                "FISH_AUDIO_FORMAT",
                default="mp3",
            ),
            "sample_rate": HermesUIAdapter._tts_int_env_value(
                env_values,
                "VITE_FISH_AUDIO_SAMPLE_RATE",
                "FISH_AUDIO_SAMPLE_RATE",
                default=44100,
            ),
            "mp3_bitrate": HermesUIAdapter._tts_int_env_value(
                env_values,
                "VITE_FISH_AUDIO_MP3_BITRATE",
                "FISH_AUDIO_MP3_BITRATE",
                default=128,
            ),
            "latency": HermesUIAdapter._tts_env_value(
                env_values,
                "VITE_FISH_AUDIO_LATENCY",
                "FISH_AUDIO_LATENCY",
                default="normal",
            ),
        }

    @staticmethod
    def _probe_fish_audio(api_key: str) -> Dict[str, Any]:
        url = "https://api.fish.audio/model?" + urllib.parse.urlencode({"page_size": 1, "page_number": 1, "self": "true"})
        request = urllib.request.Request(
            url,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                body = response.read().decode("utf-8", errors="replace")
                payload = json.loads(body or "{}")
                return {
                    "ok": 200 <= response.status < 300,
                    "status": response.status,
                    "model_count": payload.get("total"),
                    "has_more": payload.get("has_more"),
                }
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            error_payload: Any = None
            try:
                error_payload = json.loads(body)
            except Exception:
                error_payload = body
            return {"ok": False, "status": exc.code, "error": error_payload or exc.reason}
        except Exception as exc:
            return {"ok": False, "status": None, "error": str(exc)}

    async def _handle_tts_health(self, request: web.Request) -> web.Response:
        env_values = self._read_frontend_env()
        settings = self._fish_tts_settings(env_values)
        api_key = str(settings.get("api_key") or "")

        if not api_key:
            return web.json_response({
                "ok": False,
                "provider": "fish-audio",
                "configured": False,
                "error": "Fish Audio API key is not configured; browser speechSynthesis fallback is disabled.",
            }, status=400)

        probe = await asyncio.to_thread(self._probe_fish_audio, api_key)
        ok = bool(probe.get("ok"))
        status = 200 if ok else 502
        payload = {
            "ok": ok,
            "provider": "fish-audio",
            "configured": True,
            "reference_id": settings.get("reference_id") or "",
            "voice_id": settings.get("reference_id") or "",
            "model_id": settings.get("model_id"),
            "format": settings.get("format"),
            "sample_rate": settings.get("sample_rate"),
            "mp3_bitrate": settings.get("mp3_bitrate"),
            "latency": settings.get("latency"),
            **probe,
        }
        if not ok and "error" not in payload:
            payload["error"] = "Fish Audio API probe failed"
        return web.json_response(payload, status=status)

    @staticmethod
    def _synthesize_fish_speech(settings: Dict[str, Any], text: str) -> tuple[bytes, str]:
        api_key = str(settings.get("api_key") or "")
        output_format = str(settings.get("format") or "mp3")
        body: Dict[str, Any] = {
            "text": text,
            "format": output_format,
            "sample_rate": int(settings.get("sample_rate") or 44100),
            "mp3_bitrate": int(settings.get("mp3_bitrate") or 128),
            "normalize": True,
            "latency": str(settings.get("latency") or "normal"),
        }
        reference_id = str(settings.get("reference_id") or "")
        if reference_id:
            body["reference_id"] = reference_id

        request = urllib.request.Request(
            "https://api.fish.audio/v1/tts",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": f"audio/{output_format}",
                "model": str(settings.get("model_id") or "s2-pro"),
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            content_type = response.headers.get("Content-Type") or f"audio/{output_format}"
            return response.read(), content_type

    async def _handle_tts_speech(self, request: web.Request) -> web.Response:
        env_values = self._read_frontend_env()
        settings = self._fish_tts_settings(env_values)
        if not settings.get("api_key"):
            return web.json_response({"ok": False, "error": "Fish Audio API key is not configured"}, status=400)

        try:
            payload = await request.json()
        except Exception:
            return web.json_response({"ok": False, "error": "Expected JSON body"}, status=400)

        text = str(payload.get("text") or "").strip() if isinstance(payload, dict) else ""
        if not text:
            return web.json_response({"ok": False, "error": "Missing text"}, status=400)

        try:
            audio, content_type = await asyncio.to_thread(
                self._synthesize_fish_speech,
                settings,
                text[:5000],
            )
            logger.info(
                "Hermes UI Fish Audio proxy synthesized speech: chars=%s bytes=%s reference_id=%s model=%s",
                len(text),
                len(audio),
                settings.get("reference_id") or "default",
                settings.get("model_id"),
            )
            self._record_usage_event(
                provider="fish-audio",
                category="tts",
                model=str(settings.get("model_id") or "s2-pro"),
                unit="characters",
                amount=len(text[:5000]),
                audio_bytes=len(audio),
                metadata={
                    "reference_id": settings.get("reference_id") or "",
                    "format": settings.get("format") or "mp3",
                    "latency": settings.get("latency") or "normal",
                },
            )
            return web.Response(body=audio, content_type=content_type.split(";", 1)[0])
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            error_payload: Any = body
            try:
                error_payload = json.loads(body)
            except Exception:
                pass
            return web.json_response({"ok": False, "status": exc.code, "error": error_payload or exc.reason}, status=502)
        except Exception as exc:
            return web.json_response({"ok": False, "error": str(exc)}, status=502)

    def _authorized(self, request: web.Request) -> bool:
        if not self.client_token:
            return True
        if request.query.get("token") == self.client_token:
            return True
        auth = request.headers.get("Authorization", "")
        return auth == f"Bearer {self.client_token}"

    async def _handle_ws(self, request: web.Request) -> web.WebSocketResponse:
        if not self._authorized(request):
            raise web.HTTPUnauthorized(text="Missing or invalid Hermes UI token")

        ws = web.WebSocketResponse(heartbeat=30, max_msg_size=MAX_WS_BYTES)
        await ws.prepare(request)

        client_id = request.query.get("client_id") or request.headers.get("X-Hermes-UI-Client-Id") or str(uuid.uuid4())
        client_id = _safe_id(client_id, str(uuid.uuid4()))
        self._clients[client_id] = ws
        self._client_sessions.setdefault(client_id, DEFAULT_SESSION_ID)

        await ws.send_json({"type": "control", "text": "connected", "client_id": client_id})
        await self._send_runtime_status(client_id, self._client_sessions[client_id])
        await self._send_model_and_conf(ws, client_id, self._client_sessions[client_id])
        logger.info("Hermes UI client connected: %s", client_id)

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    await self._handle_client_payload(client_id, ws, msg.data)
                elif msg.type == WSMsgType.ERROR:
                    logger.warning("Hermes UI websocket error: %s", ws.exception())
        finally:
            current = self._clients.get(client_id)
            if current is ws:
                self._clients.pop(client_id, None)
            self._client_sessions.pop(client_id, None)
            self._client_configs.pop(client_id, None)
            self._histories.pop(client_id, None)
            for key in [key for key in self._audio_buffers if key[0] == client_id]:
                self._audio_buffers.pop(key, None)
            for key in [key for key in self._history_messages if key[0] == client_id]:
                self._history_messages.pop(key, None)
            logger.info("Hermes UI client disconnected: %s", client_id)
        return ws

    async def _handle_client_payload(self, client_id: str, ws: web.WebSocketResponse, raw: str) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            await self._send_error(ws, "Invalid JSON", str(exc))
            return
        if not isinstance(data, dict):
            await self._send_error(ws, "Invalid message", "Expected a JSON object")
            return

        msg_type = str(data.get("type") or "").strip()
        session_id = self._session_id_from_payload(client_id, data)
        previous_session_id = self._client_sessions.get(client_id)
        self._client_sessions[client_id] = session_id
        if previous_session_id != session_id:
            await self._send_runtime_status(client_id, session_id)

        if msg_type == "text-input":
            text = str(data.get("text") or "").strip()
            if not text:
                return
            await self._dispatch_text(client_id, ws, data, text, session_id)
            return

        if msg_type == "mic-audio-data":
            chunk = data.get("audio") or []
            if isinstance(chunk, list):
                self._audio_buffers.setdefault((client_id, session_id), []).extend(chunk)
            return

        if msg_type == "mic-audio-end":
            await self._dispatch_voice(client_id, ws, data, session_id)
            return

        if msg_type == "fetch-backgrounds":
            await self._send_background_files(ws, session_id)
            return

        if msg_type == "fetch-configs":
            await self._send_config_files(ws, session_id)
            return

        if msg_type == "fetch-history-list":
            await self._send_history_list(client_id, ws, session_id)
            return

        if msg_type == "create-new-history":
            await self._create_new_history(client_id, ws)
            return

        if msg_type == "fetch-and-set-history":
            await self._send_history_data(client_id, ws, data, session_id)
            return

        if msg_type == "delete-history":
            await self._delete_history(client_id, ws, data, session_id)
            return

        if msg_type == "switch-config":
            await self._send_model_and_conf(ws, client_id, session_id, str(data.get("file") or ""))
            await ws.send_json({"type": "config-switched", "session_id": session_id})
            return

        await self._send_error(ws, "Unknown message type", msg_type, session_id=session_id)

    async def _send_background_files(self, ws: web.WebSocketResponse, session_id: str) -> None:
        files: list[Dict[str, str]] = []
        root = self._ui_public_root()
        if root is not None:
            for rel_dir in ("bg", "backgrounds"):
                directory = root / rel_dir
                if not directory.exists():
                    continue
                for path in sorted(directory.iterdir()):
                    if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                        files.append({"name": path.name, "url": f"/{rel_dir}/{path.name}"})
        if not files:
            files.append({"name": "ceiling-window-room-night.jpeg", "url": "/bg/ceiling-window-room-night.jpeg"})
        await ws.send_json({"type": "background-files", "files": files, "session_id": session_id})

    async def _send_config_files(self, ws: web.WebSocketResponse, session_id: str) -> None:
        configs: list[Dict[str, str]] = []
        config_dirs = []
        if os.getenv("HERMES_UI_CONFIG_DIR"):
            config_dirs.append(Path(os.getenv("HERMES_UI_CONFIG_DIR", "")))
        config_dirs.extend(DEFAULT_CHARACTER_DIRS)
        seen: set[str] = set()
        for directory in config_dirs:
            if not directory.exists():
                continue
            for path in sorted(directory.glob("*.yaml")):
                if path.name in seen:
                    continue
                seen.add(path.name)
                configs.append({"filename": path.name, "name": path.stem})
        await ws.send_json({"type": "config-files", "configs": configs, "session_id": session_id})

    async def _send_model_and_conf(
        self,
        ws: web.WebSocketResponse,
        client_id: str,
        session_id: str,
        config_file_name: str = "",
    ) -> None:
        try:
            character_config, config_path = self._load_character_config(config_file_name)
            self._client_configs[client_id] = config_path.name
            model_name = str(character_config.get("live2d_model_name") or "").strip()
            model_info = self._load_model_info(model_name) if model_name else None
            await ws.send_json({
                "type": "set-model-and-conf",
                "model_info": model_info,
                "conf_name": character_config.get("conf_name") or config_path.stem,
                "conf_uid": character_config.get("conf_uid") or config_path.stem,
                "client_uid": client_id,
                "session_id": session_id,
            })
        except Exception as exc:
            logger.exception("Failed to send Hermes UI model/config")
            await self._send_error(ws, "Failed to load character model config", str(exc), session_id=session_id)

    def _load_character_config(self, config_file_name: str = "") -> tuple[Dict[str, Any], Path]:
        requested = Path(config_file_name).name if config_file_name else ""
        default_name = os.getenv("HERMES_UI_DEFAULT_CONFIG") or DEFAULT_CONFIG_FILE
        target_names = [name for name in (requested, default_name) if name]
        config_dirs: list[Path] = []
        if os.getenv("HERMES_UI_CONFIG_DIR"):
            config_dirs.append(Path(os.getenv("HERMES_UI_CONFIG_DIR", "")))
        config_dirs.extend(DEFAULT_CHARACTER_DIRS)

        for name in target_names:
            for directory in config_dirs:
                path = directory / name
                if not path.exists():
                    continue
                data = yaml.safe_load(path.read_text()) or {}
                character_config = data.get("character_config")
                if not isinstance(character_config, dict):
                    raise ValueError(f"{path} is missing character_config")
                return character_config, path
        raise FileNotFoundError(f"No character config found for {target_names!r} in {[str(d) for d in config_dirs]}")

    def _load_active_character_prompt(self, client_id: str) -> str:
        config_name = self._client_configs.get(client_id) or os.getenv("HERMES_UI_DEFAULT_CONFIG") or DEFAULT_CONFIG_FILE
        try:
            character_config, _ = self._load_character_config(config_name)
        except Exception:
            logger.debug("Could not load active Hermes UI character prompt", exc_info=True)
            return ""
        prompt = str(character_config.get("persona_prompt") or "").strip()
        if not prompt:
            return ""
        character_name = str(character_config.get("character_name") or character_config.get("conf_name") or "character").strip()
        return (
            "Hermes UI character persona for this chat. Follow this persona for normal conversational replies, "
            "while still obeying higher-priority Hermes/system/developer instructions and tool-use requirements.\n\n"
            f"Active character: {character_name}\n\n{prompt}"
        )

    @staticmethod
    def _load_model_info(model_name: str) -> Optional[Dict[str, Any]]:
        model_dict_path = Path(os.getenv("HERMES_UI_MODEL_DICT") or DEFAULT_MODEL_DICT)
        model_dict = json.loads(model_dict_path.read_text())
        for item in model_dict:
            if item.get("name") == model_name:
                return dict(item)
        raise KeyError(f"Model {model_name!r} not found in {model_dict_path}")

    def _add_static_routes(self) -> None:
        if self._app is None:
            return
        frontend_root = Path(os.getenv("HERMES_UI_FRONTEND_ROOT") or DEFAULT_FRONTEND_ROOT)
        for route, relative in {
            "/models/": "models",
            "/avatars/": "avatars",
            "/bg/": "bg",
            "/backgrounds/": "bg",
            "/live2d-models/": "live2d-models",
        }.items():
            directory = frontend_root / relative
            if directory.exists():
                try:
                    self._app.router.add_static(route, directory, follow_symlinks=True)
                except RuntimeError:
                    logger.debug("Static route already registered: %s", route)

    async def _send_history_list(self, client_id: str, ws: web.WebSocketResponse, session_id: str) -> None:
        self._ensure_history(client_id, session_id)
        await ws.send_json({"type": "history-list", "histories": list(self._histories.get(client_id, [])), "session_id": session_id})

    async def _create_new_history(self, client_id: str, ws: web.WebSocketResponse) -> None:
        history_uid = f"chat-{uuid.uuid4().hex[:12]}"
        self._client_sessions[client_id] = history_uid
        history = {"uid": history_uid, "latest_message": None, "timestamp": self._iso_timestamp()}
        self._histories.setdefault(client_id, []).insert(0, history)
        self._history_messages[(client_id, history_uid)] = []
        await ws.send_json({"type": "new-history-created", "history_uid": history_uid, "session_id": history_uid})

    async def _send_history_data(self, client_id: str, ws: web.WebSocketResponse, data: Dict[str, Any], session_id: str) -> None:
        history_uid = _safe_id(data.get("history_uid") or session_id, session_id)
        self._ensure_history(client_id, history_uid)
        self._client_sessions[client_id] = history_uid
        await ws.send_json({
            "type": "history-data",
            "history_uid": history_uid,
            "session_id": history_uid,
            "messages": self._history_messages.get((client_id, history_uid), []),
        })

    async def _delete_history(self, client_id: str, ws: web.WebSocketResponse, data: Dict[str, Any], session_id: str) -> None:
        history_uid = _safe_id(data.get("history_uid"), "")
        success = bool(history_uid)
        if history_uid:
            self._histories[client_id] = [h for h in self._histories.get(client_id, []) if h.get("uid") != history_uid]
            self._history_messages.pop((client_id, history_uid), None)
        await ws.send_json({"type": "history-deleted", "success": success, "history_uid": history_uid, "session_id": session_id})

    def _ensure_history(self, client_id: str, session_id: str) -> None:
        histories = self._histories.setdefault(client_id, [])
        if any(history.get("uid") == session_id for history in histories):
            return
        histories.insert(0, {"uid": session_id, "latest_message": None, "timestamp": self._iso_timestamp()})
        self._history_messages.setdefault((client_id, session_id), [])

    @staticmethod
    def _iso_timestamp() -> str:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    @staticmethod
    def _ui_public_root() -> Optional[Path]:
        for raw in (
            os.getenv("HERMES_UI_PUBLIC_ROOT"),
            "/Users/bread/Documents/hermes-ui/src/renderer/public",
        ):
            if not raw:
                continue
            path = Path(raw)
            if path.exists():
                return path
        return None

    async def _dispatch_text(
        self,
        client_id: str,
        ws: web.WebSocketResponse,
        data: Dict[str, Any],
        text: str,
        session_id: str,
    ) -> None:
        await ws.send_json({"type": "control", "text": "conversation-chain-start", "session_id": session_id})
        event = self._make_event(client_id, data, text, session_id, MessageType.TEXT)
        await self.handle_message(event)

    async def _dispatch_voice(
        self,
        client_id: str,
        ws: web.WebSocketResponse,
        data: Dict[str, Any],
        session_id: str,
    ) -> None:
        key = (client_id, session_id)
        samples = self._audio_buffers.pop(key, [])
        if not samples:
            await self._send_error(ws, "No voice audio received", session_id=session_id)
            return
        path = _write_float32_wav(samples, self.sample_rate)
        try:
            transcript = await self._transcribe_voice_audio(path)
        except Exception as exc:
            await self._send_error(
                ws,
                "Voice transcription failed",
                str(exc),
                session_id=session_id,
            )
            return
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

        if not transcript:
            await self._send_error(
                ws,
                "Voice transcription failed",
                "Hermes STT returned an empty transcript",
                session_id=session_id,
            )
            return

        await ws.send_json({
            "type": "user-input-transcription",
            "text": transcript,
            "session_id": session_id,
            "source": "voice",
        })

        voice_data = dict(data)
        voice_data["text"] = transcript
        voice_data["source"] = "voice"
        await self._dispatch_text(client_id, ws, voice_data, transcript, session_id)

    @staticmethod
    async def _transcribe_voice_audio(path: str) -> str:
        """Use Hermes' configured STT provider to transcribe a WAV file."""
        from tools.transcription_tools import transcribe_audio

        result = await asyncio.to_thread(transcribe_audio, path)
        if not result.get("success"):
            error = result.get("error") or "unknown STT error"
            raise RuntimeError(str(error))
        return str(result.get("transcript") or "").strip()

    def _make_event(
        self,
        client_id: str,
        data: Dict[str, Any],
        text: str,
        session_id: str,
        message_type: MessageType,
    ) -> MessageEvent:
        message_id = str(data.get("message_id") or uuid.uuid4())
        source = SessionSource(
            platform=Platform("hermes_ui"),
            chat_id=client_id,
            chat_name="Hermes UI",
            chat_type="dm",
            user_id=str(data.get("user_id") or client_id),
            user_name=str(data.get("user_name") or "hermes-ui-user"),
            thread_id=session_id,
            message_id=message_id,
        )
        return MessageEvent(
            text=text,
            message_type=message_type,
            source=source,
            raw_message=data,
            message_id=message_id,
            channel_prompt=self._load_active_character_prompt(client_id),
        )

    def _session_id_from_payload(self, client_id: str, data: Dict[str, Any]) -> str:
        return _safe_id(
            data.get("session_id") or data.get("history_uid") or self._client_sessions.get(client_id),
            DEFAULT_SESSION_ID,
        )

    @staticmethod
    def _session_id_from_metadata(metadata: Optional[Dict[str, Any]]) -> Optional[str]:
        if not metadata:
            return None
        for key in ("session_id", "thread_id", "history_uid"):
            value = metadata.get(key)
            if value:
                return str(value)
        return None

    @staticmethod
    async def _send_error(
        ws: web.WebSocketResponse,
        message: str,
        detail: str = "",
        *,
        session_id: Optional[str] = None,
    ) -> None:
        payload: Dict[str, Any] = {"type": "error", "message": message}
        if detail:
            payload["detail"] = detail
        if session_id:
            payload["session_id"] = session_id
        await ws.send_json(payload)


def check_requirements() -> bool:
    return AIOHTTP_AVAILABLE


def validate_config(config: PlatformConfig) -> bool:
    extra = getattr(config, "extra", {}) or {}
    port = _coerce_int(os.getenv("HERMES_UI_PORT") or extra.get("port"), DEFAULT_PORT)
    return AIOHTTP_AVAILABLE and 0 < port < 65536


def _env_enablement() -> Optional[dict]:
    if not _env_bool("HERMES_UI_ENABLED", False):
        return None
    seed: Dict[str, Any] = {
        "host": os.getenv("HERMES_UI_HOST", DEFAULT_HOST),
        "port": _coerce_int(os.getenv("HERMES_UI_PORT"), DEFAULT_PORT),
        "sample_rate": _coerce_int(os.getenv("HERMES_UI_SAMPLE_RATE"), DEFAULT_SAMPLE_RATE),
    }
    if os.getenv("HERMES_UI_CLIENT_TOKEN"):
        seed["client_token"] = os.getenv("HERMES_UI_CLIENT_TOKEN")
    seed["home_channel"] = {"chat_id": "local-browser", "name": "Hermes UI"}
    return seed


def register(ctx) -> None:
    ctx.register_platform(
        name="hermes_ui",
        label="Hermes UI",
        adapter_factory=lambda cfg: HermesUIAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        env_enablement_fn=_env_enablement,
        required_env=[],
        install_hint="Requires aiohttp, which is included with the Hermes gateway.",
        allowed_users_env="HERMES_UI_ALLOWED_USERS",
        allow_all_env="HERMES_UI_ALLOW_ALL_USERS",
        emoji="🖥️",
        pii_safe=False,
        allow_update_command=True,
        platform_hint=(
            "You are chatting through hermes-ui. The frontend sends explicit "
            "session_id values; treat each session/thread as an isolated UI chat lane."
        ),
    )
