"""Servidor HTTP del agente A2UI (FastAPI).

    GET  /api/health   → modelo, versión A2UI y catálogos que ofrece el agente.
    POST /api/agent    → una pregunta o un mensaje del renderer; responde con
                         `text/event-stream` (eventos text · thought · a2ui · error · done).

Ejecutar en desarrollo (desde la raíz del monorepo): `pnpm dev:agent`.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse, ServerSentEvent

from .agent import FinanceAgent
from .catalogs import build_generator
from .llm import GeminiClient, LlmClient
from .protocol import A2UI_MIME_TYPE, A2UI_VERSION, BASIC_CATALOG_ID, FINANCE_CATALOG_ID, AgentRequest
from .settings import Settings, get_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def create_app(settings: Settings | None = None, llm: LlmClient | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = llm
        if client is None and settings.gemini_api_key:
            client = GeminiClient(
                api_key=settings.gemini_api_key.get_secret_value(),
                model=settings.gemini_model,
                thinking_level=settings.gemini_thinking_level,
            )
        app.state.agent = FinanceAgent(
            build_generator(settings.a2ui_catalog_dir),
            client,
            expose_llm_output=settings.expose_llm_output,
        )
        try:
            yield
        finally:
            if client is not None and llm is None:
                await client.aclose()

    app = FastAPI(title="Fintech Nano · agente A2UI", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    async def health(request: Request) -> dict:
        agent: FinanceAgent = request.app.state.agent
        return {
            "status": "ok",
            "model": agent.model or settings.gemini_model,
            "llmConfigured": agent.llm is not None,
            "a2uiVersion": A2UI_VERSION,
            "mimeType": A2UI_MIME_TYPE,
            "catalogs": [BASIC_CATALOG_ID, FINANCE_CATALOG_ID],
        }

    @app.post("/api/agent", response_class=EventSourceResponse)
    async def agent_endpoint(body: AgentRequest, request: Request) -> AsyncIterable[ServerSentEvent]:
        agent: FinanceAgent = request.app.state.agent
        async for event in agent.run(body):
            yield event

    return app


app = create_app()
