"""El agente completa los punteros: de la ESTRUCTURA que escribió Gemini a los
mensajes A2UI que viajan al navegador.

Gemini decide la forma (qué piezas, en qué orden, con qué textos y botones) y,
para cada widget de finanzas, solo su intención (p. ej. `filter: {method: "yape"}`).
Aquí Python:

1. Le da a la superficie un id único (`srv-…`) y fija el catálogo por defecto.
2. A cada widget App* le pone `data: {"@path": "/<id>"}` y descarta cualquier
   otra prop de datos que el modelo hubiera escrito.
3. Calcula los montos de cada widget con la misma matemática que el front y
   los manda en un `updateDataModel` por widget.

Resultado: "el LLM decide la intención, Python pone el dinero".
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from .finance.analytics import FINANCE_COMPONENTS, FinanceAnalytics
from .finance.models import Account
from .protocol import A2UI_VERSION, BASIC_CATALOG_ID, FINANCE_CATALOG_ID

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

#: Props que el modelo puede escribir en cada widget (título + parámetros de intención).
INTENT_PROPS: dict[str, tuple[str, ...]] = {
    "AppQuickStats": (),
    "AppAntExpense": ("interactive",),
    "AppSpendingReport": ("title",),
    "AppRecommendations": ("title",),
    "AppSavingsPlan": ("title", "goalName", "goalTarget"),
    "AppCreditAdvisor": ("title", "product", "price", "months"),
    "AppMovementsTable": ("title", "filter"),
}


class BindingError(ValueError):
    """La estructura no se puede completar (no debería pasar tras la validación del SDK)."""


def new_surface_id() -> str:
    return f"srv-{uuid.uuid4().hex[:8]}"


def collect_components(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Componentes de la superficie en orden, aplicando los upserts por id."""
    ordered: dict[str, dict[str, Any]] = {}
    for message in messages:
        create = message.get("createSurface") or {}
        update = message.get("updateComponents") or {}
        for component in [*(create.get("components") or []), *(update.get("components") or [])]:
            ordered[component["id"]] = component
    return list(ordered.values())


def normalize_structure(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Une lo que escribió el modelo en UNA estructura: `createSurface` + `updateComponents`.

    Mientras el bloque crece, el parser en streaming del SDK emite versiones
    parciales (y acumulativas) del mismo `updateComponents`; aquí se quedan los
    componentes finales, en su orden de aparición.
    """
    create = next((m["createSurface"] for m in messages if "createSurface" in m), {})
    surface_id = create.get("surfaceId", "main")
    return [
        {
            "version": A2UI_VERSION,
            "createSurface": {"surfaceId": surface_id, "catalogId": create.get("catalogId", BASIC_CATALOG_ID)},
        },
        {
            "version": A2UI_VERSION,
            "updateComponents": {"surfaceId": surface_id, "components": collect_components(messages)},
        },
    ]


def _widget_params(component: dict[str, Any]) -> dict[str, Any]:
    name = component["component"]
    if name == "AppMovementsTable":
        raw = component.get("filter")
        return dict(raw) if isinstance(raw, dict) else {}
    return {key: component[key] for key in INTENT_PROPS.get(name, ()) if key in component and key != "title"}


def _widget_data(
    component: dict[str, Any], analytics: FinanceAnalytics, account: Account
) -> dict[str, Any]:
    name = component["component"]
    if name == "AppAntExpense":
        interactive = component.get("interactive")
        verdict = analytics.ant_verdict_fallback(account)
        # En modo servidor el simulador viene activo por defecto: su acción viaja al agente.
        return analytics.ant_data(account, verdict, 0, interactive if isinstance(interactive, bool) else True)
    return analytics.build_data(name, _widget_params(component), account)


def bind_surface(
    llm_messages: list[dict[str, Any]],
    *,
    analytics: FinanceAnalytics,
    account: Account,
    surface_id: str | None = None,
) -> list[dict[str, Any]]:
    """Convierte la estructura del modelo en el stream A2UI final (v1.0)."""
    components = collect_components(llm_messages)
    if not any(c.get("id") == "root" for c in components):
        raise BindingError("La estructura no tiene un componente 'root'.")

    surface_id = surface_id or new_surface_id()
    final_components: list[dict[str, Any]] = []
    data_messages: list[dict[str, Any]] = []

    for component in components:
        component_id = component.get("id", "")
        if not _IDENTIFIER.match(component_id):
            raise BindingError(f"Id de componente inválido: {component_id!r}")
        name = component["component"]

        if name in FINANCE_COMPONENTS:
            node: dict[str, Any] = {
                "id": component_id,
                "component": name,
                "catalogId": FINANCE_CATALOG_ID,
                "data": {"@path": f"/{component_id}"},
            }
            title = component.get("title")
            if isinstance(title, str) and title.strip():
                node["title"] = title.strip()
            final_components.append(node)
            data_messages.append(
                {
                    "version": A2UI_VERSION,
                    "updateDataModel": {
                        "surfaceId": surface_id,
                        "path": f"/{component_id}",
                        "value": _widget_data(component, analytics, account),
                    },
                }
            )
        else:
            # Pieza del catálogo básico: se respeta tal cual (sin catalogId: usa el de la superficie).
            node = {k: v for k, v in component.items() if k != "catalogId"}
            final_components.append(node)

    return [
        {"version": A2UI_VERSION, "createSurface": {"surfaceId": surface_id, "catalogId": BASIC_CATALOG_ID}},
        {"version": A2UI_VERSION, "updateComponents": {"surfaceId": surface_id, "components": final_components}},
        *data_messages,
    ]


def fallback_structure(question: str) -> list[dict[str, Any]]:
    """Pantalla determinista por si el modelo falla dos veces: la demo nunca queda en blanco."""
    return [
        {"version": A2UI_VERSION, "createSurface": {"surfaceId": "main", "catalogId": BASIC_CATALOG_ID}},
        {
            "version": A2UI_VERSION,
            "updateComponents": {
                "surfaceId": "main",
                "components": [
                    {"id": "root", "component": "Column", "children": ["title", "note", "kpis", "report", "retry"]},
                    {"id": "title", "component": "Text", "text": "## Un resumen de tu mes"},
                    {
                        "id": "note",
                        "component": "Text",
                        "variant": "caption",
                        "text": "No pude diseñar una pantalla a medida esta vez; te dejo lo esencial.",
                    },
                    {"id": "kpis", "component": "AppQuickStats", "catalogId": FINANCE_CATALOG_ID},
                    {"id": "report", "component": "AppSpendingReport", "catalogId": FINANCE_CATALOG_ID},
                    {
                        "id": "retry",
                        "component": "Button",
                        "child": "retry_label",
                        "variant": "borderless",
                        "action": {"event": {"name": "followUp", "context": {"question": question}}},
                    },
                    {"id": "retry_label", "component": "Text", "text": "Volver a intentarlo"},
                ],
            },
        },
    ]
