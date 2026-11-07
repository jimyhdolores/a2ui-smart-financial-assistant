"""Los errores de Gemini se traducen a mensajes que se entienden en el chat."""

from __future__ import annotations

from finance_agent.llm import _describe


def test_nivel_gratuito_sin_cuota():
    error = Exception(
        "Error code: 429 - {'error': {'message': 'Rate limit exceeded for model gemini-4-argon "
        "(limit: 0 input tokens per minute on Free Tier).'}}"
    )
    message = _describe(error, "gemini-4-argon")
    assert "nivel gratuito" in message and "facturación" in message and "gemini-4-argon" in message


def test_modelo_saturado():
    error = Exception("Error code: 503 - gemini-3.8-flash is currently experiencing high demand")
    assert "saturado" in _describe(error, "gemini-3.8-flash")


def test_key_invalida():
    assert "API key" in _describe(Exception("API key not valid. Please pass a valid API key."))
