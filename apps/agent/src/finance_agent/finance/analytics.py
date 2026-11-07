"""Matemática determinista del dinero (port de apps/web/src/app/services/finance-analytics.ts).

Todo lo cuantitativo se calcula aquí, nunca en el LLM: el modelo elige QUÉ
mostrar y Python pone los NÚMEROS. Cada método replica su gemelo en TypeScript
(mismos umbrales, mismo orden de operaciones, mismo redondeo) para que el modo
servidor muestre las mismas cifras que el modo local.
"""

from __future__ import annotations

import calendar
import math
from datetime import date, timedelta
from typing import Any

from .data import Dataset
from .jscompat import clamp, js_round, js_str, js_sum, round2, to_num
from .models import CATEGORY_META, CURRENCY, PAYMENT_METHOD_META, Account, Transaction

#: Importe máximo para que un consumo de categoría hormiga cuente como tal.
ANT_CATEGORY_MAX = 35
#: Importe máximo para micro-pagos por billetera (Yape/Plin).
ANT_WALLET_MAX = 30

#: Los 7 widgets de finanzas (mismos nombres que el catálogo A2UI).
FINANCE_COMPONENTS = (
    "AppQuickStats",
    "AppAntExpense",
    "AppSpendingReport",
    "AppRecommendations",
    "AppSavingsPlan",
    "AppCreditAdvisor",
    "AppMovementsTable",
)

_MONTHS_ES = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)
_KNOWN_METHODS = ("yape", "plin", "debito", "credito", "efectivo", "transferencia")


def format_date(d: date) -> str:
    """'18 de septiembre' (igual que `Intl.DateTimeFormat('es', {day, month:'long'})`)."""
    return f"{d.day} de {_MONTHS_ES[d.month - 1]}"


