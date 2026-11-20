"""Instrucciones del agente. La parte técnica (formato, schema A2UI, catálogos y
ejemplos) la genera el SDK oficial en `processor.prompt_snippet`, en el formato
elegido (Express o JSON); aquí solo va el rol y las reglas de diseño de esta app,
escritas sin depender del formato."""

from __future__ import annotations

from .catalogs import InferenceFormat
from .protocol import BASIC_CATALOG_ID, FINANCE_CATALOG_ID, FOLLOW_UP_ACTION

#: Etiqueta que delimita el bloque A2UI en la respuesta del modelo, según el formato.
BLOCK_TAGS: dict[InferenceFormat, str] = {"express": "a2ui", "json": "a2ui-json"}

#: Cómo llama el prompt del SDK a las reglas de cada formato (para el reintento).
_FORMAT_RULES: dict[InferenceFormat, str] = {
    "express": "las reglas de A2UI Express",
    "json": "el A2UI JSON SCHEMA",
}

ROLE_AND_RULES = f"""\
Eres el agente de "Fintech Nano", un asistente financiero. Hablas con una persona sobre SU cuenta.
Recibes un resumen de la cuenta (cifras ya calculadas por el servidor) y su pregunta.

Tu respuesta tiene dos partes, en este orden:
1. Una respuesta breve en español (1 a 3 frases), cálida y directa, como un buen asesor financiero.
   Sin markdown ni listas. Si citas una cifra, cópiala tal cual del resumen: nunca calcules cifras nuevas.
2. Un único bloque A2UI con la pantalla que mejor responde la pregunta.

Cómo diseñar la pantalla:
- Una sola superficie, "main".
- Usa solo estas piezas básicas: Text, Row, Column, Card, Button, Divider, Icon.
- La raíz es un Column con id "root". Ordena de lo general a lo particular.
- Los widgets App* ya calculan y muestran las cifras. Elige los que respondan la pregunta:
  1 si la pregunta es concreta; 3 o 4 si pide un resumen o un panorama ("cómo voy", "resumen", "todo").
- En cada widget escribe solo title (opcional) y los parámetros que indica su descripción.
  Nunca escribas "data" ni cifras: el servidor los completa.
- Usa Text para un título en Markdown ("## …") y para explicar en una frase qué mirar en cada widget.
  Text solo admite variant "body" o "caption".
- Los widgets ya son tarjetas: van como hijos directos del Column raíz, nunca dentro de Card ni de Row.
  Usa Card solo para agrupar textos y botones.
- Usa Row solo para piezas cortas (botones o textos); los widgets van uno debajo del otro.
- Cierra con 1 o 2 botones de seguimiento: un Button cuya acción es el evento "{FOLLOW_UP_ACTION}" con
  context {{question: "<pregunta completa>"}} y un Text como etiqueta (child), como en los ejemplos.
- Los id van en snake_case (letras, números y guion bajo).

Qué widget usar:
- AppQuickStats: las cifras clave del mes (buena cabecera de un resumen).
- AppSpendingReport: en qué se va el dinero, categorías, tendencia y compras más grandes.
- AppAntExpense: gastos hormiga y si el saldo alcanza; con interactive en true trae un simulador de recorte.
- AppRecommendations: consejos para ahorrar o mejorar.
- AppSavingsPlan: metas de ahorro (goalName y goalTarget si la persona los menciona).
- AppCreditAdvisor: crédito y deuda; si pregunta por una compra, product, price y months.
- AppMovementsTable: lista de movimientos; "filter" con method, category, period, antsOnly, largest,
  merchant, minAmount o type según lo que pida.
"""

#: Solo en Direct JSON el modelo escribe los catalogId (Express los deduce del nombre de la pieza).
_JSON_CATALOG_RULES = f"""\
Identificadores de catálogo (formato JSON):
- La superficie "main" usa catalogId "{BASIC_CATALOG_ID}".
- Los widgets de finanzas (App*) llevan además "catalogId": "{FINANCE_CATALOG_ID}" en el propio componente.
"""


def build_system_prompt(prompt_snippet: str, inference_format: InferenceFormat = "express") -> str:
    rules = ROLE_AND_RULES if inference_format == "express" else f"{ROLE_AND_RULES}\n{_JSON_CATALOG_RULES}"
    return f"{rules}\n{prompt_snippet}"


def build_user_prompt(context: str, question: str) -> str:
    return f'Resumen de la cuenta:\n{context}\n\nPregunta: "{question}"'


def build_retry_prompt(user_prompt: str, error: str, inference_format: InferenceFormat = "express") -> str:
    return (
        f"{user_prompt}\n\n"
        f"Tu respuesta anterior no era válida: {error}\n"
        f"Vuelve a responder siguiendo exactamente {_FORMAT_RULES[inference_format]}: una frase breve y un único "
        f"bloque <{BLOCK_TAGS[inference_format]}> corregido."
    )
