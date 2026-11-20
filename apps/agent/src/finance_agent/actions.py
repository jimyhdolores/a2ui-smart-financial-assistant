"""Acciones que vuelven del navegador (renderer → agente).

Son deterministas, igual que en el modo local: el LLM no participa, Python
recalcula y responde con `updateDataModel` sobre la MISMA superficie. Así se ve
la flecha de vuelta de la diapositiva: la interfaz le habla al agente.

La acción llega ya validada por el procesador oficial del SDK
(`RendererToAgentMessageProcessor`): es el modelo `A2uiRendererAction` de A2UI 1.0,
con sus campos en snake_case (`surface_id`, `source_component_id`, `context`).
"""

from __future__ import annotations

import re
from typing import Any

from a2ui.core.schema.v1_0 import A2uiRendererAction

from .finance.analytics import FinanceAnalytics
from .finance.jscompat import to_num
from .finance.models import Account
from .protocol import A2UI_VERSION

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

#: Acciones que entiende el agente (las mismas que emiten los widgets).
FILTER_MOVEMENTS = "filterMovements"
SIMULATE_REDUCTION = "simulateReduction"


class UnknownActionError(ValueError):
    pass


def _update(surface_id: str, path: str, value: Any) -> dict[str, Any]:
    return {"version": A2UI_VERSION, "updateDataModel": {"surfaceId": surface_id, "path": path, "value": value}}


def handle_action(action: A2uiRendererAction, *, analytics: FinanceAnalytics, account: Account) -> list[dict[str, Any]]:
    """Recalcula lo que pidió el widget y devuelve los mensajes A2UI de respuesta."""
    widget_id = action.source_component_id
    if not _IDENTIFIER.match(widget_id):
        raise UnknownActionError(f"Componente de origen inválido: {widget_id!r}")
    base = f"/{widget_id}"  # en las superficies del servidor cada widget tiene sus datos en /<id>
    context = action.context or {}

    if action.name == FILTER_MOVEMENTS:
        data = analytics.build_data("AppMovementsTable", context, account)
        return [_update(action.surface_id, base, data)]

    if action.name == SIMULATE_REDUCTION:
        pct = to_num(context.get("pct")) or 0
        projection = analytics.project_depletion(account, pct)
        return [
            _update(action.surface_id, f"{base}/reductionPct", pct),
            _update(action.surface_id, f"{base}/daysLeft", projection["daysLeft"]),
            _update(action.surface_id, f"{base}/depletionFrom", projection["fromDate"]),
            _update(action.surface_id, f"{base}/depletionTo", projection["toDate"]),
        ]

    raise UnknownActionError(f"Acción desconocida: {action.name!r}")
