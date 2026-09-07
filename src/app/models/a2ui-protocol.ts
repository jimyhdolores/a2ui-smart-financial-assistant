/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROTOCOLO A2UI v0.9 — constantes y descriptores del dominio "finance" ║
 * ║                                                                       ║
 * ║  ⚠️  Este SÍ es el protocolo A2UI, y solo lo usa el nivel Avanzado.     ║
 * ║  A diferencia de `ui-router.model.ts` (el contrato casero del          ║
 * ║  ENRUTADOR de Nano: qué componentes + params, común a Intermedio y     ║
 * ║  Avanzado), este archivo describe el PROTOCOLO real                     ║
 * ║  a2ui.org v0.9 que TypeScript emite hacia el renderer oficial:         ║
 * ║  ids de superficie/catálogo, el root del data-model, los nombres de    ║
 * ║  las `action.event`, y — clave — el mapa `COMPONENT_FIELDS` con los     ║
 * ║  campos que cada componente bindea por JSON Pointer (`/data/<campo>`).  ║
 * ║                                                                       ║
 * ║  Los nombres de campo coinciden 1:1 con las claves que emiten los      ║
 * ║  builders `*Data()` de `finance-analytics.ts`: así el message-builder  ║
 * ║  puede generar los `{ path: "/data/<campo>" }` sin duplicar literales.  ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
import type { A2uiMessage } from '@a2ui/web_core/v0_9';
import type { UiComponent } from './ui-router.model';

/** Re-export del tipo del envelope A2UI (createSurface/updateComponents/…). */
export type { A2uiMessage };

/** Id del catálogo custom de finanzas (debe casar con `FinanceCatalog`). */
export const FINANCE_CATALOG_ID =
  'https://a2ui-smart-financial-assistant/catalogs/finance/v0_9';

/** Raíz del data-model donde vive el `data` calculado por TypeScript. */
export const DATA_ROOT = '/data';

/**
 * Cada turno del chat abre su PROPIA superficie (id único) para preservar el
 * historial: los mensajes anteriores conservan su render sin ser pisados.
 *
 * Cuando un turno COMPONE varias secciones, cada una recibe su propia superficie
 * apilada (`finance-<turno>-<i>`) para que su round-trip (slider/filtros) sea
 * independiente. Sin `section`, mantiene el id clásico `finance-<turno>`.
 */
export function makeSurfaceId(turn: number, section?: number): string {
  return section == null ? `finance-${turn}` : `finance-${turn}-${section}`;
}

/** Nombres de las `action.event` del round-trip agéntico (TS recalcula). */
export const A2UI_ACTIONS = {
  /** Slider "¿y si recorto X%?" del hero de gastos hormiga. */
  simulateReduction: 'simulateReduction',
  /** Chips de filtro rápido de la tabla de movimientos. */
  filterMovements: 'filterMovements',
} as const;

export type A2uiActionName = (typeof A2UI_ACTIONS)[keyof typeof A2UI_ACTIONS];

/**
 * Campos que cada componente bindea por JSON Pointer contra `/data`.
 * Coinciden con las claves de los builders `*Data()` de `finance-analytics.ts`.
 * (Los campos condicionales de crédito se listan siempre: si el data-model no
 * los trae, la prop resuelve a `undefined` y el componente aplica su fallback.)
 */
export const COMPONENT_FIELDS: Record<UiComponent, readonly string[]> = {
  AppQuickStats: ['currency', 'items'],
  AppAntExpense: [
    'status',
    'headline',
    'message',
    'currency',
    'antTotal',
    'antCount',
    'momPrevTotal',
    'momDeltaPct',
    'momDirection',
    'byCategory',
    'daysLeft',
    'depletionFrom',
    'depletionTo',
    'reductionPct',
    'interactive',
  ],
  AppSpendingReport: [
    'title',
    'currency',
    'total',
    'txCount',
    'categories',
    'topCategory',
    'topCategoryTotal',
    'trend',
    'topMovements',
    'momDeltaPct',
    'momDirection',
    'antTotal',
  ],
  AppRecommendations: [
    'title',
    'currency',
    'riskLevel',
    'tips',
    'alerts',
    'potentialTotal',
  ],
  AppSavingsPlan: [
    'title',
    'currency',
    'goalName',
    'goalTarget',
    'goalCurrent',
    'pct',
    'monthlyPotential',
    'projection',
    'months',
  ],
  AppCreditAdvisor: [
    'title',
    'currency',
    'limit',
    'debt',
    'available',
    'usagePct',
    'capacity',
    'minPayment',
    'income',
    'riskLevel',
    'recommendation',
    // Condicionales (solo si el usuario preguntó por una compra):
    'product',
    'price',
    'months',
    'monthlyPayment',
    'dti',
    'verdict',
  ],
  AppMovementsTable: [
    'title',
    'currency',
    'filterLabel',
    'rows',
    'total',
    'count',
  ],
};
