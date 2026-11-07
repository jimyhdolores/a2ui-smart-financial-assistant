"""Catálogos A2UI del agente, montados con el SDK oficial (`a2ui-agent-sdk`).

- El catálogo BÁSICO oficial (v1.0), podado a las piezas de maquetación que el
  agente se permite: Text, Row, Column, Card, Button, Divider, Icon. Sin funciones.
- El catálogo de FINANZAS: el mismo `finance-catalog.v1.json` que carga el
  navegador (packages/a2ui-catalog). Un solo archivo = un solo contrato.

El `A2uiGenerator` se crea una vez al arrancar; por petición se negocia un
`processor` con las capacidades que manda el navegador.
"""

from __future__ import annotations

import json
from pathlib import Path

from a2ui.catalog_transformers import ComponentPruningTransformer, FunctionPruningTransformer
from a2ui.core.basic_catalog import BasicCatalog
from a2ui.core.schema import ProtocolVersion
from a2ui.inference_formats import DirectJsonFormatFactory, to_message_models
from a2ui.processor import A2uiGenerator, CatalogConfig

from .protocol import BASIC_CATALOG_ID, BASIC_COMPONENTS_ALLOWED, FINANCE_CATALOG_ID

FINANCE_CATALOG_FILE = "finance-catalog.v1.json"


def load_catalogs(catalog_dir: Path) -> list[CatalogConfig]:
    basic = CatalogConfig(
        BasicCatalog(ProtocolVersion.V1_0),
        transformers=[
            ComponentPruningTransformer(list(BASIC_COMPONENTS_ALLOWED)),
            FunctionPruningTransformer([]),
        ],
    )
    finance = CatalogConfig.from_path(
        str(catalog_dir / FINANCE_CATALOG_FILE),
        protocol_version=ProtocolVersion.V1_0,
    )
    ids = {basic.transformed_catalog.catalog_id, finance.transformed_catalog.catalog_id}
    if ids != {BASIC_CATALOG_ID, FINANCE_CATALOG_ID}:
        raise RuntimeError(f"Catálogos inesperados: {sorted(ids)}")
    return [basic, finance]


def load_examples(catalog_dir: Path) -> list:
    """Ejemplos few-shot (una pantalla compuesta por archivo)."""
    examples = []
    for path in sorted((catalog_dir / "examples").glob("*.json")):
        examples.append(to_message_models(json.loads(path.read_text(encoding="utf-8"))))
    return examples


def build_generator(catalog_dir: Path) -> A2uiGenerator:
    """Generador del agente: catálogos + ejemplos + formato JSON directo (el que hace streaming)."""
    return A2uiGenerator(
        load_catalogs(catalog_dir),
        examples=load_examples(catalog_dir),
        # El LLM solo escribe la ESTRUCTURA; los datos (updateDataModel) los pone Python.
        inference_format_factory=DirectJsonFormatFactory(allowed_messages=["createSurface", "updateComponents"]),
    )
