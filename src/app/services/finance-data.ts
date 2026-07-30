import { Injectable, computed, signal } from '@angular/core';
import {
  Account,
  Category,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../models/finance.model';

/**
 * Semilla compacta de un movimiento:
 * [día, período, comercio, categoría, importe, método, tipo?]
 * - período 'cur' = mes actual (se descarta si el día aún no ha llegado).
 * - período 'prev' = mes anterior (día ≤ 28 para evitar desbordes de calendario).
 */
type TxSeed = [
  day: number,
  period: 'cur' | 'prev',
  merchant: string,
  category: Category,
  amount: number,
  method: PaymentMethod,
  type?: TransactionType,
];

/** Cuántos meses de historial generar hacia atrás (además del actual y el anterior). */
const HISTORY_MONTHS = 5; // → offsets 2..5 = 4 meses extra (6 en total con actual + anterior)

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceDataService — DATOS FICTICIOS (fuente de la verdad)            ║
 * ║                                                                       ║
 * ║  Tres cuentas con movimientos variados del mes actual y el anterior.  ║
 * ║  Las fechas se anclan a `new Date()` para que las proyecciones de     ║
 * ║  saldo tengan sentido el día de la demo. Los importes son fijos       ║
 * ║  (deterministas) para que la charla sea 100% reproducible.            ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class FinanceDataService {
  /** "Hoy" congelado al construir el servicio (una sola lectura del reloj). */
  private readonly today = new Date();

  /** Todas las cuentas del usuario. */
  readonly accounts = signal<Account[]>(this.buildAccounts());

  /** Cuenta seleccionada en el sidebar. */
  readonly selectedAccountId = signal<string>(this.accounts()[0].id);

  /** Cuenta seleccionada (objeto completo, derivado). */
  readonly selectedAccount = computed<Account>(
    () =>
      this.accounts().find((a) => a.id === this.selectedAccountId()) ??
      this.accounts()[0],
  );

  /** Cambia la cuenta activa. */
  select(id: string): void {
    this.selectedAccountId.set(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Construcción del dataset
  // ─────────────────────────────────────────────────────────────────────────

  private buildAccounts(): Account[] {
    return [
      {
        id: 'debito-principal',
        name: 'Cuenta Débito Principal',
        kind: 'debito',
        balance: 1180.45,
        transactions: this.materialize('debito-principal', PRINCIPAL_SEEDS),
      },
      {
        id: 'debito-ahorros',
        name: 'Cuenta Débito Ahorros',
        kind: 'ahorros',
        balance: 8450.0,
        transactions: this.materialize('debito-ahorros', AHORROS_SEEDS),
      },
      {
        id: 'tarjeta-credito',
        name: 'Tarjeta de Crédito',
        kind: 'credito',
        balance: 2340.6, // deuda pendiente
        creditLimit: 4000,
        transactions: this.materialize('tarjeta-credito', CREDITO_SEEDS),
      },
    ];
  }

  /** Convierte las semillas en movimientos con fechas reales, descartando días futuros. */
  private materialize(accId: string, seeds: TxSeed[]): Transaction[] {
    const out: Transaction[] = [];
    seeds.forEach(([day, period, merchant, category, amount, method, type], i) => {
      const date = period === 'cur' ? this.curDate(day) : this.prevDate(day);
      if (!date) return; // día del mes actual que aún no ha ocurrido
      out.push({
        id: `${accId}-${i}`,
        date,
        merchant,
        category,
        amount,
        method,
        type: type ?? 'gasto',
      });
    });
    // Historial más antiguo (meses 2..N), generado de forma DETERMINISTA a partir
    // de los mismos comercios de la cuenta → navegable pero reproducible en la demo.
    out.push(...this.generateHistory(accId, seeds));
    // Orden descendente por fecha (lo más reciente primero).
    return out.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /** Fecha en el mes actual; null si el día todavía no ha llegado (no colocamos futuro). */
  private curDate(day: number): Date | null {
    const t = this.today;
    if (day > t.getDate()) return null;
    return new Date(t.getFullYear(), t.getMonth(), day, 12, 0, 0);
  }

  /** Fecha en el mes anterior (día ≤ 28 por seguridad de calendario). */
  private prevDate(day: number): Date {
    const t = this.today;
    return new Date(t.getFullYear(), t.getMonth() - 1, Math.min(day, 28), 12, 0, 0);
  }

  /** Fecha `monthsAgo` meses atrás (día ≤ 28 por seguridad de calendario). */
  private monthDate(day: number, monthsAgo: number): Date {
    const t = this.today;
    return new Date(t.getFullYear(), t.getMonth() - monthsAgo, Math.min(day, 28), 12, 0, 0);
  }

  /**
   * Genera movimientos de meses anteriores (offsets 2..HISTORY_MONTHS) reutilizando
   * el "perfil de comercios" de la propia cuenta (mismos nombres, categorías, métodos
   * y rangos de importe). Usa un PRNG con semilla fija por cuenta+mes, de modo que el
   * historial es variado pero SIEMPRE el mismo entre recargas (demo reproducible).
   * NO afecta los cálculos de mes-a-mes ni de proyección, que solo miran el mes
   * actual y el anterior.
   */
  private generateHistory(accId: string, seeds: TxSeed[]): Transaction[] {
    const pool = derivePool(seeds);
    const income = pool.filter((p) => p.type === 'ingreso');
    const spend = pool.filter((p) => p.type !== 'ingreso');
    if (!spend.length) return [];

    const out: Transaction[] = [];
    for (let ago = 2; ago <= HISTORY_MONTHS; ago++) {
      const rng = mulberry32(hashString(`${accId}:${ago}`));

      // Ingresos recurrentes a inicio de mes (sueldo, ahorro programado, etc.).
      income.forEach((p, k) => {
        out.push({
          id: `${accId}-h${ago}-in${k}`,
          date: this.monthDate(2 + k, ago),
          merchant: p.merchant,
          category: p.category,
          amount: p.max,
          method: p.method,
          type: 'ingreso',
        });
      });

      // Gastos variados del mes.
      const count = 10 + Math.floor(rng() * 8); // 10–17 movimientos
      for (let i = 0; i < count; i++) {
        const p = spend[Math.floor(rng() * spend.length)];
        const amount = round2(p.min + rng() * (p.max - p.min));
        out.push({
          id: `${accId}-h${ago}-${i}`,
          date: this.monthDate(1 + Math.floor(rng() * 28), ago),
          merchant: p.merchant,
          category: p.category,
          amount,
          method: p.method,
          type: 'gasto',
        });
      }
    }
    return out;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Utilidades para generar historial determinista
// ═══════════════════════════════════════════════════════════════════════════

/** Perfil de un comercio observado en las semillas (para reproducir su gasto). */
interface MerchantProfile {
  merchant: string;
  category: Category;
  method: PaymentMethod;
  type: TransactionType;
  min: number;
  max: number;
}

/** Extrae los comercios únicos de las semillas con su rango de importe observado. */
function derivePool(seeds: TxSeed[]): MerchantProfile[] {
  const map = new Map<string, MerchantProfile>();
  for (const [, , merchant, category, amount, method, type] of seeds) {
    const cur = map.get(merchant);
    if (cur) {
      cur.min = Math.min(cur.min, amount);
      cur.max = Math.max(cur.max, amount);
    } else {
      map.set(merchant, { merchant, category, method, type: type ?? 'gasto', min: amount, max: amount });
    }
  }
  return [...map.values()];
}

/** PRNG determinista (mulberry32): misma semilla → misma secuencia. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de una cadena → semilla entera para el PRNG. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
//  SEMILLAS DE MOVIMIENTOS (ficticias, variadas, con abundantes gastos hormiga)
// ═══════════════════════════════════════════════════════════════════════════

/** Débito Principal: mucho consumo diario → gastos hormiga en aumento. */
const PRINCIPAL_SEEDS: TxSeed[] = [
  // ── Mes actual ──────────────────────────────────────────────────────────
  [1, 'cur', 'Sueldo mensual', 'ingreso', 3200, 'transferencia', 'ingreso'],
  [2, 'cur', 'Supermercado Metro', 'supermercado', 128.4, 'debito'],
  [2, 'cur', 'Café Altomayo', 'cafeteria', 6.5, 'yape'],
  [3, 'cur', 'Tambo+', 'conveniencia', 8.9, 'yape'],
  [3, 'cur', 'Combi Línea 20', 'transporte', 2.5, 'efectivo'],
  [4, 'cur', 'Starbucks', 'cafeteria', 14.8, 'debito'],
  [5, 'cur', 'KFC', 'comida_rapida', 22.9, 'debito'],
  [5, 'cur', 'Quiosco snacks', 'snacks', 3.2, 'efectivo'],
  [6, 'cur', 'Netflix', 'suscripciones', 12.99, 'debito'],
  [6, 'cur', 'Yape almuerzo', 'comida_rapida', 12.0, 'yape'],
  [7, 'cur', 'Spotify', 'suscripciones', 6.99, 'debito'],
  [7, 'cur', 'Rappi', 'comida_rapida', 18.5, 'yape'],
  [8, 'cur', 'Juan Valdez', 'cafeteria', 9.2, 'yape'],
  [9, 'cur', 'Plaza Vea', 'supermercado', 64.3, 'debito'],
  [10, 'cur', 'Bembos', 'comida_rapida', 16.4, 'debito'],
  [11, 'cur', 'Tambo+', 'conveniencia', 5.6, 'plin'],
  [12, 'cur', 'Cineplanet', 'ocio', 24.0, 'debito'],
  [12, 'cur', 'Canchita y gaseosa', 'snacks', 8.0, 'efectivo'],
  [13, 'cur', 'Café de paso', 'cafeteria', 7.3, 'yape'],
  [14, 'cur', 'Taxi app', 'transporte', 12.0, 'yape'],
  [15, 'cur', 'InkaFarma', 'salud', 19.9, 'debito'],
  [16, 'cur', 'Café de paso', 'cafeteria', 6.8, 'yape'],
  [17, 'cur', 'Oechsle', 'compras', 89.9, 'debito'],
  [18, 'cur', "McDonald's", 'comida_rapida', 15.7, 'plin'],
  [19, 'cur', 'Tambo+', 'conveniencia', 7.4, 'yape'],
  [20, 'cur', 'Restaurante La Lucha', 'restaurantes', 34.5, 'debito'],
  [21, 'cur', 'Café de paso', 'cafeteria', 6.5, 'yape'],
  [22, 'cur', 'Quiosco snacks', 'snacks', 4.2, 'efectivo'],
  [23, 'cur', 'Recibo de luz', 'servicios', 58.0, 'debito'],
  [24, 'cur', 'Combi Línea 20', 'transporte', 2.5, 'efectivo'],
  [25, 'cur', 'Café de paso', 'cafeteria', 8.1, 'yape'],
  [26, 'cur', 'Rappi', 'comida_rapida', 21.3, 'yape'],
  [27, 'cur', 'Tambo+', 'conveniencia', 6.7, 'plin'],
  [28, 'cur', 'Quiosco snacks', 'snacks', 3.8, 'efectivo'],
  // ── Mes anterior (menos gasto hormiga → sirve para comparar) ─────────────
  [1, 'prev', 'Sueldo mensual', 'ingreso', 3200, 'transferencia', 'ingreso'],
  [3, 'prev', 'Supermercado Metro', 'supermercado', 141.2, 'debito'],
  [4, 'prev', 'Café Altomayo', 'cafeteria', 9.1, 'yape'],
  [5, 'prev', 'Café de paso', 'cafeteria', 8.0, 'yape'],
  [6, 'prev', 'KFC', 'comida_rapida', 19.5, 'debito'],
  [7, 'prev', 'Rappi', 'comida_rapida', 22.3, 'yape'],
  [8, 'prev', 'Tambo+', 'conveniencia', 6.2, 'yape'],
  [10, 'prev', 'Netflix', 'suscripciones', 12.99, 'debito'],
  [10, 'prev', 'Spotify', 'suscripciones', 6.99, 'debito'],
  [11, 'prev', 'Tambo+', 'conveniencia', 7.8, 'plin'],
  [12, 'prev', 'Café de paso', 'cafeteria', 7.5, 'yape'],
  [14, 'prev', 'Rappi', 'comida_rapida', 17.8, 'yape'],
  [15, 'prev', 'Restaurante La Lucha', 'restaurantes', 42.0, 'debito'],
  [16, 'prev', 'Plaza Vea', 'supermercado', 72.1, 'debito'],
  [18, 'prev', 'Café de paso', 'cafeteria', 6.8, 'yape'],
  [19, 'prev', 'Quiosco snacks', 'snacks', 4.5, 'efectivo'],
  [20, 'prev', 'Bembos', 'comida_rapida', 15.2, 'debito'],
  [21, 'prev', 'Taxi app', 'transporte', 11.0, 'yape'],
  [22, 'prev', 'Café de paso', 'cafeteria', 7.2, 'yape'],
  [23, 'prev', 'Quiosco snacks', 'snacks', 5.2, 'efectivo'],
  [24, 'prev', 'Tambo+', 'conveniencia', 5.9, 'plin'],
  [25, 'prev', 'Recibo de luz', 'servicios', 55.0, 'debito'],
  [26, 'prev', "McDonald's", 'comida_rapida', 18.9, 'plin'],
  [27, 'prev', 'Quiosco snacks', 'snacks', 3.9, 'efectivo'],
  [28, 'prev', 'Café de paso', 'cafeteria', 6.6, 'yape'],
];

/** Débito Ahorros: pocos movimientos, casi sin gastos hormiga → cuenta "sana". */
const AHORROS_SEEDS: TxSeed[] = [
  [2, 'cur', 'Ahorro programado', 'ingreso', 600, 'transferencia', 'ingreso'],
  [5, 'cur', 'Rendimiento cuenta', 'ingreso', 12.3, 'transferencia', 'ingreso'],
  [10, 'cur', 'Café de paso', 'cafeteria', 6.5, 'yape'],
  [18, 'cur', 'Traspaso a principal', 'compras', 200.0, 'transferencia'],
  [20, 'cur', 'Cena familiar', 'restaurantes', 58.0, 'debito'],
  [2, 'prev', 'Ahorro programado', 'ingreso', 600, 'transferencia', 'ingreso'],
  [15, 'prev', 'Café de paso', 'cafeteria', 7.0, 'yape'],
  [22, 'prev', 'Compra electrodoméstico', 'compras', 120.0, 'debito'],
];

/** Tarjeta de Crédito: compras variadas, algunas grandes → alimenta el asesor de crédito. */
const CREDITO_SEEDS: TxSeed[] = [
  [1, 'cur', 'Pago de tarjeta', 'ingreso', 500, 'transferencia', 'ingreso'],
  [3, 'cur', 'Restaurante Central', 'restaurantes', 46.0, 'credito'],
  [5, 'cur', 'iCloud+', 'suscripciones', 2.99, 'credito'],
  [6, 'cur', 'Amazon', 'compras', 132.5, 'credito'],
  [8, 'cur', 'Popeyes', 'comida_rapida', 18.0, 'credito'],
  [10, 'cur', 'Grifo Primax', 'transporte', 45.0, 'credito'],
  [12, 'cur', 'Netflix', 'suscripciones', 12.99, 'credito'],
  [14, 'cur', 'Zara', 'compras', 210.0, 'credito'],
  [16, 'cur', 'Starbucks', 'cafeteria', 7.5, 'credito'],
  [18, 'cur', 'Restaurante La Mar', 'restaurantes', 52.3, 'credito'],
  [20, 'cur', 'Farmacia', 'salud', 28.4, 'credito'],
  [22, 'cur', 'Smart Fit (gym)', 'suscripciones', 39.9, 'credito'],
  [24, 'cur', 'Popeyes', 'comida_rapida', 16.8, 'credito'],
  [26, 'cur', 'Audífonos Sony', 'compras', 180.0, 'credito'],
  [2, 'prev', 'Pago de tarjeta', 'ingreso', 450, 'transferencia', 'ingreso'],
  [6, 'prev', 'Amazon', 'compras', 98.0, 'credito'],
  [12, 'prev', 'Netflix', 'suscripciones', 12.99, 'credito'],
  [15, 'prev', 'Restaurante Central', 'restaurantes', 61.0, 'credito'],
  [20, 'prev', 'Ripley', 'compras', 145.0, 'credito'],
  [25, 'prev', 'Grifo Primax', 'transporte', 40.0, 'credito'],
];
