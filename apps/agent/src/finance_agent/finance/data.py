"""Dataset ficticio y determinista (port de apps/web/src/app/services/finance-data.ts).

Las mismas 3 cuentas, las mismas semillas y el mismo historial generado con
`mulberry32` + FNV-1a. Para una misma fecha de "hoy", Python y el navegador
producen exactamente los mismos movimientos: así el modo servidor y el modo
local muestran las mismas cifras.

En una app real estos datos vendrían de la base de datos del banco; aquí el
servidor es la "fuente de la verdad" de la demo.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from functools import lru_cache

from .jscompat import Mulberry32, fnv1a, round2
from .models import Account, Transaction

# Seed: (día, período, comercio, categoría, importe, método[, tipo])
Seed = tuple

#: Meses de historial hacia atrás además del actual y el anterior (offsets 2..5).
HISTORY_MONTHS = 5

PRINCIPAL_SEEDS: list[Seed] = [
    # ── Mes actual ──────────────────────────────────────────────────────────
    (1, "cur", "Sueldo mensual", "ingreso", 3200, "transferencia", "ingreso"),
    (2, "cur", "Supermercado Metro", "supermercado", 128.4, "debito"),
    (2, "cur", "Café Altomayo", "cafeteria", 6.5, "yape"),
    (3, "cur", "Tambo+", "conveniencia", 8.9, "yape"),
    (3, "cur", "Combi Línea 20", "transporte", 2.5, "efectivo"),
    (4, "cur", "Starbucks", "cafeteria", 14.8, "debito"),
    (5, "cur", "KFC", "comida_rapida", 22.9, "debito"),
    (5, "cur", "Quiosco snacks", "snacks", 3.2, "efectivo"),
    (6, "cur", "Netflix", "suscripciones", 12.99, "debito"),
    (6, "cur", "Yape almuerzo", "comida_rapida", 12.0, "yape"),
    (7, "cur", "Spotify", "suscripciones", 6.99, "debito"),
    (7, "cur", "Rappi", "comida_rapida", 18.5, "yape"),
    (8, "cur", "Juan Valdez", "cafeteria", 9.2, "yape"),
    (9, "cur", "Plaza Vea", "supermercado", 64.3, "debito"),
    (10, "cur", "Bembos", "comida_rapida", 16.4, "debito"),
    (11, "cur", "Tambo+", "conveniencia", 5.6, "plin"),
    (12, "cur", "Cineplanet", "ocio", 24.0, "debito"),
    (12, "cur", "Canchita y gaseosa", "snacks", 8.0, "efectivo"),
    (13, "cur", "Café de paso", "cafeteria", 7.3, "yape"),
    (14, "cur", "Taxi app", "transporte", 12.0, "yape"),
    (15, "cur", "InkaFarma", "salud", 19.9, "debito"),
    (16, "cur", "Café de paso", "cafeteria", 6.8, "yape"),
    (17, "cur", "Oechsle", "compras", 89.9, "debito"),
    (18, "cur", "McDonald's", "comida_rapida", 15.7, "plin"),
    (19, "cur", "Tambo+", "conveniencia", 7.4, "yape"),
    (20, "cur", "Restaurante La Lucha", "restaurantes", 34.5, "debito"),
    (21, "cur", "Café de paso", "cafeteria", 6.5, "yape"),
    (22, "cur", "Quiosco snacks", "snacks", 4.2, "efectivo"),
    (23, "cur", "Recibo de luz", "servicios", 58.0, "debito"),
    (24, "cur", "Combi Línea 20", "transporte", 2.5, "efectivo"),
    (25, "cur", "Café de paso", "cafeteria", 8.1, "yape"),
    (26, "cur", "Rappi", "comida_rapida", 21.3, "yape"),
    (27, "cur", "Tambo+", "conveniencia", 6.7, "plin"),
    (28, "cur", "Quiosco snacks", "snacks", 3.8, "efectivo"),
    # ── Mes anterior (menos gasto hormiga → sirve para comparar) ─────────────
    (1, "prev", "Sueldo mensual", "ingreso", 3200, "transferencia", "ingreso"),
    (3, "prev", "Supermercado Metro", "supermercado", 141.2, "debito"),
    (4, "prev", "Café Altomayo", "cafeteria", 9.1, "yape"),
    (5, "prev", "Café de paso", "cafeteria", 8.0, "yape"),
    (6, "prev", "KFC", "comida_rapida", 19.5, "debito"),
    (7, "prev", "Rappi", "comida_rapida", 22.3, "yape"),
    (8, "prev", "Tambo+", "conveniencia", 6.2, "yape"),
    (10, "prev", "Netflix", "suscripciones", 12.99, "debito"),
    (10, "prev", "Spotify", "suscripciones", 6.99, "debito"),
    (11, "prev", "Tambo+", "conveniencia", 7.8, "plin"),
    (12, "prev", "Café de paso", "cafeteria", 7.5, "yape"),
    (14, "prev", "Rappi", "comida_rapida", 17.8, "yape"),
    (15, "prev", "Restaurante La Lucha", "restaurantes", 42.0, "debito"),
    (16, "prev", "Plaza Vea", "supermercado", 72.1, "debito"),
    (18, "prev", "Café de paso", "cafeteria", 6.8, "yape"),
    (19, "prev", "Quiosco snacks", "snacks", 4.5, "efectivo"),
    (20, "prev", "Bembos", "comida_rapida", 15.2, "debito"),
    (21, "prev", "Taxi app", "transporte", 11.0, "yape"),
    (22, "prev", "Café de paso", "cafeteria", 7.2, "yape"),
    (23, "prev", "Quiosco snacks", "snacks", 5.2, "efectivo"),
    (24, "prev", "Tambo+", "conveniencia", 5.9, "plin"),
    (25, "prev", "Recibo de luz", "servicios", 55.0, "debito"),
    (26, "prev", "McDonald's", "comida_rapida", 18.9, "plin"),
    (27, "prev", "Quiosco snacks", "snacks", 3.9, "efectivo"),
    (28, "prev", "Café de paso", "cafeteria", 6.6, "yape"),
]

AHORROS_SEEDS: list[Seed] = [
    (2, "cur", "Ahorro programado", "ingreso", 600, "transferencia", "ingreso"),
    (5, "cur", "Rendimiento cuenta", "ingreso", 12.3, "transferencia", "ingreso"),
    (10, "cur", "Café de paso", "cafeteria", 6.5, "yape"),
    (18, "cur", "Traspaso a principal", "compras", 200.0, "transferencia"),
    (20, "cur", "Cena familiar", "restaurantes", 58.0, "debito"),
    (2, "prev", "Ahorro programado", "ingreso", 600, "transferencia", "ingreso"),
    (15, "prev", "Café de paso", "cafeteria", 7.0, "yape"),
    (22, "prev", "Compra electrodoméstico", "compras", 120.0, "debito"),
]

CREDITO_SEEDS: list[Seed] = [
    (1, "cur", "Pago de tarjeta", "ingreso", 500, "transferencia", "ingreso"),
    (3, "cur", "Restaurante Central", "restaurantes", 46.0, "credito"),
    (5, "cur", "iCloud+", "suscripciones", 2.99, "credito"),
    (6, "cur", "Amazon", "compras", 132.5, "credito"),
    (8, "cur", "Popeyes", "comida_rapida", 18.0, "credito"),
    (10, "cur", "Grifo Primax", "transporte", 45.0, "credito"),
    (12, "cur", "Netflix", "suscripciones", 12.99, "credito"),
    (14, "cur", "Zara", "compras", 210.0, "credito"),
    (16, "cur", "Starbucks", "cafeteria", 7.5, "credito"),
    (18, "cur", "Restaurante La Mar", "restaurantes", 52.3, "credito"),
    (20, "cur", "Farmacia", "salud", 28.4, "credito"),
    (22, "cur", "Smart Fit (gym)", "suscripciones", 39.9, "credito"),
    (24, "cur", "Popeyes", "comida_rapida", 16.8, "credito"),
    (26, "cur", "Audífonos Sony", "compras", 180.0, "credito"),
    (2, "prev", "Pago de tarjeta", "ingreso", 450, "transferencia", "ingreso"),
    (6, "prev", "Amazon", "compras", 98.0, "credito"),
    (12, "prev", "Netflix", "suscripciones", 12.99, "credito"),
    (15, "prev", "Restaurante Central", "restaurantes", 61.0, "credito"),
    (20, "prev", "Ripley", "compras", 145.0, "credito"),
    (25, "prev", "Grifo Primax", "transporte", 40.0, "credito"),
]


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    """Suma `delta` meses (puede ser negativo), como `new Date(y, m + delta, …)`."""
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def _month_date(today: date, day: int, months_ago: int) -> date:
    year, month = _shift_month(today.year, today.month, -months_ago)
    return date(year, month, min(day, 28))


@dataclass(frozen=True)
class _MerchantProfile:
    merchant: str
    category: str
    method: str
    type: str
    min: float
    max: float


def _derive_pool(seeds: list[Seed]) -> list[_MerchantProfile]:
    pool: dict[str, dict] = {}
    for seed in seeds:
        _, _, merchant, category, amount, method, *rest = seed
        tx_type = rest[0] if rest else "gasto"
        current = pool.get(merchant)
        if current:
            current["min"] = min(current["min"], amount)
            current["max"] = max(current["max"], amount)
        else:
            pool[merchant] = {
                "merchant": merchant,
                "category": category,
                "method": method,
                "type": tx_type,
                "min": amount,
                "max": amount,
            }
    return [_MerchantProfile(**p) for p in pool.values()]


def _generate_history(today: date, acc_id: str, seeds: list[Seed]) -> list[Transaction]:
    pool = _derive_pool(seeds)
    income = [p for p in pool if p.type == "ingreso"]
    spend = [p for p in pool if p.type != "ingreso"]
    if not spend:
        return []

    out: list[Transaction] = []
    for ago in range(2, HISTORY_MONTHS + 1):
        rng = Mulberry32(fnv1a(f"{acc_id}:{ago}"))
        for k, p in enumerate(income):
            out.append(
                Transaction(
                    id=f"{acc_id}-h{ago}-in{k}",
                    date=_month_date(today, 2 + k, ago),
                    merchant=p.merchant,
                    category=p.category,
                    amount=float(p.max),
                    method=p.method,
                    type="ingreso",
                )
            )
        count = 10 + int(rng() * 8)  # 10–17 movimientos
        for i in range(count):
            p = spend[int(rng() * len(spend))]
            amount = round2(p.min + rng() * (p.max - p.min))
            out.append(
                Transaction(
                    id=f"{acc_id}-h{ago}-{i}",
                    date=_month_date(today, 1 + int(rng() * 28), ago),
                    merchant=p.merchant,
                    category=p.category,
                    amount=amount,
                    method=p.method,
                    type="gasto",
                )
            )
    return out


def _materialize(today: date, acc_id: str, seeds: list[Seed]) -> tuple[Transaction, ...]:
    out: list[Transaction] = []
    for i, seed in enumerate(seeds):
        day, period, merchant, category, amount, method, *rest = seed
        if period == "cur":
            if day > today.day:
                continue  # día del mes actual que aún no ha ocurrido
            tx_date = date(today.year, today.month, day)
        else:
            tx_date = _month_date(today, day, 1)
        out.append(
            Transaction(
                id=f"{acc_id}-{i}",
                date=tx_date,
                merchant=merchant,
                category=category,
                amount=float(amount),
                method=method,
                type=rest[0] if rest else "gasto",
            )
        )
    out.extend(_generate_history(today, acc_id, seeds))
    # Más reciente primero (orden estable, igual que `Array.sort` en JS).
    return tuple(sorted(out, key=lambda t: t.date, reverse=True))


@dataclass(frozen=True)
class Dataset:
    """Las cuentas del usuario tal como están "hoy"."""

    today: date
    accounts: tuple[Account, ...]

    def get(self, account_id: str) -> Account | None:
        return next((a for a in self.accounts if a.id == account_id), None)


@lru_cache(maxsize=8)
def build_dataset(today: date) -> Dataset:
    """Construye (y cachea por fecha) el dataset completo."""
    accounts = (
        Account(
            id="debito-principal",
            name="Cuenta Débito Principal",
            kind="debito",
            balance=1180.45,
            transactions=_materialize(today, "debito-principal", PRINCIPAL_SEEDS),
        ),
        Account(
            id="debito-ahorros",
            name="Cuenta Débito Ahorros",
            kind="ahorros",
            balance=8450.0,
            transactions=_materialize(today, "debito-ahorros", AHORROS_SEEDS),
        ),
        Account(
            id="tarjeta-credito",
            name="Tarjeta de Crédito",
            kind="credito",
            balance=2340.6,  # deuda pendiente
            credit_limit=4000,
            transactions=_materialize(today, "tarjeta-credito", CREDITO_SEEDS),
        ),
    )
    return Dataset(today=today, accounts=accounts)