def normalize_method(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.lower().strip()
    return text if text in _KNOWN_METHODS else None


def normalize_category(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.lower().strip()
    if text in CATEGORY_META:
        return text
    if "comida" in text or "restaur" in text:
        return "restaurantes"
    if "café" in text or "cafe" in text:
        return "cafeteria"
    if "super" in text:
        return "supermercado"
    return None


def describe_filter(params: dict[str, Any]) -> str:
    parts: list[str] = []
    if params.get("largest") is True:
        parts.append("Compra más grande")
    method = normalize_method(params.get("method"))
    if method:
        parts.append(f"Pagos con {PAYMENT_METHOD_META[method].label}")
    category = normalize_category(params.get("category"))
    if category:
        parts.append(CATEGORY_META[category].label)
    if params.get("antsOnly") is True:
        parts.append("Solo gastos hormiga")
    merchant = params.get("merchant")
    if isinstance(merchant, str) and merchant:
        parts.append(f'"{merchant}"')
    if params.get("period") == "previous":
        parts.append("Mes anterior")
    return " · ".join(parts) if parts else "Todos los movimientos del mes"


class FinanceAnalytics:
    """Analítica sobre un `Dataset` (las cuentas tal como están "hoy")."""

    def __init__(self, dataset: Dataset) -> None:
        self.dataset = dataset
        self.today = dataset.today

    # ─── Utilidades de período ───────────────────────────────────────────────

    def _in_period(self, tx: Transaction, period: str) -> bool:
        ref = self.today
        if period == "current":
            return tx.date.year == ref.year and tx.date.month == ref.month
        prev_year, prev_month = (ref.year, ref.month - 1) if ref.month > 1 else (ref.year - 1, 12)
        return tx.date.year == prev_year and tx.date.month == prev_month

    def gastos(self, account: Account, period: str) -> list[Transaction]:
        return [t for t in account.transactions if t.type == "gasto" and self._in_period(t, period)]

    @property
    def days_elapsed(self) -> int:
        return max(1, self.today.day)

    @property
    def days_in_month(self) -> int:
        return calendar.monthrange(self.today.year, self.today.month)[1]

    # ─── Regla de "gasto hormiga" ──────────────────────────────────────────────

    def is_ant(self, tx: Transaction) -> bool:
        if tx.type != "gasto":
            return False
        cat_hormiga = CATEGORY_META[tx.category].es_hormiga and tx.amount <= ANT_CATEGORY_MAX
        wallet_micro = tx.method in ("yape", "plin") and tx.amount <= ANT_WALLET_MAX
        return cat_hormiga or wallet_micro

    # ─── Cálculos base ─────────────────────────────────────────────────────────

    def total_gasto(self, account: Account, period: str = "current") -> float:
        return round2(js_sum(t.amount for t in self.gastos(account, period)))

    def category_breakdown(self, account: Account, period: str = "current") -> list[dict[str, Any]]:
        totals: dict[str, float] = {}
        for t in self.gastos(account, period):
            totals[t.category] = totals.get(t.category, 0) + t.amount
        grand = js_sum(totals.values()) or 1
        rows = [
            {
                "category": category,
                "label": CATEGORY_META[category].label,
                "icon": CATEGORY_META[category].icon,
                "total": round2(total),
                "pct": js_round((total / grand) * 100),
            }
            for category, total in totals.items()
        ]
        return sorted(rows, key=lambda r: r["total"], reverse=True)

    def ant_expenses(self, account: Account, period: str = "current") -> dict[str, Any]:
        items = [t for t in self.gastos(account, period) if self.is_ant(t)]
        total = round2(js_sum(t.amount for t in items))
        by_cat: dict[str, float] = {}
        for t in items:
            by_cat[t.category] = by_cat.get(t.category, 0) + t.amount
        by_category = sorted(
            (
                {
                    "category": category,
                    "label": CATEGORY_META[category].label,
                    "icon": CATEGORY_META[category].icon,
                    "total": round2(amount),
                }
                for category, amount in by_cat.items()
            ),
            key=lambda r: r["total"],
            reverse=True,
        )
        return {"total": total, "count": len(items), "byCategory": by_category, "transactions": items}

    def month_over_month(self, account: Account) -> dict[str, Any]:
        current = self.ant_expenses(account, "current")["total"]
        previous = self.ant_expenses(account, "previous")["total"]
        if previous > 0:
            delta_pct = js_round(((current - previous) / previous) * 100)
        else:
            delta_pct = 100 if current > 0 else 0
        if current > previous * 1.03:
            direction = "up"
        elif current < previous * 0.97:
            direction = "down"
        else:
            direction = "flat"
        return {"current": current, "previous": previous, "deltaPct": delta_pct, "direction": direction}

    def available_funds(self, account: Account) -> float:
        if account.kind == "credito":
            return round2((account.credit_limit or 0) - account.balance)
        return account.balance

    def project_depletion(self, account: Account, ant_reduction_pct: float = 0) -> dict[str, Any]:
        reduction = clamp((ant_reduction_pct or 0) / 100, 0, 1)
        total_gasto = self.total_gasto(account, "current")
        ant = self.ant_expenses(account, "current")["total"]
        adjusted = max(0, total_gasto - ant * reduction)
        daily_burn = round2(adjusted / self.days_elapsed)
        funds = self.available_funds(account)
        days_left = js_round(funds / daily_burn) if daily_burn > 0 else 999
        start = self.today + timedelta(days=max(0, days_left - 2))
        end = self.today + timedelta(days=days_left + 2)
        return {
            "dailyBurn": daily_burn,
            "daysLeft": days_left,
            "funds": round2(funds),
            "fromDate": format_date(start),
            "toDate": format_date(end),
            "depletesBeforeMonthEnd": days_left < self.days_in_month - self.today.day,
        }

    def estimated_monthly_income(self) -> float:
        principal = next((a for a in self.dataset.accounts if a.kind == "debito"), None)
        if principal is None:
            return 3000
        income = js_sum(
            t.amount
            for t in principal.transactions
            if t.type == "ingreso" and self._in_period(t, "current")
        )
        return round2(income) if income > 0 else 3000

    def credit_profile(self, account: Account) -> dict[str, Any]:
        card = account
        if account.kind != "credito":
            card = next((a for a in self.dataset.accounts if a.kind == "credito"), account)
        limit = card.credit_limit or 0
        debt = card.balance
        available = round2(limit - debt)
        usage_pct = js_round((debt / limit) * 100) if limit > 0 else 0
        income = self.estimated_monthly_income()
        min_payment = round2(debt * 0.05)
        capacity = round2(max(0, income * 0.3 - min_payment))
        risk = "high" if usage_pct >= 60 else "medium" if usage_pct >= 30 else "low"
        return {
            "limit": limit,
            "debt": round2(debt),
            "available": available,
            "usagePct": usage_pct,
            "income": income,
            "minPayment": min_payment,
            "capacity": capacity,
            "riskLevel": risk,
        }

    def simulate_credit(self, account: Account, price: float, months: float = 12) -> dict[str, Any]:
        profile = self.credit_profile(account)
        months = months if months and months > 0 else 12  # guarda contra división por cero
        monthly = round2((price * 1.15) / months)
        obligations = profile["minPayment"] + monthly
        dti = js_round((obligations / profile["income"]) * 100) if profile["income"] > 0 else 100
        exceeds_limit = price > profile["limit"]
        exceeds_available = price > profile["available"]
        if exceeds_limit or exceeds_available or dti >= 40:
            verdict = "high"
        elif dti >= 25:
            verdict = "medium"
        else:
            verdict = "low"
        return {
            "monthly": monthly,
            "months": months,
            "price": round2(price),
            "dti": dti,
            "verdict": verdict,
            "capacity": profile["capacity"],
            "exceedsLimit": exceeds_limit,
            "exceedsAvailable": exceeds_available,
        }

    def filter_movements(self, account: Account, params: dict[str, Any]) -> list[Transaction]:
        period = "previous" if params.get("period") == "previous" else "current"
        items = [t for t in account.transactions if self._in_period(t, period)]
        if params.get("type") == "ingreso":
            items = [t for t in items if t.type == "ingreso"]
        else:
            items = [t for t in items if t.type == "gasto"]
        method = normalize_method(params.get("method"))
        if method:
            items = [t for t in items if t.method == method]
        category = normalize_category(params.get("category"))
        if category:
            items = [t for t in items if t.category == category]
        if params.get("antsOnly") is True:
            items = [t for t in items if self.is_ant(t)]
        merchant = params.get("merchant")
        if isinstance(merchant, str) and merchant:
            needle = merchant.lower()
            items = [t for t in items if needle in t.merchant.lower()]
        min_amount = to_num(params.get("minAmount"))
        if min_amount is not None:
            items = [t for t in items if t.amount >= min_amount]
        items = sorted(items, key=lambda t: t.date, reverse=True)
        if params.get("largest") is True:
            top = sorted(items, key=lambda t: t.amount, reverse=True)[:1]
            items = top
        return items

    # ─── Resumen compacto para el LLM ─────────────────────────────────────────

    def build_context(self, account: Account) -> str:
        """Resumen textual corto: el ÚNICO dato de la cuenta que ve el modelo."""
        gasto = self.total_gasto(account, "current")
        cats = self.category_breakdown(account, "current")[:4]
        ant = self.ant_expenses(account, "current")
        mom = self.month_over_month(account)
        proj = self.project_depletion(account)
        funds = self.available_funds(account)
        c = CURRENCY
        if account.kind == "credito":
            account_line = (
                f"Cuenta: {account.name} ({account.kind}). Crédito disponible: {c}{js_str(funds)}. "
                f"Deuda actual: {c}{js_str(account.balance)}."
            )
        else:
            account_line = (
                f"Cuenta: {account.name} ({account.kind}). Saldo disponible: {c}{js_str(account.balance)}."
            )
        trend = {"up": "al alza", "down": "a la baja"}.get(mom["direction"], "estable")
        lines = [
            account_line,
            f"Gasto del mes: {c}{js_str(gasto)} en {len(self.gastos(account, 'current'))} movimientos.",
            "Top categorías: " + ", ".join(f"{x['label']} {c}{js_str(x['total'])}" for x in cats) + ".",
            f"Gastos hormiga: {c}{js_str(ant['total'])} ({ant['count']} compras pequeñas), "
            f"mes anterior {c}{js_str(mom['previous'])} (tendencia {trend}).",
            f"Proyección: al ritmo actual el dinero disponible dura ~{js_str(proj['daysLeft'])} días.",
        ]
        if account.kind == "credito":
            p = self.credit_profile(account)
            lines.append(
                f"Límite de crédito: {c}{js_str(p['limit'])} ({js_str(p['usagePct'])}% usado). "
                f"Pago mínimo: {c}{js_str(p['minPayment'])}."
            )
        return "\n".join(lines)

    # ─── Veredicto de gastos hormiga (determinista) ───────────────────────────

    def ant_verdict_fallback(self, account: Account) -> dict[str, str]:
        ant = self.ant_expenses(account, "current")
        total = self.total_gasto(account, "current") or 1
        share = ant["total"] / total
        mom = self.month_over_month(account)
        proj = self.project_depletion(account)
        credit_stressed = account.kind == "credito" and self.credit_profile(account)["usagePct"] >= 50
        if (
            mom["direction"] == "up" and mom["deltaPct"] > 15 and (share > 0.3 or credit_stressed)
        ) or proj["depletesBeforeMonthEnd"]:
            return {
                "status": "risk",
                "headline": "Podrías quedarte sin dinero antes de fin de mes",
                "message": "Si continúas así podrías quedarte sin dinero antes de finalizar el mes. "
                "Conviene frenar los consumos hormiga cuanto antes.",
            }
        if mom["direction"] == "up" or share > 0.25:
            return {
                "status": "warning",
                "headline": "Atención: estás aumentando tus gastos pequeños",
                "message": "Los pequeños consumos diarios están creciendo. "
                "Un pequeño ajuste ahora evita un susto a fin de mes.",
            }
        return {
            "status": "good",
            "headline": "Vas administrando bien tus gastos",
            "message": "Tus gastos hormiga están bajo control y no comprometen tu saldo. "
            "¡Buen trabajo, mantén el ritmo!",
        }

    # ═══ Mapeador maestro: widget + parámetros → `data` real ═══════════════════

    def build_data(self, component: str, params: dict[str, Any], account: Account) -> dict[str, Any]:
        if component == "AppSpendingReport":
            return self._spending_report_data(account)
        if component == "AppRecommendations":
            return self._recommendations_data(account)
        if component == "AppSavingsPlan":
            return self._savings_plan_data(account, params)
        if component == "AppCreditAdvisor":
            return self._credit_advisor_data(account, params)
        if component == "AppMovementsTable":
            return self._movements_data(account, params)
        if component == "AppAntExpense":
            return self.ant_data(account, self.ant_verdict_fallback(account))
        if component == "AppQuickStats":
            return self._quick_stats_data(account)
        return {}

    # ─── Constructores de `data` por widget ──────────────────────────────────

    def _quick_stats_data(self, account: Account) -> dict[str, Any]:
        available = self.available_funds(account)
        gasto = self.total_gasto(account, "current")
        ant = self.ant_expenses(account, "current")
        return {
            "currency": CURRENCY,
            "items": [
                {"icon": "account_balance_wallet", "label": "Disponible", "value": available, "tone": "neutral"},
                {"icon": "receipt_long", "label": "Gasto del mes", "value": gasto, "tone": "spend"},
                {"icon": "emoji_nature", "label": "Gastos hormiga", "value": ant["total"], "tone": "warn"},
                {"icon": "savings", "label": "Ahorro potencial", "value": round2(ant["total"] * 0.5), "tone": "good"},
            ],
        }

    def ant_data(
        self,
        account: Account,
        verdict: dict[str, str],
        reduction_pct: float = 0,
        interactive: bool = False,
    ) -> dict[str, Any]:
        ant = self.ant_expenses(account, "current")
        mom = self.month_over_month(account)
        proj = self.project_depletion(account, reduction_pct)
        return {
            "status": verdict["status"],
            "headline": verdict["headline"],
            "message": verdict["message"],
            "currency": CURRENCY,
            "antTotal": ant["total"],
            "antCount": ant["count"],
            "momPrevTotal": mom["previous"],
            "momDeltaPct": mom["deltaPct"],
            "momDirection": mom["direction"],
            "byCategory": ant["byCategory"],
            "daysLeft": proj["daysLeft"],
            "depletionFrom": proj["fromDate"],
            "depletionTo": proj["toDate"],
            "reductionPct": reduction_pct,
            "interactive": interactive,
        }

    def _spending_report_data(self, account: Account) -> dict[str, Any]:
        total = self.total_gasto(account, "current")
        categories = self.category_breakdown(account, "current")
        mom = self.month_over_month(account)
        gastos = self.gastos(account, "current")
        top_movements = [
            {
                "date": format_date(t.date),
                "merchant": t.merchant,
                "amount": t.amount,
                "category": CATEGORY_META[t.category].label,
                "icon": CATEGORY_META[t.category].icon,
            }
            for t in sorted(gastos, key=lambda t: t.amount, reverse=True)[:5]
        ]
        buckets = [0.0, 0.0, 0.0, 0.0, 0.0]
        for t in gastos:
            week = min(4, (t.date.day - 1) // 7)
            buckets[week] += t.amount
        weeks = min(5, math.ceil(self.today.day / 7))
        trend = [{"label": f"Sem {i + 1}", "value": round2(v)} for i, v in enumerate(buckets[:weeks])]
        return {
            "title": f"Reporte de gastos · {account.name}",
            "currency": CURRENCY,
            "total": total,
            "txCount": len(gastos),
            "categories": categories,
            "topCategory": categories[0]["label"] if categories else "—",
            "topCategoryTotal": categories[0]["total"] if categories else 0,
            "trend": trend,
            "topMovements": top_movements,
            "momDeltaPct": mom["deltaPct"],
            "momDirection": mom["direction"],
            "antTotal": self.ant_expenses(account, "current")["total"],
        }

    def _recommendations_data(self, account: Account) -> dict[str, Any]:
        ant = self.ant_expenses(account, "current")
        cats = self.category_breakdown(account, "current")
        total = self.total_gasto(account, "current") or 1
        income = self.estimated_monthly_income()
        subs = next((c for c in cats if c["category"] == "suscripciones"), None)
        c = CURRENCY
        tips: list[dict[str, Any]] = []
        if ant["total"] > 0:
            tips.append(
                {
                    "icon": "local_cafe",
                    "title": "Frena los gastos hormiga",
                    "detail": f"Cafeterías, snacks y delivery suman {c}{js_str(ant['total'])} este mes. "
                    "Recortar la mitad ya libera dinero.",
                    "impact": round2(ant["total"] * 0.5),
                }
            )
        if subs and subs["total"] > 0:
            tips.append(
                {
                    "icon": "subscriptions",
                    "title": "Revisa tus suscripciones",
                    "detail": f"Pagas {c}{js_str(subs['total'])} en suscripciones. "
                    "Cancela las que casi no uses.",
                    "impact": round2(subs["total"] * 0.6),
                }
            )
        tips.append(
            {
                "icon": "savings",
                "title": "Automatiza tu ahorro",
                "detail": f"Programa una transferencia del 10% de tu ingreso ({c}{js_str(round2(income * 0.1))}) "
                "apenas te paguen.",
                "impact": round2(income * 0.1),
            }
        )
        share = ant["total"] / total
        risk = "high" if share > 0.3 else "medium" if share > 0.18 else "low"
        alerts: list[dict[str, str]] = []
        proj = self.project_depletion(account)
        if proj["depletesBeforeMonthEnd"] and account.kind != "credito":
            alerts.append(
                {"icon": "error", "text": f"Al ritmo actual tu saldo podría agotarse hacia el {proj['fromDate']}."}
            )
        return {
            "title": "Recomendaciones para ti",
            "currency": CURRENCY,
            "riskLevel": risk,
            "tips": tips,
            "alerts": alerts,
            "potentialTotal": round2(js_sum(t["impact"] for t in tips)),
        }

    def _savings_plan_data(self, account: Account, params: dict[str, Any]) -> dict[str, Any]:
        income = self.estimated_monthly_income()
        ahorros = next((a for a in self.dataset.accounts if a.kind == "ahorros"), None)
        current = ahorros.balance if ahorros else account.balance
        goal_name = params.get("goalName") if isinstance(params.get("goalName"), str) else "Fondo de emergencia"
        target_param = to_num(params.get("goalTarget"))
        target = target_param if target_param is not None else round2(income * 3)
        pct = clamp(js_round((current / target) * 100), 0, 100) if target > 0 else 100
        ant = self.ant_expenses(account, "current")["total"]
        monthly_potential = round2(max(ant * 0.5, income * 0.1))
        projection = [
            {"label": f"+{m} mes{'es' if m > 1 else ''}", "amount": round2(current + monthly_potential * m)}
            for m in (1, 2, 3)
        ]
        months = max(0, math.ceil((target - current) / (monthly_potential or 1)))
        return {
            "title": "Tu plan de ahorro",
            "currency": CURRENCY,
            "goalName": goal_name,
            "goalTarget": target,
            "goalCurrent": round2(current),
            "pct": int(pct),
            "monthlyPotential": monthly_potential,
            "projection": projection,
            "months": int(months),
        }

    def _credit_advisor_data(self, account: Account, params: dict[str, Any]) -> dict[str, Any]:
        p = self.credit_profile(account)
        price = to_num(params.get("price"))
        months_param = to_num(params.get("months"))
        months = months_param if months_param is not None else 12
        product = params.get("product") if isinstance(params.get("product"), str) else None
        c = CURRENCY
        base: dict[str, Any] = {
            "title": "Asesor de crédito",
            "currency": CURRENCY,
            "limit": p["limit"],
            "debt": p["debt"],
            "available": p["available"],
            "usagePct": p["usagePct"],
            "capacity": p["capacity"],
            "minPayment": p["minPayment"],
            "income": p["income"],
            "riskLevel": p["riskLevel"],
        }
        if price is not None:
            sim = self.simulate_credit(account, price, months)
            base.update(
                {
                    "product": product if product is not None else "la compra",
                    "price": sim["price"],
                    "months": sim["months"],
                    "monthlyPayment": sim["monthly"],
                    "dti": sim["dti"],
                    "verdict": sim["verdict"],
                    "exceedsLimit": sim["exceedsLimit"],
                    "exceedsAvailable": sim["exceedsAvailable"],
                }
            )
            if sim["exceedsLimit"]:
                recommendation = (
                    f"El precio ({c}{js_str(sim['price'])}) supera tu límite de crédito ({c}{js_str(p['limit'])}). "
                    "No es posible financiarlo con esta tarjeta."
                )
            elif sim["exceedsAvailable"]:
                recommendation = (
                    f"El precio ({c}{js_str(sim['price'])}) supera tu crédito disponible ({c}{js_str(p['available'])}). "
                    "Necesitarías reducir la deuda actual antes de poder financiarlo."
                )
            elif sim["verdict"] == "high":
                recommendation = (
                    f"Comprometería el {js_str(sim['dti'])}% de tu ingreso mensual. "
                    "No es un buen momento; mejor espera o busca un plazo más largo."
                )
            elif sim["verdict"] == "medium":
                recommendation = (
                    f"Es asumible ({js_str(sim['dti'])}% de tu ingreso), pero ajustado. "
                    "Hazlo solo si recortas otros gastos."
                )
            else:
                recommendation = (
                    f"Tienes holgura: la cuota sería el {js_str(sim['dti'])}% de tu ingreso. "
                    "Puedes asumirlo con comodidad."
                )
            base["recommendation"] = recommendation
        elif p["riskLevel"] == "high":
            base["recommendation"] = "Tu uso de crédito es alto. Prioriza reducir la deuda antes de asumir nuevas cuotas."
        elif p["riskLevel"] == "medium":
            base["recommendation"] = "Tu uso de crédito es moderado. Tienes cierta capacidad, pero mantén el control."
        else:
            base["recommendation"] = (
                f"Tu crédito está sano. Podrías asumir una cuota de hasta {c}{js_str(p['capacity'])} al mes."
            )
        return base

    def _movements_data(self, account: Account, params: dict[str, Any]) -> dict[str, Any]:
        rows = [
            {
                "date": format_date(t.date),
                "merchant": t.merchant,
                "category": CATEGORY_META[t.category].label,
                "icon": CATEGORY_META[t.category].icon,
                "amount": t.amount,
                "method": t.method,
                "methodLabel": PAYMENT_METHOD_META[t.method].label,
                "methodIcon": PAYMENT_METHOD_META[t.method].icon,
            }
            for t in self.filter_movements(account, params)
        ]
        return {
            "title": "Movimientos",
            "currency": CURRENCY,
            "filterLabel": describe_filter(params),
            "rows": rows,
            "total": round2(js_sum(r["amount"] for r in rows)),
            "count": len(rows),
        }
