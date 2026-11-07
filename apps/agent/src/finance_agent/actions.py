"""Acciones que vuelven del navegador (renderer → agente).

Son deterministas, igual que en el modo local: el LLM no participa, Python
recalcula y responde con `updateDataModel` sobre la MISMA superficie. Así se ve
la flecha de vuelta de la diapositiva: la interfaz le habla al agente.
"""

from __future__ import annotations

import re
from typing import Any

from .finance.analytics import FinanceAnalytics
from .finance.jscompat import to_num
from .finance.models import Account
from .protocol import A2UI_VERSION, RendererAction

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

#: Acciones que entiende el agente (las mismas que emiten los widgets).
FILTER_MOVEMENTS = "filterMovements"
SIMULATE_REDUCTION = "simulateReduction"


class UnknownActionError(ValueError):
    pass


def _update(surface_id: str, path: str, value: Any) -> dict[str, Any]:
    return {"version": A2UI_VERSION, "updateDataModel": {"surfaceId": surface_id, "path": path, "value": value}}


def handle_action(action: RendererAction, *, analytics: FinanceAnalytics, account: Account) -> list[dict[str, Any]]:
    """Recalcula lo que pidió el widget y devuelve los mensajes A2UI de respuesta."""
    widget_id = action.sourceComponentId
    if not _IDENTIFIER.match(widget_id):
        raise UnknownActionError(f"Componente de origen inválido: {widget_id!r}")
    base = f"/{widget_id}"  # en las superficies del servidor cada widget tiene sus datos en /<id>
    context = action.context or {}

    if action.name == FILTER_MOVEMENTS:
        data = analytics.build_data("AppMovementsTable", context, account)
        return [_update(action.surfaceId, base, data)]

    if action.name == SIMULATE_REDUCTION:
        pct = to_num(context.get("pct")) or 0
        projection = analytics.project_depletion(account, pct)
        return [
            _update(action.surfaceId, f"{base}/reductionPct", pct),
            _update(action.surfaceId, f"{base}/daysLeft", projection["daysLeft"]),
            _update(action.surfaceId, f"{base}/depletionFrom", projection["fromDate"]),
            _update(action.surfaceId, f"{base}/depletionTo", projection["toDate"]),
        ]

    raise UnknownActionError(f"Acción desconocida: {action.name!r}")
