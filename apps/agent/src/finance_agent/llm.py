"""Cliente del modelo grande: Gemini vía la Interactions API de `google-genai`.

La API key vive solo aquí, en el servidor: el navegador nunca la ve.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal, Protocol

from google import genai
from google.genai import types

#: Reintentos: uno solo y únicamente ante errores pasajeros del servidor (5xx).
#: Un 429 (cuota / nivel gratuito) no se arregla esperando: se informa al instante
#: en el chat en vez de dejar la petición colgada en silencio.
RETRY_OPTIONS = types.HttpRetryOptions(
    attempts=2,
    initial_delay=1.0,
    max_delay=4.0,
    http_status_codes=[500, 502, 503, 504],
)

#: Segundos máximos sin recibir nada del modelo (ni razonamiento ni texto) antes de rendirse.
IDLE_TIMEOUT_S = 90


class LlmError(RuntimeError):
    """El proveedor del modelo respondió con un error (key inválida, cuota, modelo, red…)."""


@dataclass(frozen=True)
class LlmChunk:
    #: "text" = respuesta del modelo · "thought" = resumen de su razonamiento (para mostrar progreso)
    #: "served" = lo que Google confirma al cerrar la respuesta (modelo que atendió, tokens).
    kind: Literal["text", "thought", "served"]
    text: str = ""
    info: dict | None = None


def served_info(interaction: object) -> dict:
    """Lo que Google dice de la respuesta: qué modelo la atendió, en qué nivel y cuántos tokens."""
    usage = getattr(interaction, "usage", None)
    return {
        "servedModel": getattr(interaction, "model", None),
        "serviceTier": getattr(interaction, "service_tier", None),
        "usage": {
            "input": getattr(usage, "total_input_tokens", None),
            "output": getattr(usage, "total_output_tokens", None),
            "thought": getattr(usage, "total_thought_tokens", None),
            "total": getattr(usage, "total_tokens", None),
        },
    }


class LlmClient(Protocol):
    model: str

    def stream(self, *, system: str, user: str) -> AsyncIterator[LlmChunk]: ...

    async def complete(self, *, system: str, user: str) -> str: ...

    async def aclose(self) -> None: ...


class GeminiClient:
    """Gemini por la Interactions API (`store=False`: no se guarda la conversación en Google)."""

    def __init__(self, api_key: str, model: str, thinking_level: str, timeout_s: float = 300) -> None:
        self.model = model
        self._client = genai.Client(api_key=api_key, http_options=types.HttpOptions(retry_options=RETRY_OPTIONS))
        self._thinking_level = thinking_level
        self._timeout_s = timeout_s

    def _request(self, *, system: str, user: str, stream: bool) -> dict:
        # Gemini 3.6+ y 4 ignoran temperature/top_p/top_k: no se envían.
        return {
            "model": self.model,
            "system_instruction": system,
            "input": user,
            "generation_config": {
                "thinking_level": self._thinking_level,
                "thinking_summaries": "auto",
            },
            "store": False,
            "stream": stream,
            "timeout": self._timeout_s,
        }

    async def stream(self, *, system: str, user: str) -> AsyncIterator[LlmChunk]:
        try:
            async with asyncio.timeout(IDLE_TIMEOUT_S):
                events = await self._client.aio.interactions.create(
                    **self._request(system=system, user=user, stream=True)
                )
            iterator = aiter(events)
            while True:
                # Si el modelo se queda mudo (p. ej. saturado), se corta con un error claro.
                try:
                    event = await asyncio.wait_for(anext(iterator), timeout=IDLE_TIMEOUT_S)
                except StopAsyncIteration:
                    break
                event_type = getattr(event, "event_type", None)
                if event_type == "step.delta":
                    delta = event.delta
                    delta_type = getattr(delta, "type", None)
                    if delta_type == "text" and getattr(delta, "text", None):
                        yield LlmChunk("text", delta.text)
                    elif delta_type == "thought_summary":
                        text = getattr(getattr(delta, "content", None), "text", None)
                        if text:
                            yield LlmChunk("thought", text)
                elif event_type == "interaction.completed":
                    # La confirmación de Google: el modelo que de verdad atendió y los tokens usados.
                    yield LlmChunk("served", info=served_info(event.interaction))
                elif event_type == "error":
                    error = getattr(event, "error", None)
                    raise LlmError(getattr(error, "message", None) or "El modelo devolvió un error.")
        except LlmError:
            raise
        except TimeoutError as exc:
            raise LlmError(
                f"{self.model} no respondió en {IDLE_TIMEOUT_S} s (¿saturado?). Prueba de nuevo en un momento."
            ) from exc
        except Exception as exc:  # errores HTTP/red del SDK → un mensaje legible para el chat
            raise LlmError(_describe(exc, self.model)) from exc

    async def complete(self, *, system: str, user: str) -> str:
        try:
            interaction = await self._client.aio.interactions.create(
                **self._request(system=system, user=user, stream=False)
            )
        except TimeoutError as exc:
            raise LlmError(f"{self.model} no respondió a tiempo. Prueba de nuevo en un momento.") from exc
        except Exception as exc:
            raise LlmError(_describe(exc, self.model)) from exc
        return getattr(interaction, "output_text", None) or ""

    async def aclose(self) -> None:
        await self._client.aio.aclose()


def _describe(exc: Exception, model: str = "") -> str:
    """Traduce el error del proveedor a un mensaje que se entienda en el chat."""
    text = str(exc) or exc.__class__.__name__
    lowered = text.lower()
    if "free tier" in lowered or "limit: 0" in lowered:
        return (
            f"Tu proyecto de AI Studio está en el nivel gratuito y {model or 'este modelo'} no tiene cuota ahí: "
            "necesita facturación activa (https://ai.dev/rate-limit). Para probar gratis, pon "
            "GEMINI_MODEL=gemini-3.6-flash (o gemini-3.8-flash) en apps/agent/.env."
        )
    if "api key" in lowered or "api_key" in lowered or "permission" in lowered or "unauthenticated" in lowered:
        return f"Gemini rechazó la API key: revisa GEMINI_API_KEY en apps/agent/.env ({text[:200]})"
    if "429" in lowered or "rate limit" in lowered or "quota" in lowered or "resource_exhausted" in lowered:
        return f"Gemini rechazó la petición por cuota o límite de uso: {text[:220]}"
    if "503" in lowered or "high demand" in lowered or "unavailable" in lowered or "overloaded" in lowered:
        return "Gemini está saturado en este momento (503). Prueba de nuevo en unos segundos."
    if "not found" in lowered or "404" in lowered:
        return f"El modelo configurado no existe o no está disponible: {text[:200]}"
    return f"Error al llamar a Gemini: {text[:300]}"
