/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  MODELO DE DOMINIO FINANCIERO                                          ║
 * ║                                                                       ║
 * ║  Tipos ficticios pero realistas para un asistente bancario. Toda la   ║
 * ║  MATEMÁTICA del dinero se hace en TypeScript sobre estos tipos: el    ║
 * ║  LLM (Gemini Nano) nunca calcula importes, solo interpreta lenguaje.  ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/** Método de pago. Yape/Plin son billeteras móviles muy usadas en Perú. */
export type PaymentMethod =
  | 'yape'
  | 'plin'
  | 'debito'
  | 'credito'
  | 'efectivo'
  | 'transferencia';

/** Un movimiento es un gasto (sale dinero) o un ingreso (entra dinero). */
export type TransactionType = 'gasto' | 'ingreso';

/** Categorías de gasto/ingreso. El flag `esHormiga` marca las candidatas a "gasto hormiga". */
export type Category =
  | 'cafeteria'
  | 'snacks'
  | 'comida_rapida'
  | 'conveniencia'
  | 'transporte'
  | 'suscripciones'
  | 'restaurantes'
  | 'supermercado'
  | 'servicios'
  | 'ocio'
  | 'salud'
  | 'compras'
  | 'ingreso';

/** Tipo de cuenta. */
export type AccountKind = 'debito' | 'ahorros' | 'credito';

/** Metadatos de presentación de una categoría. */
export interface CategoryMeta {
  /** Etiqueta legible para la UI. */
  readonly label: string;
  /** Nombre del Material Icon (familia clásica rellena). */
  readonly icon: string;
  /** true si es una categoría típica de "gasto hormiga" (consumo pequeño y frecuente). */
  readonly esHormiga: boolean;
}

/** Metadatos de presentación de un método de pago. */
export interface PaymentMethodMeta {
  readonly label: string;
  readonly icon: string;
}

/** Un movimiento bancario. */
export interface Transaction {
  readonly id: string;
  /** Fecha real del movimiento (relativa a hoy para que las proyecciones tengan sentido). */
  readonly date: Date;
  /** Comercio o descripción. */
  readonly merchant: string;
  readonly category: Category;
  /** Importe SIEMPRE positivo; el signo lo determina `type`. */
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly type: TransactionType;
}

/** Una cuenta bancaria del usuario. */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly kind: AccountKind;
  /**
   * Para débito/ahorros: dinero disponible.
   * Para crédito: deuda pendiente (lo usado de la línea).
   */
  readonly balance: number;
  /** Solo para tarjetas de crédito: límite total de la línea. */
  readonly creditLimit?: number;
  readonly transactions: Transaction[];
}

/** Moneda usada en toda la demo. */
export const CURRENCY = '$';

/** Diccionario de metadatos por categoría. Fuente única de verdad para iconos/etiquetas. */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  cafeteria: { label: 'Cafeterías', icon: 'local_cafe', esHormiga: true },
  snacks: { label: 'Snacks', icon: 'icecream', esHormiga: true },
  comida_rapida: { label: 'Comida rápida', icon: 'lunch_dining', esHormiga: true },
  conveniencia: { label: 'Tiendas de conveniencia', icon: 'storefront', esHormiga: true },
  transporte: { label: 'Transporte', icon: 'directions_bus', esHormiga: true },
  suscripciones: { label: 'Suscripciones', icon: 'subscriptions', esHormiga: true },
  restaurantes: { label: 'Restaurantes', icon: 'restaurant', esHormiga: false },
  supermercado: { label: 'Supermercado', icon: 'shopping_cart', esHormiga: false },
  servicios: { label: 'Servicios', icon: 'receipt_long', esHormiga: false },
  ocio: { label: 'Ocio', icon: 'sports_esports', esHormiga: false },
  salud: { label: 'Salud', icon: 'local_pharmacy', esHormiga: false },
  compras: { label: 'Compras', icon: 'shopping_bag', esHormiga: false },
  ingreso: { label: 'Ingreso', icon: 'payments', esHormiga: false },
};

/** Diccionario de metadatos por método de pago. */
export const PAYMENT_METHOD_META: Record<PaymentMethod, PaymentMethodMeta> = {
  yape: { label: 'Yape', icon: 'qr_code_2' },
  plin: { label: 'Plin', icon: 'qr_code_scanner' },
  debito: { label: 'Débito', icon: 'account_balance_wallet' },
  credito: { label: 'Crédito', icon: 'credit_card' },
  efectivo: { label: 'Efectivo', icon: 'payments' },
  transferencia: { label: 'Transferencia', icon: 'swap_horiz' },
};

/** Icono representativo por tipo de cuenta (para el sidebar). */
export const ACCOUNT_ICON: Record<AccountKind, string> = {
  debito: 'account_balance',
  ahorros: 'savings',
  credito: 'credit_card',
};

// ─────────────────────────────────────────────────────────────────────────────
//  🐜 Gastos hormiga
// ─────────────────────────────────────────────────────────────────────────────

/** Estados posibles del veredicto de gastos hormiga. */
export type AntStatus = 'good' | 'warning' | 'risk';

/**
 * Veredicto estructurado sobre los gastos hormiga: cambia el color y el mensaje
 * del hero. Lo calcula TypeScript por umbrales en `antVerdictFallback()`
 * (`services/finance-analytics.ts`), sin depender del modelo — así la demo
 * muestra el estado correcto al instante, esté Gemini Nano listo o no.
 */
export interface AntVerdict {
  status: AntStatus;
  headline: string;
  message: string;
}
