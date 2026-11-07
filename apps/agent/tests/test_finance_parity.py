"""Paridad TypeScript ↔ Python: el servidor debe calcular EXACTAMENTE lo mismo que el navegador.

`fixtures/ts_reference.json` se volcó desde la app Angular (DevTools →
`ng.getComponent(app-chat).analytics`) para una fecha concreta. Aquí se
regenera el dataset en Python para esa misma fecha y se compara todo: los
movimientos, el contexto que ve el LLM, el veredicto y el `data` de cada widget.

Para regenerar el fixture: ver apps/agent/README.md ("Paridad con el front").
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from finance_agent.finance import FinanceAnalytics, build_dataset

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "ts_reference.json").read_text(encoding="utf-8"))
TODAY = date.fromisoformat(FIXTURE["today"])
ACCOUNTS = FIXTURE["accounts"]


@pytest.fixture(scope="module")
def analytics() -> FinanceAnalytics:
    return FinanceAnalytics(build_dataset(TODAY))


@pytest.mark.parametrize("ref", ACCOUNTS, ids=lambda r: r["id"])
def test_mismos_movimientos(ref: dict, analytics: FinanceAnalytics) -> None:
    account = analytics.dataset.get(ref["id"])
    assert account is not None
    got = [
        [t.id, t.date.isoformat(), t.amount, t.merchant, t.category, t.method, t.type]
        for t in account.transactions
    ]
    assert got == ref["transactions"]


@pytest.mark.parametrize("ref", ACCOUNTS, ids=lambda r: r["id"])
def test_mismo_contexto_para_el_llm(ref: dict, analytics: FinanceAnalytics) -> None:
    account = analytics.dataset.get(ref["id"])
    assert analytics.build_context(account) == ref["context"]


@pytest.mark.parametrize("ref", ACCOUNTS, ids=lambda r: r["id"])
def test_mismo_veredicto_y_proyeccion(ref: dict, analytics: FinanceAnalytics) -> None:
    account = analytics.dataset.get(ref["id"])
    assert analytics.ant_verdict_fallback(account) == ref["verdict"]
    assert analytics.project_depletion(account, 30) == ref["depletion30"]
    verdict = analytics.ant_verdict_fallback(account)
    assert analytics.ant_data(account, verdict, 40, True) == ref["antData40"]


CASES = [(acc, case) for acc in ACCOUNTS for case in acc["data"]]


@pytest.mark.parametrize(
    ("ref", "case"),
    CASES,
    ids=[f"{a['id']}-{c['component']}-{json.dumps(c['params'], ensure_ascii=False)}" for a, c in CASES],
)
def test_mismo_data_por_widget(ref: dict, case: dict, analytics: FinanceAnalytics) -> None:
    account = analytics.dataset.get(ref["id"])
    assert analytics.build_data(case["component"], case["params"], account) == case["data"]
