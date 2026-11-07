"""El binder: de la estructura del modelo al stream A2UI final (punteros + datos de Python)."""

from __future__ import annotations

from a2ui.utils import validate_payload

from finance_agent.binder import bind_surface, fallback_structure, normalize_structure
from finance_agent.catalogs import build_generator
from finance_agent.protocol import BASIC_CATALOG_ID, FINANCE_CATALOG_ID
from finance_agent.settings import DEFAULT_CATALOG_DIR

from .conftest import CAPABILITIES, example


def _active_catalogs():
    return build_generator(DEFAULT_CATALOG_DIR).create_processor(CAPABILITIES).active_catalogs


def test_completa_punteros_y_datos(analytics, account):
    messages = bind_surface(example("pagos-con-yape"), analytics=analytics, account=account)

    create, update, *data_updates = messages
    surface_id = create["createSurface"]["surfaceId"]
    assert surface_id.startswith("srv-")
    assert create["createSurface"]["catalogId"] == BASIC_CATALOG_ID
    assert all(m["version"] == "1.0" for m in messages)

    components = {c["id"]: c for c in update["updateComponents"]["components"]}
    table = components["table"]
    # El widget llega con su catálogo, el título del modelo y UN puntero a sus datos.
    assert table == {
        "id": "table",
        "component": "AppMovementsTable",
        "catalogId": FINANCE_CATALOG_ID,
        "data": {"@path": "/table"},
        "title": "Pagos con Yape",
    }
    # Las piezas básicas usan el catálogo de la superficie.
    assert "catalogId" not in components["hint_card"]

    # Los montos los pone Python, con la misma matemática que el front.
    [table_data] = data_updates
    assert table_data["updateDataModel"] == {
        "surfaceId": surface_id,
        "path": "/table",
        "value": analytics.build_data("AppMovementsTable", {"method": "yape"}, account),
    }


def test_descarta_cifras_que_invente_el_modelo(analytics, account):
    structure = example("resumen-del-mes")
    for component in structure[1]["updateComponents"]["components"]:
        if component["id"] == "kpis":
            component["items"] = [{"label": "Inventado", "value": 999999}]
    messages = bind_surface(structure, analytics=analytics, account=account)
    kpis = next(c for c in messages[1]["updateComponents"]["components"] if c["id"] == "kpis")
    assert "items" not in kpis
    assert kpis["data"] == {"@path": "/kpis"}


def test_el_stream_final_cumple_los_catalogos(analytics, account):
    for name in ("resumen-del-mes", "pagos-con-yape"):
        messages = bind_surface(example(name), analytics=analytics, account=account)
        validate_payload(_active_catalogs(), messages)  # lanza si algo no cumple


def test_pantalla_de_respaldo_es_valida(analytics, account):
    messages = bind_surface(fallback_structure("¿Cómo voy?"), analytics=analytics, account=account)
    validate_payload(_active_catalogs(), messages)
    assert {m["updateDataModel"]["path"] for m in messages if "updateDataModel" in m} == {"/kpis", "/report"}


def test_normaliza_las_versiones_parciales_del_stream():
    """El parser en streaming emite el mismo updateComponents varias veces mientras crece."""
    full = example("pagos-con-yape")
    components = full[1]["updateComponents"]["components"]
    partials = [
        {"version": "1.0", "updateComponents": {"surfaceId": "main", "components": components[: i + 1]}}
        for i in range(len(components))
    ]
    normalized = normalize_structure([full[0], *partials])
    assert len(normalized) == 2
    assert normalized[0]["createSurface"]["catalogId"] == BASIC_CATALOG_ID
    assert [c["id"] for c in normalized[1]["updateComponents"]["components"]] == [c["id"] for c in components]
