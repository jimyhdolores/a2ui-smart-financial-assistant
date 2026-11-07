"""Un turno del agente, de la pregunta al stream A2UI.

    pregunta ─▶ contexto (Python) ─▶ Gemini escribe texto + <a2ui-json> ─▶ el SDK
    separa y VALIDA contra el catálogo ─▶ el binder completa punteros y datos
    ─▶ eventos SSE: `text` (narrativa), `a2ui` (un mensaje A2UI v1.0 cada uno), `done`.

Cada evento lleva una "parte" con la misma forma que usa A2A para transportar A2UI:

    event: text   data: {"kind": "text", "text": "…"}
    event: a2ui   data: {"kind": "data", "metadata": {"mimeType": "application/a2ui+json"}, "data": {…mensaje…}}

SSE no permite un Content-Type por evento (la respuesta entera es `text/event-stream`),
así que el tipo de cada mensaje A2UI viaja, como en A2A, en `metadata.mimeType`.

Las acciones del navegador (`a2ui.action`) no pasan por el LLM: se recalculan en Python.
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator
from datetime import date
from typing import Any

from a2ui.core import A2uiError
from a2ui.inference_formats import to_message_dicts
from a2ui.parser import A2uiPart, TextPart
from a2ui.processor import A2uiGenerator, A2uiRequestProcessor
from a2ui.utils import validate_payload
from fastapi.sse import ServerSentEvent

from .actions import UnknownActionError, handle_action
from .binder import BindingError, bind_surface, fallback_structure, normalize_structure
from .finance import FinanceAnalytics, build_dataset
from .llm import LlmClient, LlmError
from .prompts import build_retry_prompt, build_system_prompt, build_user_prompt
from .protocol import A2UI_MIME_TYPE, AgentRequest

log = logging.getLogger("finance_agent")


def _event(name: str, data: Any) -> ServerSentEvent:
    return ServerSentEvent(event=name, data=data)


def _a2ui_event(message: dict[str, Any]) -> ServerSentEvent:
    """Un mensaje A2UI como "parte de datos" etiquetada `application/a2ui+json` (forma de A2A)."""
    return _event("a2ui", {"kind": "data", "metadata": {"mimeType": A2UI_MIME_TYPE}, "data": message})


def _text_event(text: str) -> ServerSentEvent:
    """Un trozo de la narrativa como "parte de texto" (forma de A2A)."""
    return _event("text", {"kind": "text", "text": text})


def _error(message: str, code: str = "AGENT_ERROR") -> ServerSentEvent:
    return _event("error", {"code": code, "message": message})


class FinanceAgent:
    def __init__(self, generator: A2uiGenerator, llm: LlmClient | None, *, expose_llm_output: bool = True) -> None:
        self.generator = generator
        self.llm = llm
        self.expose_llm_output = expose_llm_output

    @property
    def model(self) -> str | None:
        return self.llm.model if self.llm else None

    async def run(self, request: AgentRequest) -> AsyncIterator[ServerSentEvent]:
        started = time.perf_counter()
        dataset = build_dataset(date.today())
        analytics = FinanceAnalytics(dataset)
        account = dataset.get(request.metadata.accountId)
        if account is None:
            yield _error(f"La cuenta {request.metadata.accountId!r} no existe.", "UNKNOWN_ACCOUNT")
            return

        if request.a2ui is not None:
            async for event in self._renderer_message(request, analytics, account, started):
                yield event
            return

        async for event in self._turn(request, analytics, account, started):
            yield event

    # ─── Mensajes del renderer: acciones y errores ──────────────────────────

    async def _renderer_message(self, request, analytics, account, started) -> AsyncIterator[ServerSentEvent]:
        message = request.a2ui
        if message.error is not None:
            # Segunda mitad de la validación en dos fases: el navegador nos avisa de lo que no pudo pintar.
            log.warning("El renderer rechazó un mensaje: %s", message.error.model_dump())
            yield _event("done", {"durationMs": self._ms(started), "kind": "error-ack"})
            return
        try:
            messages = handle_action(message.action, analytics=analytics, account=account)
        except UnknownActionError as exc:
            yield _error(str(exc), "UNKNOWN_ACTION")
            return
        for msg in messages:
            yield _a2ui_event(msg)
        yield _event("done", {"durationMs": self._ms(started), "kind": "action", "action": message.action.name})

    # ─── Un turno de conversación ───────────────────────────────────────────

    async def _turn(self, request, analytics, account, started) -> AsyncIterator[ServerSentEvent]:
        if self.llm is None:
            yield _error("Falta GEMINI_API_KEY en apps/agent/.env: el agente no puede llamar al modelo.", "NO_API_KEY")
            return
        try:
            processor = self.generator.create_processor(request.metadata.a2uiRendererCapabilities)
        except A2uiError as exc:
            yield _error(f"El navegador no soporta los catálogos de este agente: {exc}", "CATALOG_MISMATCH")
            return

        system = build_system_prompt(processor.prompt_snippet)
        user = build_user_prompt(analytics.build_context(account), request.text or "")
        structure: list[dict[str, Any]] = []
        served: dict[str, Any] = {}  # lo que Google confirma: modelo que atendió y tokens
        retries = 0
        fallback = False

        # 1) Streaming: la narrativa sale al instante; la estructura se acumula y se valida.
        try:
            async for event in self._stream_attempt(processor, system, user, structure, served):
                yield event
            if not structure:
                raise A2uiError("La respuesta no traía ningún bloque <a2ui-json>.")
        except LlmError as exc:
            yield _error(str(exc), "LLM_ERROR")
            return
        except A2uiError as exc:
            # 2) Un reintento citando el error (patrón oficial de A2UI).
            retries = 1
            log.info("Bloque A2UI inválido, reintentando: %s", exc)
            yield _event("thought", {"text": "Corrigiendo la pantalla para que cumpla el catálogo…"})
            structure = await self._retry(processor, system, build_retry_prompt(user, str(exc)))
            if not structure:
                fallback = True
                structure = fallback_structure(request.text or "")

        # 3) El agente completa punteros y datos; segunda comprobación contra los catálogos.
        structure = normalize_structure(structure)
        try:
            messages = bind_surface(structure, analytics=analytics, account=account)
            validate_payload(processor.active_catalogs, messages)
        except (BindingError, A2uiError) as exc:
            log.warning("No se pudo completar la estructura del modelo: %s", exc)
            fallback = True
            structure = normalize_structure(fallback_structure(request.text or ""))
            messages = bind_surface(structure, analytics=analytics, account=account)

        for msg in messages:
            yield _a2ui_event(msg)

        done: dict[str, Any] = {
            "durationMs": self._ms(started),
            "kind": "turn",
            "model": self.model,  # el que pedimos (configuración)
            **served,  # servedModel / serviceTier / usage: lo que respondió Google
            "retries": retries,
            "fallback": fallback,
        }
        if self.expose_llm_output:
            done["llmOutput"] = structure  # lo que escribió Gemini, antes de que Python completara los datos
        yield _event("done", done)

    async def _stream_attempt(
        self,
        processor: A2uiRequestProcessor,
        system: str,
        user: str,
        structure: list[dict[str, Any]],
        served: dict[str, Any],
    ) -> AsyncIterator[ServerSentEvent]:
        stream = processor.open_stream()
        try:
            async for chunk in self.llm.stream(system=system, user=user):
                if chunk.kind == "thought":
                    yield _event("thought", {"text": chunk.text})
                    continue
                if chunk.kind == "served":
                    served.update(chunk.info or {})
                    continue
                for event in self._parts_to_events(stream.feed(chunk.text), structure):
                    yield event
            for event in self._parts_to_events(stream.close(), structure):
                yield event
        except A2uiError as exc:
            # El texto que alcanzó a salir antes del error se muestra igual; la estructura se descarta.
            for event in self._parts_to_events(getattr(exc, "partial_results", None) or [], []):
                yield event
            structure.clear()
            raise

    async def _retry(self, processor: A2uiRequestProcessor, system: str, user: str) -> list[dict[str, Any]]:
        try:
            text = await self.llm.complete(system=system, user=user)
            parts = processor.parse_response(text)
        except (LlmError, A2uiError) as exc:
            log.warning("El reintento también falló: %s", exc)
            return []
        structure: list[dict[str, Any]] = []
        for part in parts:
            if isinstance(part, A2uiPart):
                structure.extend(to_message_dicts(part.a2ui))
        return structure

    @staticmethod
    def _parts_to_events(parts: list, structure: list[dict[str, Any]]) -> list[ServerSentEvent]:
        events: list[ServerSentEvent] = []
        for part in parts:
            if isinstance(part, TextPart):
                if part.text:
                    events.append(_text_event(part.text))
            elif isinstance(part, A2uiPart):
                structure.extend(to_message_dicts(part.a2ui))
        return events

    @staticmethod
    def _ms(started: float) -> int:
        return round((time.perf_counter() - started) * 1000)
