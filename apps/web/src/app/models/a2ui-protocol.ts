/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  PROTOCOLO A2UI v1.0 — constantes y descriptores del dominio "finance" ║
 * ║                                                                       ║
 * ║  Este SÍ es el protocolo A2UI, y solo lo usa el nivel Avanzado.       ║
 * ║  A diferencia de `ui-router.model.ts` (el contrato casero del          ║
 * ║  ENRUTADOR de Nano: qué componentes + params, común a Intermedio y     ║
 * ║  Avanzado), este archivo describe el PROTOCOLO real                     ║
 * ║  a2ui.org v1.0 que TypeScript emite hacia el renderer oficial:         ║
 * ║  ids de superficie/catálogo, el root del data-model, los nombres de    ║
 * ║  las `action.event`, y — clave — el mapa `COMPONENT_FIELDS` con los     ║
 * ║  campos que cada componente bindea por JSON Pointer (`/data/<campo>`).  ║
 * ║                                                                       ║
 * ║  Los nombres de campo coinciden 1:1 con las claves que emiten los      ║
 * ║  builders `*Data()` de `finance-analytics.ts`: así el message-builder  ║
 * ║  puede generar los `{ "@path": "/data/<campo>" }` sin duplicar literales.║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
import type { AgentToRendererMessage } from '@a2ui/web_core/v1_0';
import financeCatalogDocument from '@fintech-nano/a2ui-catalog/finance-catalog.v1.json';
import type { UiComponent } from './ui-router.model';

/** Un mensaje A2UI v1.0 del agente al renderer (createSurface/updateComponents/…). */
export type A2uiMessage = AgentToRendererMessage;

/** Versión del protocolo que hablan el builder y el renderer. */
export const A2UI_VERSION = '1.0';

/** Tipo de medio de un documento A2UI (estandarizado en v0.9.1; el de v0.8 era application/json+a2ui). */
export const A2UI_MIME_TYPE = 'application/a2ui+json';

/** Id del catálogo custom de finanzas: lo dicta el propio documento del catálogo. */
export const FINANCE_CATALOG_ID: string = financeCatalogDocument.catalogId;

/** Id del catálogo básico oficial v1.0 (las piezas de maquetación que usa el agente del servidor). */
export const BASIC_CATALOG_ID = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

/**
 * Piezas del catálogo básico que este navegador ACEPTA (lista blanca). El agente
 * del servidor puede componer la pantalla con ellas; cualquier otra no se pinta.
 */
export const BASIC_COMPONENTS_ALLOWED = ['Text', 'Row', 'Column', 'Card', 'Button', 'Divider', 'Icon'];

/** Acción de los botones "siguiente pregunta" que compone el agente del servidor. */
export const FOLLOW_UP_ACTION = 'followUp';

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
