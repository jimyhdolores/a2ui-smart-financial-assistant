# Agente A2UI (Python)

El agente del **modo servidor** del nivel Avanzado: recibe la pregunta, le pide a Gemini que
**diseñe la pantalla** con el catálogo compartido y devuelve mensajes **A2UI v1.0** por
_Server-Sent Events_. Python pone todas las cifras.

```
pregunta ─▶ contexto (Python) ─▶ Gemini escribe texto + <a2ui-json> ─▶ el SDK valida contra el catálogo
         ─▶ el binder completa punteros y datos ─▶ eventos: text · thought · a2ui · done
```

## Arrancar

Desde la raíz del monorepo:

```bash
cp apps/agent/.env.example apps/agent/.env   # pon tu GEMINI_API_KEY
pnpm dev:agent                               # o `pnpm dev` para levantar también el front
```

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

## API

- `GET /api/health` → modelo, versión A2UI, MIME y catálogos que ofrece el agente.
- `POST /api/agent` → `{text | a2ui, metadata: {a2uiRendererCapabilities, accountId}}`; responde
  `text/event-stream`. Cada evento `a2ui` es un mensaje A2UI v1.0 (`application/a2ui+json`).

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
- **Binder, acciones y API**: con un Gemini falso (`tests/conftest.py`), sin API key.
