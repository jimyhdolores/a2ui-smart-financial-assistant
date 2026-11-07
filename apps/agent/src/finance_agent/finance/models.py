"""Dominio financiero (port de apps/web/src/app/models/finance.model.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

PaymentMethod = Literal["yape", "plin", "debito", "credito", "efectivo", "transferencia"]
TransactionType = Literal["gasto", "ingreso"]
Category = Literal[
    "cafeteria",
    "snacks",
    "comida_rapida",
    "conveniencia",
    "transporte",
    "suscripciones",
    "restaurantes",
    "supermercado",
    "servicios",
    "ocio",
    "salud",
    "compras",
    "ingreso",
]
AccountKind = Literal["debito", "ahorros", "credito"]

CURRENCY = "$"


@dataclass(frozen=True)
class CategoryMeta:
    label: str
    icon: str
    es_hormiga: bool


@dataclass(frozen=True)
class PaymentMethodMeta:
    label: str
    icon: str


CATEGORY_META: dict[str, CategoryMeta] = {
    "cafeteria": CategoryMeta("Cafeterías", "local_cafe", True),
    "snacks": CategoryMeta("Snacks", "icecream", True),
    "comida_rapida": CategoryMeta("Comida rápida", "lunch_dining", True),
    "conveniencia": CategoryMeta("Tiendas de conveniencia", "storefront", True),
    "transporte": CategoryMeta("Transporte", "directions_bus", True),
    "suscripciones": CategoryMeta("Suscripciones", "subscriptions", True),
    "restaurantes": CategoryMeta("Restaurantes", "restaurant", False),
    "supermercado": CategoryMeta("Supermercado", "shopping_cart", False),
    "servicios": CategoryMeta("Servicios", "receipt_long", False),
    "ocio": CategoryMeta("Ocio", "sports_esports", False),
    "salud": CategoryMeta("Salud", "local_pharmacy", False),
    "compras": CategoryMeta("Compras", "shopping_bag", False),
    "ingreso": CategoryMeta("Ingreso", "payments", False),
}

PAYMENT_METHOD_META: dict[str, PaymentMethodMeta] = {
    "yape": PaymentMethodMeta("Yape", "qr_code_2"),
    "plin": PaymentMethodMeta("Plin", "qr_code_scanner"),
    "debito": PaymentMethodMeta("Débito", "account_balance_wallet"),
    "credito": PaymentMethodMeta("Crédito", "credit_card"),
    "efectivo": PaymentMethodMeta("Efectivo", "payments"),
    "transferencia": PaymentMethodMeta("Transferencia", "swap_horiz"),
}


@dataclass(frozen=True)
class Transaction:
    id: str
    date: date
    merchant: str
    category: str
    amount: float  # siempre positivo
    method: str
    type: str  # 'gasto' | 'ingreso'


@dataclass(frozen=True)
class Account:
    id: str
    name: str
    kind: str  # 'debito' | 'ahorros' | 'credito'
    balance: float  # débito/ahorros: disponible · crédito: deuda
    transactions: tuple[Transaction, ...]
    credit_limit: float | None = None
