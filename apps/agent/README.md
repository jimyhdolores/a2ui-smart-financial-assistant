# Agente A2UI (Python)

El agente del **modo servidor** del nivel Avanzado: recibe la pregunta, le pide a Gemini que
**diseñe la pantalla** con el catálogo compartido y devuelve mensajes **A2UI v1.0** por
_Server-Sent Events_. Python pone todas las cifras.

```
pregunta ─▶ contexto (Python) ─▶ Gemini escribe texto + un bloque A2UI (Express o JSON)
         ─▶ el SDK lo traduce a JSON v1.0 y lo valida contra el catálogo
         ─▶ el binder completa punteros y datos ─▶ eventos: text · thought · a2ui · done
```

Usa el SDK oficial de A2UI, `a2ui-agent-sdk` **0.11** (A2UI 1.0). No se sube a la 0.12 todavía: esa versión
escribe `@catalogId` en cada pieza y el visor publicado en npm (`@a2ui/web_core` 0.15) aún no lo lee.

## Arrancar

Desde la raíz del monorepo:

```bash
pnpm install       # instala el front y este agente (uv sync) y crea .env si falta
                   # → pon tu GEMINI_API_KEY en apps/agent/.env
pnpm dev:agent     # o `pnpm dev` para levantar también el front
```

Solo el agente: `pnpm setup:agent` (equivale a `uv sync` aquí más crear el `.env`).

Sin la raíz: `uv run fastapi dev --port 8787` dentro de `apps/agent` (el proxy del front apunta a ese puerto).

## Configuración (`.env`)

| Variable | Por defecto | Qué hace |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Key de Google AI Studio (restringida a "Gemini API"). Nunca sale del servidor. |
| `GEMINI_MODEL` | `gemini-4-argon` | Requiere facturación. Gratis: `gemini-3.8-flash`. |
| `GEMINI_THINKING_LEVEL` | `medium` | `low` responde más rápido. |
| `ALLOWED_ORIGINS` | `["http://localhost:4200"]` | CORS (en desarrollo el front usa el proxy de Angular). |
| `EXPOSE_LLM_OUTPUT` | `true` | Incluye en `done` lo que escribió Gemini (para "Ver protocolo A2UI"). |
| `A2UI_CATALOG_DIR` | `packages/a2ui-catalog` | El contrato compartido con el front. |
| `A2UI_INFERENCE_FORMAT` | `express` | Cómo escribe Gemini la pantalla: `express` (formato compacto de A2UI 1.0, `<a2ui>`) o `json` (Direct JSON, `<a2ui-json>`). El navegador recibe el mismo JSON v1.0 en los dos casos. |

## API

- `GET /api/health` → modelo, versión A2UI, MIME, formato de inferencia (`inferenceFormat`), versión del
  SDK (`a2uiSdk`) y catálogos que ofrece el agente.
- `POST /api/agent` → `{text | a2ui, metadata: {a2uiRendererCapabilities, accountId}}`; responde
  `text/event-stream`. Cada evento `a2ui` es un mensaje A2UI v1.0 (`application/a2ui+json`).
  - Con `text`: un turno del modelo. El evento `done` trae `inferenceFormat`, `llmRaw` (el bloque tal cual
    lo escribió Gemini) y `llmOutput` (la estructura ya en JSON), además del modelo y los tokens.
  - Con `a2ui`: un mensaje del navegador (`action`, `error` o `callAgentFunction`). Lo valida y despacha
    el procesador oficial del SDK (`a2ui.rpc.RendererToAgentMessageProcessor`) contra el esquema de
    A2UI 1.0. Las acciones se recalculan en Python sin pasar por el modelo; un mensaje mal formado
    responde con un evento `error` (`INVALID_RENDERER_MESSAGE`).

## Tests

```bash
pnpm test:agent        # desde la raíz (o `uv run pytest` aquí)
```

- **Paridad con el front** (`tests/test_finance_parity.py`): el dataset y la matemática en Python
  deben dar exactamente lo mismo que el navegador. La referencia (`tests/fixtures/ts_reference.json`)
  se volcó desde la app: con el front corriendo, en `/avanzado` → _Asistente IA_, en la consola de
  DevTools se toma `ng.getComponent(document.querySelector('app-chat')).analytics` y se guardan
  `buildContext`, `antVerdictFallback`, `projectDepletion` y `buildData` de las 3 cuentas, junto con la
  fecha del día. Para regenerarla, repite el volcado y reemplaza el archivo.
- **Binder, acciones y API**: con un Gemini falso (`tests/conftest.py`), sin API key. Los tests de un turno
  completo corren dos veces, con Gemini escribiendo en Express y en JSON (fixture `fmt`).
