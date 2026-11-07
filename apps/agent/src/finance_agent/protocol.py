"""El lado "cable" del agente: constantes A2UI y la forma de las peticiones HTTP.

A2UI no estandariza un binding HTTP/SSE (sí A2A y AG-UI). Esta demo usa uno
mínimo y explícito, calcado de cómo A2A lleva los metadatos:

    POST /api/agent
    {
      "text": "¿En qué gasto más?",                     ← pregunta del usuario, o…
      "a2ui": {"version": "1.0", "action": {…}},        ← …un mensaje renderer→agente
      "metadata": {
        "a2uiRendererCapabilities": {"1.0": {"supportedCatalogIds": [...]}},
        "accountId": "debito-principal"
      }
    }

La respuesta es `text/event-stream`. Cada evento `a2ui` lleva UN mensaje A2UI v1.0
envuelto como en A2A: `{"kind": "data", "metadata": {"mimeType": "application/a2ui+json"},
"data": {…}}`. SSE no tiene Content-Type por evento: el tipo viaja en `metadata.mimeType`.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

A2UI_VERSION = "1.0"
A2UI_MIME_TYPE = "application/a2ui+json"
BASIC_CATALOG_ID = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
FINANCE_CATALOG_ID = "https://a2ui-smart-financial-assistant/catalogs/finance/v1_0"

#: Piezas del catálogo básico que el agente se permite usar (el resto se poda del prompt).
BASIC_COMPONENTS_ALLOWED = ("Text", "Row", "Column", "Card", "Button", "Divider", "Icon")

#: Nombre de la acción de los botones de "siguiente pregunta" (la resuelve el chat).
FOLLOW_UP_ACTION = "followUp"


class RendererAction(BaseModel):
    """`action` de un mensaje renderer→agente (A2UI v1.0)."""

    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=100)
    surfaceId: str = Field(min_length=1, max_length=200)
    sourceComponentId: str = Field(min_length=1, max_length=200)
    timestamp: str
    context: dict[str, Any] = Field(default_factory=dict)


class RendererError(BaseModel):
    """`error` que el renderer devuelve cuando no pudo aplicar un mensaje."""

    model_config = ConfigDict(extra="allow")

    code: str
    message: str
    surfaceId: str | None = None
    path: str | None = None


class RendererMessage(BaseModel):
    """Mensaje renderer→agente: `{"version": "1.0", "action" | "error": …}`."""

    version: Literal["1.0"]
    action: RendererAction | None = None
    error: RendererError | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> RendererMessage:
        if (self.action is None) == (self.error is None):
            raise ValueError("Un mensaje del renderer lleva exactamente uno de 'action' o 'error'.")
        return self


class RequestMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    a2uiRendererCapabilities: dict[str, Any]
    accountId: str = Field(min_length=1, max_length=64)


class AgentRequest(BaseModel):
    """Cuerpo de `POST /api/agent`: o una pregunta (`text`) o un mensaje A2UI (`a2ui`)."""

    text: str | None = Field(default=None, min_length=1, max_length=500)
    a2ui: RendererMessage | None = None
    metadata: RequestMetadata

    @model_validator(mode="after")
    def _text_or_a2ui(self) -> AgentRequest:
        if (self.text is None) == (self.a2ui is None):
            raise ValueError("La petición lleva 'text' (una pregunta) o 'a2ui' (un mensaje del renderer), no ambos.")
        return self
