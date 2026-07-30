import { Injectable, inject } from '@angular/core';
import {
  Account,
  CATEGORY_META,
  Category,
  CURRENCY,
  PAYMENT_METHOD_META,
  PaymentMethod,
  Transaction,
} from '../models/finance.model';
import { A2uiComponent } from '../models/a2ui.model';
import { FinanceDataService } from './finance-data';

/** Ventana temporal de análisis. */
export type Period = 'current' | 'previous';

/** Nivel de riesgo cualitativo reutilizado por varios componentes. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Umbral (importe) por debajo del cual un consumo de categoría hormiga cuenta como tal. */
const ANT_CATEGORY_MAX = 35;
/** Umbral para micro-pagos por billetera (Yape/Plin), aunque la categoría no sea hormiga. */
const ANT_WALLET_MAX = 30;

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceAnalyticsService — MATEMÁTICA DETERMINISTA DEL DINERO          ║
 * ║                                                                       ║
 * ║  Todo lo cuantitativo se calcula AQUÍ, en TypeScript, nunca en el     ║
 * ║  LLM (Gemini Nano no es fiable con aritmética y tiene poco contexto). ║
 * ║  El modelo solo interpreta el lenguaje y elige QUÉ mostrar; estos     ║
 * ║  métodos producen los NÚMEROS y el `data` de cada componente.         ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class FinanceAnalyticsService {
  private readonly finance = inject(FinanceDataService);
  private readonly today = new Date();

  // ─── Utilidades de período ───────────────────────────────────────────────

  /** ¿La transacción cae en el mes actual / anterior? */
  private inPeriod(tx: Transaction, period: Period): boolean {
    const d = tx.date;
    const ref = this.today;
    if (period === 'current') {
      return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
    }
    const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
  }

  private gastos(account: Account, period: Period): Transaction[] {
    return account.transactions.filter((t) => t.type === 'gasto' && this.inPeriod(t, period));
  }

  /** Días transcurridos del mes actual (para la tasa de gasto diaria). */
  private get daysElapsed(): number {
    return Math.max(1, this.today.getDate());
  }

  private get daysInMonth(): number {
    return new Date(this.today.getFullYear(), this.today.getMonth() + 1, 0).getDate();
  }

  // ─── Regla de "gasto hormiga" ──────────────────────────────────────────────

  /** Un gasto es "hormiga" si es de categoría hormiga y pequeño, o un micro-pago por billetera. */
  isAnt(tx: Transaction): boolean {
    if (tx.type !== 'gasto') return false;
    const catHormiga = CATEGORY_META[tx.category].esHormiga && tx.amount <= ANT_CATEGORY_MAX;
    const walletMicro = (tx.method === 'yape' || tx.method === 'plin') && tx.amount <= ANT_WALLET_MAX;
    return catHormiga || walletMicro;
  }

  // ─── Cálculos base ─────────────────────────────────────────────────────────

  totalGasto(account: Account, period: Period = 'current'): number {
    return round2(this.gastos(account, period).reduce((s, t) => s + t.amount, 0));
  }

  /** Reparto por categoría (para la dona), ordenado de mayor a menor. */
  categoryBreakdown(account: Account, period: Period = 'current') {
    const totals = new Map<Category, number>();
    for (const t of this.gastos(account, period)) {
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    }
    const grand = [...totals.values()].reduce((s, v) => s + v, 0) || 1;
    return [...totals.entries()]
      .map(([category, total]) => ({
        category,
        label: CATEGORY_META[category].label,
        icon: CATEGORY_META[category].icon,
        total: round2(total),
        pct: Math.round((total / grand) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }

  /** Análisis de gastos hormiga del período. */
  antExpenses(account: Account, period: Period = 'current') {
    const list = this.gastos(account, period).filter((t) => this.isAnt(t));
    const total = round2(list.reduce((s, t) => s + t.amount, 0));
    const byCat = new Map<Category, number>();
    for (const t of list) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    const byCategory = [...byCat.entries()]
      .map(([category, sum]) => ({
        category,
        label: CATEGORY_META[category].label,
        icon: CATEGORY_META[category].icon,
        total: round2(sum),
      }))
      .sort((a, b) => b.total - a.total);
    return { total, count: list.length, byCategory, transactions: list };
  }

  /** Comparación de gasto hormiga mes actual vs mes anterior. */
  monthOverMonth(account: Account) {
    const current = this.antExpenses(account, 'current').total;
    const previous = this.antExpenses(account, 'previous').total;
    const deltaPct =
      previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : current > 0
          ? 100
          : 0;
    const direction: 'up' | 'down' | 'flat' =
      current > previous * 1.03 ? 'up' : current < previous * 0.97 ? 'down' : 'flat';
    return { current, previous, deltaPct, direction };
  }

  /** Fondos disponibles: saldo (débito) o crédito libre (tarjeta). */
  availableFunds(account: Account): number {
    if (account.kind === 'credito') return round2((account.creditLimit ?? 0) - account.balance);
    return account.balance;
  }

  /**
   * Proyección de agotamiento de fondos, asumiendo el ritmo de gasto actual y
   * SIN nuevos ingresos (escenario prudente). `antReductionPct` (0-100) simula
   * recortar ese % de los gastos hormiga → alimenta el simulador "¿y si...?".
   */
  projectDepletion(account: Account, opts: { antReductionPct?: number } = {}) {
    const reduction = clamp((opts.antReductionPct ?? 0) / 100, 0, 1);
    const totalGasto = this.totalGasto(account, 'current');
    const ant = this.antExpenses(account, 'current').total;
    const adjustedGasto = Math.max(0, totalGasto - ant * reduction);
    const dailyBurn = round2(adjustedGasto / this.daysElapsed);
    const funds = this.availableFunds(account);
    const daysLeft = dailyBurn > 0 ? Math.round(funds / dailyBurn) : 999;

    const from = new Date(this.today);
    from.setDate(from.getDate() + Math.max(0, daysLeft - 2));
    const to = new Date(this.today);
    to.setDate(to.getDate() + daysLeft + 2);

    return {
      dailyBurn,
      daysLeft,
      funds: round2(funds),
      fromDate: formatDate(from),
      toDate: formatDate(to),
      /** true si el dinero no llega a fin de mes al ritmo actual. */
      depletesBeforeMonthEnd: daysLeft < this.daysInMonth - this.today.getDate(),
    };
  }

  /** Ingreso mensual neto estimado (del sueldo en la cuenta principal). */
  estimatedMonthlyIncome(): number {
    const principal = this.finance.accounts().find((a) => a.kind === 'debito');
    if (!principal) return 3000;
    const income = principal.transactions
      .filter((t) => t.type === 'ingreso' && this.inPeriod(t, 'current'))
      .reduce((s, t) => s + t.amount, 0);
    return income > 0 ? round2(income) : 3000;
  }

  /** Perfil de crédito de una tarjeta (o de la primera tarjeta disponible). */
  creditProfile(account: Account) {
    const card = account.kind === 'credito'
      ? account
      : this.finance.accounts().find((a) => a.kind === 'credito') ?? account;
    const limit = card.creditLimit ?? 0;
    const debt = card.balance;
    const available = round2(limit - debt);
    const usagePct = limit > 0 ? Math.round((debt / limit) * 100) : 0;
    const income = this.estimatedMonthlyIncome();
    const minPayment = round2(debt * 0.05); // cuota mínima típica ~5%
    // Capacidad prudente: 30% del ingreso menos las obligaciones actuales.
    const capacity = round2(Math.max(0, income * 0.3 - minPayment));
    const riskLevel: RiskLevel = usagePct >= 60 ? 'high' : usagePct >= 30 ? 'medium' : 'low';
    return { limit, debt: round2(debt), available, usagePct, income, minPayment, capacity, riskLevel };
  }

  /** Simula pedir un producto a crédito en `months` cuotas. */
  simulateCredit(account: Account, price: number, months = 12) {
    const p = this.creditProfile(account);
    const monthly = round2((price * 1.15) / months); // +15% aprox. por intereses/CTC
    const totalObligations = p.minPayment + monthly;
    const dti = p.income > 0 ? Math.round((totalObligations / p.income) * 100) : 100;
    const verdict: RiskLevel = dti >= 40 ? 'high' : dti >= 25 ? 'medium' : 'low';
    return { monthly, months, price: round2(price), dti, verdict, capacity: p.capacity };
  }

  /** Filtra movimientos según los parámetros que decidió el LLM. */
  filterMovements(account: Account, params: Record<string, unknown>): Transaction[] {
    const period = (params['period'] === 'previous' ? 'previous' : 'current') as Period;
    let list = account.transactions.filter((t) => this.inPeriod(t, period));

    // Por defecto mostramos gastos; si piden ingresos explícitamente, se ajusta.
    if (params['type'] === 'ingreso') list = list.filter((t) => t.type === 'ingreso');
    else list = list.filter((t) => t.type === 'gasto');

    const method = normalizeMethod(params['method']);
    if (method) list = list.filter((t) => t.method === method);

    const category = normalizeCategory(params['category']);
    if (category) list = list.filter((t) => t.category === category);

    if (params['antsOnly'] === true) list = list.filter((t) => this.isAnt(t));

    const merchant = typeof params['merchant'] === 'string' ? params['merchant'].toLowerCase() : '';
    if (merchant) list = list.filter((t) => t.merchant.toLowerCase().includes(merchant));

    const minAmount = toNum(params['minAmount']);
    if (minAmount != null) list = list.filter((t) => t.amount >= minAmount);

    list = list.sort((a, b) => b.date.getTime() - a.date.getTime());

    // "compra más grande" → solo la de mayor importe.
    if (params['largest'] === true) {
      const top = [...list].sort((a, b) => b.amount - a.amount)[0];
      list = top ? [top] : [];
    }
    return list;
  }

  // ─── Resumen compacto para el LLM (¡pocos tokens!) ─────────────────────────

  /**
   * Construye un resumen textual muy corto de la cuenta para dárselo a Gemini
   * Nano. NUNCA le pasamos la lista cruda de movimientos: solo cifras ya
   * calculadas. Así el modelo razona sobre lenguaje, no sobre aritmética.
   */
  buildContext(account: Account): string {
    const gasto = this.totalGasto(account, 'current');
    const cats = this.categoryBreakdown(account, 'current').slice(0, 4);
    const ant = this.antExpenses(account, 'current');
    const mom = this.monthOverMonth(account);
    const proj = this.projectDepletion(account);

    const lines = [
      `Cuenta: ${account.name} (${account.kind}). Saldo: ${CURRENCY}${account.balance}.`,
      `Gasto del mes: ${CURRENCY}${gasto} en ${this.gastos(account, 'current').length} movimientos.`,
      `Top categorías: ${cats.map((c) => `${c.label} ${CURRENCY}${c.total}`).join(', ')}.`,
      `Gastos hormiga: ${CURRENCY}${ant.total} (${ant.count} compras pequeñas), mes anterior ${CURRENCY}${mom.previous} (tendencia ${mom.direction === 'up' ? 'al alza' : mom.direction === 'down' ? 'a la baja' : 'estable'}).`,
      `Proyección: al ritmo actual el dinero disponible dura ~${proj.daysLeft} días.`,
    ];
    if (account.kind === 'credito') {
      const p = this.creditProfile(account);
      lines.push(`Crédito: deuda ${CURRENCY}${p.debt} de ${CURRENCY}${p.limit} (${p.usagePct}% usado).`);
    }
    return lines.join('\n');
  }

  // ─── Veredicto de gastos hormiga (fallback determinista) ───────────────────

  /**
   * Veredicto por umbrales cuando el LLM no está disponible o falla. Garantiza
   * que la tarjeta de gastos hormiga SIEMPRE tenga un estado coherente.
   */
  antVerdictFallback(account: Account): { status: 'good' | 'warning' | 'risk'; headline: string; message: string } {
    const ant = this.antExpenses(account, 'current');
    const total = this.totalGasto(account, 'current') || 1;
    const share = ant.total / total;
    const mom = this.monthOverMonth(account);
    const proj = this.projectDepletion(account);

    if ((mom.direction === 'up' && mom.deltaPct > 15 && share > 0.3) || proj.depletesBeforeMonthEnd) {
      return {
        status: 'risk',
        headline: 'Riesgo: tus gastos pequeños se están saliendo de control',
        message:
          'Si continúas así podrías quedarte sin dinero antes de finalizar el mes. Conviene frenar los consumos hormiga cuanto antes.',
      };
    }
    if (mom.direction === 'up' || share > 0.25) {
      return {
        status: 'warning',
        headline: 'Atención: estás aumentando tus gastos pequeños',
        message:
          'Los pequeños consumos diarios están creciendo. Un pequeño ajuste ahora evita un susto a fin de mes.',
      };
    }
    return {
      status: 'good',
      headline: 'Vas administrando bien tus gastos',
      message:
        'Tus gastos hormiga están bajo control y no comprometen tu saldo. ¡Buen trabajo, mantén el ritmo!',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAPEADOR MAESTRO: decisión del LLM (componente + params) → `data` real
  // ═══════════════════════════════════════════════════════════════════════════

  buildData(
    component: A2uiComponent,
    params: Record<string, unknown>,
    account: Account,
  ): Record<string, unknown> {
    switch (component) {
      case 'AppSpendingReport':
        return this.spendingReportData(account);
      case 'AppRecommendations':
        return this.recommendationsData(account);
      case 'AppSavingsPlan':
        return this.savingsPlanData(account, params);
      case 'AppCreditAdvisor':
        return this.creditAdvisorData(account, params);
      case 'AppMovementsTable':
        return this.movementsData(account, params);
      case 'AppAntExpense':
        return this.antData(account, this.antVerdictFallback(account));
      default:
        return {};
    }
  }

  // ─── Constructores de `data` por componente ────────────────────────────────

  /** Datos del hero de gastos hormiga (usado en el resumen y en el chat). */
  antData(
    account: Account,
    verdict: { status: string; headline: string; message: string },
    reductionPct = 0,
    interactive = false,
  ): Record<string, unknown> {
    const ant = this.antExpenses(account, 'current');
    const mom = this.monthOverMonth(account);
    const proj = this.projectDepletion(account, { antReductionPct: reductionPct });
    return {
      status: verdict.status,
      headline: verdict.headline,
      message: verdict.message,
      currency: CURRENCY,
      antTotal: ant.total,
      antCount: ant.count,
      momPrevTotal: mom.previous,
      momDeltaPct: mom.deltaPct,
      momDirection: mom.direction,
      byCategory: ant.byCategory,
      daysLeft: proj.daysLeft,
      depletionFrom: proj.fromDate,
      depletionTo: proj.toDate,
      reductionPct,
      interactive,
    };
  }

  private spendingReportData(account: Account): Record<string, unknown> {
    const total = this.totalGasto(account, 'current');
    const categories = this.categoryBreakdown(account, 'current');
    const mom = this.monthOverMonth(account);
    const gastos = this.gastos(account, 'current');
    const topMovements = [...gastos]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        date: formatDate(t.date),
        merchant: t.merchant,
        amount: t.amount,
        category: CATEGORY_META[t.category].label,
        icon: CATEGORY_META[t.category].icon,
      }));

    // Tendencia por semanas del mes (para el gráfico de área).
    const buckets = [0, 0, 0, 0, 0];
    for (const t of gastos) {
      const wk = Math.min(4, Math.floor((t.date.getDate() - 1) / 7));
      buckets[wk] += t.amount;
    }
    const trend = buckets
      .slice(0, Math.min(5, Math.ceil(this.today.getDate() / 7)))
      .map((v, i) => ({ label: `Sem ${i + 1}`, value: round2(v) }));

    return {
      title: `Reporte de gastos · ${account.name}`,
      currency: CURRENCY,
      total,
      txCount: gastos.length,
      categories,
      topCategory: categories[0]?.label ?? '—',
      topCategoryTotal: categories[0]?.total ?? 0,
      trend,
      topMovements,
      momDeltaPct: mom.deltaPct,
      momDirection: mom.direction,
      antTotal: this.antExpenses(account, 'current').total,
    };
  }

  private recommendationsData(account: Account): Record<string, unknown> {
    const ant = this.antExpenses(account, 'current');
    const cats = this.categoryBreakdown(account, 'current');
    const total = this.totalGasto(account, 'current') || 1;
    const income = this.estimatedMonthlyIncome();
    const subs = cats.find((c) => c.category === 'suscripciones');
    const tips: Array<Record<string, unknown>> = [];

    if (ant.total > 0) {
      tips.push({
        icon: 'local_cafe',
        title: 'Frena los gastos hormiga',
        detail: `Cafeterías, snacks y delivery suman ${CURRENCY}${ant.total} este mes. Recortar la mitad ya libera dinero.`,
        impact: round2(ant.total * 0.5),
      });
    }
    if (subs && subs.total > 0) {
      tips.push({
        icon: 'subscriptions',
        title: 'Revisa tus suscripciones',
        detail: `Pagas ${CURRENCY}${subs.total} en suscripciones. Cancela las que casi no uses.`,
        impact: round2(subs.total * 0.6),
      });
    }
    tips.push({
      icon: 'savings',
      title: 'Automatiza tu ahorro',
      detail: `Programa una transferencia del 10% de tu ingreso (${CURRENCY}${round2(income * 0.1)}) apenas te paguen.`,
      impact: round2(income * 0.1),
    });

    const share = ant.total / total;
    const riskLevel: RiskLevel = share > 0.3 ? 'high' : share > 0.18 ? 'medium' : 'low';
    const alerts: Array<Record<string, unknown>> = [];
    const proj = this.projectDepletion(account);
    if (proj.depletesBeforeMonthEnd && account.kind !== 'credito') {
      alerts.push({
        icon: 'error',
        text: `Al ritmo actual tu saldo podría agotarse hacia el ${proj.fromDate}.`,
      });
    }

    return {
      title: 'Recomendaciones para ti',
      currency: CURRENCY,
      riskLevel,
      tips,
      alerts,
      potentialTotal: round2(tips.reduce((s, t) => s + (t['impact'] as number), 0)),
    };
  }

  private savingsPlanData(account: Account, params: Record<string, unknown>): Record<string, unknown> {
    const income = this.estimatedMonthlyIncome();
    const ahorros = this.finance.accounts().find((a) => a.kind === 'ahorros');
    const current = ahorros ? ahorros.balance : account.balance;
    const goalName = typeof params['goalName'] === 'string' ? params['goalName'] : 'Fondo de emergencia';
    const target = toNum(params['goalTarget']) ?? round2(income * 3);
    const pct = clamp(Math.round((current / target) * 100), 0, 100);
    // Ahorro mensual potencial: la mitad de los gastos hormiga.
    const ant = this.antExpenses(account, 'current').total;
    const monthlyPotential = round2(Math.max(ant * 0.5, income * 0.1));

    const projection = [1, 2, 3].map((m) => ({
      label: `+${m} mes${m > 1 ? 'es' : ''}`,
      amount: round2(current + monthlyPotential * m),
    }));

    return {
      title: 'Tu plan de ahorro',
      currency: CURRENCY,
      goalName,
      goalTarget: target,
      goalCurrent: round2(current),
      pct,
      monthlyPotential,
      projection,
      months: Math.max(0, Math.ceil((target - current) / (monthlyPotential || 1))),
    };
  }

  private creditAdvisorData(account: Account, params: Record<string, unknown>): Record<string, unknown> {
    const p = this.creditProfile(account);
    const price = toNum(params['price']);
    const months = toNum(params['months']) ?? 12;
    const product = typeof params['product'] === 'string' ? params['product'] : undefined;

    const base: Record<string, unknown> = {
      title: 'Asesor de crédito',
      currency: CURRENCY,
      limit: p.limit,
      debt: p.debt,
      available: p.available,
      usagePct: p.usagePct,
      capacity: p.capacity,
      minPayment: p.minPayment,
      income: p.income,
      riskLevel: p.riskLevel,
    };

    if (price != null) {
      const sim = this.simulateCredit(account, price, months);
      base['product'] = product ?? 'la compra';
      base['price'] = sim.price;
      base['months'] = sim.months;
      base['monthlyPayment'] = sim.monthly;
      base['dti'] = sim.dti;
      base['verdict'] = sim.verdict;
      base['recommendation'] =
        sim.verdict === 'high'
          ? `Comprometería el ${sim.dti}% de tu ingreso mensual. No es un buen momento; mejor espera o busca un plazo más largo.`
          : sim.verdict === 'medium'
            ? `Es asumible (${sim.dti}% de tu ingreso), pero ajustado. Hazlo solo si recortas otros gastos.`
            : `Tienes holgura: la cuota sería el ${sim.dti}% de tu ingreso. Puedes asumirlo con comodidad.`;
    } else {
      base['recommendation'] =
        p.riskLevel === 'high'
          ? 'Tu uso de crédito es alto. Prioriza reducir la deuda antes de asumir nuevas cuotas.'
          : p.riskLevel === 'medium'
            ? 'Tu uso de crédito es moderado. Tienes cierta capacidad, pero mantén el control.'
            : `Tu crédito está sano. Podrías asumir una cuota de hasta ${CURRENCY}${p.capacity} al mes.`;
    }
    return base;
  }

  private movementsData(account: Account, params: Record<string, unknown>): Record<string, unknown> {
    const rows = this.filterMovements(account, params).map((t) => ({
      date: formatDate(t.date),
      merchant: t.merchant,
      category: CATEGORY_META[t.category].label,
      icon: CATEGORY_META[t.category].icon,
      amount: t.amount,
      method: t.method,
      methodLabel: PAYMENT_METHOD_META[t.method].label,
      methodIcon: PAYMENT_METHOD_META[t.method].icon,
    }));
    const total = round2(rows.reduce((s, r) => s + (r.amount as number), 0));
    return {
      title: 'Movimientos',
      currency: CURRENCY,
      filterLabel: describeFilter(params),
      rows,
      total,
      count: rows.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Utilidades puras
// ═══════════════════════════════════════════════════════════════════════════

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

/** Formatea una fecha como "18 de septiembre" (locale español). */
function formatDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** Normaliza un método de pago venido del LLM (tolerante a mayúsculas/sinónimos). */
function normalizeMethod(v: unknown): PaymentMethod | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase().trim();
  const known: PaymentMethod[] = ['yape', 'plin', 'debito', 'credito', 'efectivo', 'transferencia'];
  return (known as string[]).includes(s) ? (s as PaymentMethod) : null;
}

/** Normaliza una categoría venida del LLM. */
function normalizeCategory(v: unknown): Category | null {
  if (typeof v !== 'string') return null;
  const s = v.toLowerCase().trim();
  const known: Category[] = [
    'cafeteria', 'snacks', 'comida_rapida', 'conveniencia', 'transporte', 'suscripciones',
    'restaurantes', 'supermercado', 'servicios', 'ocio', 'salud', 'compras', 'ingreso',
  ];
  if ((known as string[]).includes(s)) return s as Category;
  // Sinónimos frecuentes.
  if (s.includes('comida') || s.includes('restaur')) return 'restaurantes';
  if (s.includes('café') || s.includes('cafe')) return 'cafeteria';
  if (s.includes('super')) return 'supermercado';
  return null;
}

/** Etiqueta legible del filtro activo, a partir de los params del LLM. */
function describeFilter(params: Record<string, unknown>): string {
  const parts: string[] = [];
  if (params['largest'] === true) parts.push('Compra más grande');
  const method = normalizeMethod(params['method']);
  if (method) parts.push(`Pagos con ${PAYMENT_METHOD_META[method].label}`);
  const category = normalizeCategory(params['category']);
  if (category) parts.push(CATEGORY_META[category].label);
  if (params['antsOnly'] === true) parts.push('Solo gastos hormiga');
  if (typeof params['merchant'] === 'string' && params['merchant']) parts.push(`"${params['merchant']}"`);
  if (params['period'] === 'previous') parts.push('Mes anterior');
  return parts.length ? parts.join(' · ') : 'Todos los movimientos del mes';
}
