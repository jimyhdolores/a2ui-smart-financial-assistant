import { CURRENCY } from '../../models/finance.model';

/**
 * Regla del proyecto: ningún número se muestra con más de 4 decimales.
 * Los montos van siempre con 2, igual que el pipe `number: '1.2-2'` de las plantillas.
 */
export const MAX_DECIMALS = 4;

/** Redondea a `decimals` decimales (por defecto, el máximo del proyecto). */
export function roundTo(n: number, decimals = MAX_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// Mismo locale que el pipe `number` de Angular (la app no define LOCALE_ID → en-US).
const MONEY = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Monto listo para mostrar fuera de una plantilla (p. ej. en ApexCharts): `$1,234.56`.
 * Evita que una suma en coma flotante (555.6800000000001) llegue a la pantalla.
 */
export function formatMoney(n: number): string {
  return `${CURRENCY}${MONEY.format(n)}`;
}
