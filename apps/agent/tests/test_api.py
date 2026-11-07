"""El endpoint completo con un Gemini falso: pregunta → eventos SSE con mensajes A2UI v1.0."""

from __future__ import annotations

from fastapi.testclient import TestClient

from finance_agent.main import create_app
from finance_agent.protocol import BASIC_CATALOG_ID, FINANCE_CATALOG_ID
from finance_agent.settings import Settings

from .conftest import CAPABILITIES, FakeLlm, example, llm_response, parse_sse


def _client(llm: FakeLlm | None) -> TestClient:
    settings = Settings(gemini_api_key=None, _env_file=None)
    return TestClient(create_app(settings=settings, llm=llm))


def _ask(client: TestClient, text: str, capabilities=CAPABILITIES):
    body = {"text": text, "metadata": {"a2uiRendererCapabilities": capabilities, "accountId": "debito-principal"}}
    response = client.post("/api/agent", json=body)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    return parse_sse(response.text)


def test_health():
    with _client(FakeLlm("")) as client:
        health = client.get("/api/health").json()
    assert health["a2uiVersion"] == "1.0"
    assert health["mimeType"] == "application/a2ui+json"
    assert health["catalogs"] == [BASIC_CATALOG_ID, FINANCE_CATALOG_ID]


def test_turno_completo():
    llm = FakeLlm(
        llm_response("Este mes lo que más pesa es la comida rápida.", example("resumen-del-mes")),
        thoughts=("Revisando las categorías del mes",),
    )
    with _client(llm) as client:
        events = _ask(client, "Hazme un resumen de mi mes")

    names = [name for name, _ in events]
    assert names[0] == "thought"
    narrative = "".join(data["text"] for name, data in events if name == "text")
    assert "comida rápida" in narrative

    parts = [data for name, data in events if name == "a2ui"]
    # Cada mensaje viaja como en A2A: una parte de datos etiquetada application/a2ui+json.
    assert all(p["kind"] == "data" and p["metadata"]["mimeType"] == "application/a2ui+json" for p in parts)
    a2ui = [p["data"] for p in parts]
    assert [next(k for k in m if k != "version") for m in a2ui] == [
        "createSurface",
        "updateComponents",
        "updateDataModel",
        "updateDataModel",
        "updateDataModel",
    ]
    assert {m["updateDataModel"]["path"] for m in a2ui[2:]} == {"/kpis", "/report", "/tips"}

    name, done = events[-1]
    assert name == "done"
    assert done["retries"] == 0 and done["fallback"] is False and done["model"] == "fake-gemini"
    # Lo que confirma Google (no la configuración): modelo que atendió y tokens.
    assert done["servedModel"] == "fake-gemini" and done["usage"]["thought"] == 800
    # El modelo recibió el contexto calculado por Python, no los movimientos crudos.
    assert "Gasto del mes" in llm.calls[0]["user"]
    assert "---BEGIN A2UI JSON SCHEMA---" in llm.calls[0]["system"]


def test_bloque_invalido_se_reintenta_citando_el_error():
    invalid = example("pagos-con-yape")
    invalid[1]["updateComponents"]["components"][1]["component"] = "AppLoQueSea"  # fuera de la lista blanca
    llm = FakeLlm(
        llm_response("Aquí tienes tus pagos.", invalid),
        retry=llm_response("Corregido.", example("pagos-con-yape")),
    )
    with _client(llm) as client:
        events = _ask(client, "Solo mis Yape")
    done = events[-1][1]
    assert done["retries"] == 1 and done["fallback"] is False
    assert llm.calls[-1].get("retry") and "no era válida" in llm.calls[-1]["user"]
    components = next(d["data"] for n, d in events if n == "a2ui" and "updateComponents" in d["data"])["updateComponents"]["components"]
    assert any(c["component"] == "AppMovementsTable" for c in components)


def test_si_falla_dos_veces_usa_la_pantalla_de_respaldo():
    llm = FakeLlm("Solo texto, sin pantalla.", retry="Tampoco.")
    with _client(llm) as client:
        events = _ask(client, "¿Cómo voy?")
    done = events[-1][1]
    assert done["fallback"] is True
    assert any(n == "a2ui" for n, _ in events)


def test_navegador_sin_el_catalogo_de_finanzas():
    with _client(FakeLlm("")) as client:
        events = _ask(client, "Hola", capabilities={"1.0": {"supportedCatalogIds": [BASIC_CATALOG_ID]}})
    assert events == [("error", events[0][1])]
    assert events[0][1]["code"] == "CATALOG_MISMATCH"


def test_sin_api_key_las_acciones_siguen_funcionando():
    with _client(None) as client:
        events = _ask(client, "Hola")
        assert events[0][0] == "error" and events[0][1]["code"] == "NO_API_KEY"

        action = {
            "version": "1.0",
            "action": {
                "name": "filterMovements",
                "surfaceId": "srv-1234abcd",
                "sourceComponentId": "table",
                "timestamp": "2026-11-06T12:00:00Z",
                "context": {"method": "yape"},
            },
        }
        body = {"a2ui": action, "metadata": {"a2uiRendererCapabilities": CAPABILITIES, "accountId": "debito-principal"}}
        events = parse_sse(client.post("/api/agent", json=body).text)
    assert events[0][0] == "a2ui" and events[0][1]["data"]["updateDataModel"]["path"] == "/table"
    assert events[-1] == ("done", events[-1][1]) and events[-1][1]["kind"] == "action"


def test_peticion_mal_formada():
    with _client(FakeLlm("")) as client:
        response = client.post("/api/agent", json={"metadata": {"a2uiRendererCapabilities": {}, "accountId": "x"}})
    assert response.status_code == 422
