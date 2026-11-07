"""Configuración del agente (variables de entorno o `apps/agent/.env`)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

#: apps/agent (la carpeta del proyecto Python).
AGENT_DIR = Path(__file__).resolve().parents[2]
#: El contrato compartido del monorepo: packages/a2ui-catalog.
DEFAULT_CATALOG_DIR = AGENT_DIR.parent.parent / "packages" / "a2ui-catalog"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=AGENT_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: API key de Google AI Studio. Solo vive en el servidor: nunca llega al navegador.
    gemini_api_key: SecretStr | None = None
    #: Modelo de razonamiento que compone la pantalla.
    gemini_model: str = "gemini-4-argon"
    #: Cuánto "piensa" el modelo antes de responder (más alto = mejor diseño, más lento).
    gemini_thinking_level: Literal["low", "medium", "high"] = "medium"
    #: Orígenes del navegador autorizados (CORS). En desarrollo el front usa el proxy de Angular.
    allowed_origins: list[str] = ["http://localhost:4200"]
    #: Carpeta del catálogo A2UI compartido (contrato + ejemplos).
    a2ui_catalog_dir: Path = DEFAULT_CATALOG_DIR
    #: Si es true, el evento `done` incluye el bloque A2UI que escribió Gemini (útil para la charla).
    expose_llm_output: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
