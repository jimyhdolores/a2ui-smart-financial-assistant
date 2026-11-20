from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path

import pytest
from a2ui.inference_formats import ExpressParser, to_message_models

from finance_agent.catalogs import load_catalogs
from finance_agent.finance import FinanceAnalytics, build_dataset
from finance_agent.llm import LlmChunk
from finance_agent.protocol import BASIC_CATALOG_ID, FINANCE_CATALOG_ID
from finance_agent.settings import DEFAULT_CATALOG_DIR

EXAMPLES_DIR = DEFAULT_CATALOG_DIR / "examples"
CAPABILITIES = {"1.0": {"supportedCatalogIds": [BASIC_CATALOG_ID, FINANCE_CATALOG_ID]}}


def example(name: str) -> list[dict]:
    return json.loads((EXAMPLES_DIR / f"{name}.json").read_text(encoding="utf-8"))


def wrap_in_card(structure: list[dict], widget_id: str) -> list[dict]:
    """Mete un widget dentro de una Card: anidamiento que el catálogo prohíbe (allowedParents)."""
    structure = json.loads(json.dumps(structure))
    components = structure[1]["updateComponents"]["components"]
    root = next(c for c in components if c["id"] == "root")
    root["children"] = ["box" if child == widget_id else child for child in root["children"]]
    components.append({"id": "box", "component": "Card", "child": widget_id})
    return structure


def llm_response(narrative: str, structure: list[dict], fmt: str = "json") -> str:
    """Respuesta "como la escribiría Gemini": una frase y un bloque A2UI en el formato pedido.

    - "json":    <a2ui-json>[…mensajes v1.0…]</a2ui-json>
    - "express": <a2ui>surface("main") / root = Column([...]) …</a2ui>, generado con el
      decompilador oficial a partir de los mismos mensajes.
    """
    if fmt == "express":
        catalogs = [config.transformed_catalog for config in load_catalogs(DEFAULT_CATALOG_DIR)]
        block = ExpressParser(catalogs).decompile(to_message_models(structure))
        return f"{narrative}\n<a2ui>\n{block}\n</a2ui>"
    return f"{narrative}\n<a2ui-json>\n{json.dumps(structure, ensure_ascii=False)}\n</a2ui-json>"


#: Marca que el prompt del SDK incluye según el formato (prueba de que el contrato viene del SDK).
PROMPT_MARKERS = {"express": "A2UI Express DSL Output Contract", "json": "---BEGIN A2UI JSON SCHEMA---"}


@pytest.fixture(params=["express", "json"])
def fmt(request) -> str:
    """Formato en que escribe Gemini: los tests de turno corren con los dos."""
    return request.param


class FakeLlm:
    """Gemini de mentira: devuelve respuestas fijas, troceadas como un stream real."""

    model = "fake-gemini"

    def __init__(self, streamed: str, retry: str = "", thoughts: tuple[str, ...] = ()) -> None:
        self.streamed = streamed
        self.retry = retry
        self.thoughts = thoughts
        self.calls: list[dict] = []

    async def stream(self, *, system: str, user: str) -> AsyncIterator[LlmChunk]:
        self.calls.append({"system": system, "user": user})
        for thought in self.thoughts:
            yield LlmChunk("thought", thought)
        for i in range(0, len(self.streamed), 37):
            yield LlmChunk("text", self.streamed[i : i + 37])
        # Lo que Google confirma al cerrar la respuesta (interaction.completed).
        yield LlmChunk("served", info={"servedModel": self.model, "serviceTier": "standard",
                                       "usage": {"input": 1200, "output": 300, "thought": 800, "total": 2300}})

    async def complete(self, *, system: str, user: str) -> str:
        self.calls.append({"system": system, "user": user, "retry": True})
        return self.retry

    async def aclose(self) -> None:
        return None


def parse_sse(body: str) -> list[tuple[str, object]]:
    """Convierte un cuerpo text/event-stream en [(evento, data JSON)]."""
    events = []
    for block in body.replace("\r\n", "\n").split("\n\n"):
        name, data_lines = "message", []
        for line in block.split("\n"):
            if line.startswith("event:"):
                name = line[6:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
        if data_lines:
            events.append((name, json.loads("\n".join(data_lines))))
    return events


@pytest.fixture(scope="session")
def analytics() -> FinanceAnalytics:
    return FinanceAnalytics(build_dataset(date.today()))


@pytest.fixture()
def account(analytics: FinanceAnalytics):
    return analytics.dataset.get("debito-principal")


@pytest.fixture()
def examples_dir() -> Path:
    return EXAMPLES_DIR
