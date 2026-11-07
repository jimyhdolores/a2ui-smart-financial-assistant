"""Acciones que vuelven del navegador: Python recalcula y responde con updateDataModel."""

from __future__ import annotations

import pytest

from finance_agent.actions import UnknownActionError, handle_action
from finance_agent.protocol import RendererAction


def _action(name: str, context: dict, source: str = "table") -> RendererAction:
    return RendererAction(
        name=name,
        surfaceId="srv-1234abcd",
        sourceComponentId=source,
        timestamp="2026-11-06T12:00:00Z",
        context=context,
    )


def test_filtrar_movimientos_reemplaza_los_datos_del_widget(analytics, account):
    [message] = handle_action(_action("filterMovements", {"antsOnly": True}), analytics=analytics, account=account)
    assert message == {
        "version": "1.0",
        "updateDataModel": {
            "surfaceId": "srv-1234abcd",
            "path": "/table",
            "value": analytics.build_data("AppMovementsTable", {"antsOnly": True}, account),
        },
    }


def test_simulador_parchea_solo_la_proyeccion(analytics, account):
    messages = handle_action(_action("simulateReduction", {"pct": 40}, source="ants"), analytics=analytics, account=account)
    projection = analytics.project_depletion(account, 40)
    assert [(m["updateDataModel"]["path"], m["updateDataModel"]["value"]) for m in messages] == [
        ("/ants/reductionPct", 40),
        ("/ants/daysLeft", projection["daysLeft"]),
        ("/ants/depletionFrom", projection["fromDate"]),
        ("/ants/depletionTo", projection["toDate"]),
    ]


def test_accion_desconocida(analytics, account):
    with pytest.raises(UnknownActionError):
        handle_action(_action("borrarTodo", {}), analytics=analytics, account=account)


def test_origen_con_ruta_rara_se_rechaza(analytics, account):
    with pytest.raises(UnknownActionError):
        handle_action(_action("filterMovements", {}, source="../otra"), analytics=analytics, account=account)
