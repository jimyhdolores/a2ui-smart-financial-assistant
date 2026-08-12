/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  CONTRATO A2UI  (Agente ↔ Interfaz)                                    ║
 * ║                                                                       ║
 * ║  El "lenguaje" compartido entre el LLM local (Gemini Nano) y Angular. ║
 * ║  El modelo NO calcula dinero ni redacta la UI: interpreta la INTENCIÓN║
 * ║  del usuario y elige QUÉ componente mostrar y con qué PARÁMETROS. La   ║
 * ║  matemática (los números reales) la pone TypeScript de forma          ║
 * ║  determinista a partir de esos parámetros.                            ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/** Componentes que el LLM puede "invocar". Deben coincidir con el registro. */
export type A2uiComponent =
  | 'AppSpendingReport' // 📊 reporte de gastos (KPIs + dona + tendencia + tabla)
  | 'AppRecommendations' // 💡 consejos + nivel de riesgo + alertas
  | 'AppSavingsPlan' // 🎯 metas de ahorro + progreso + simulación
  | 'AppCreditAdvisor' // 💳 capacidad de crédito + endeudamiento + cuota
  | 'AppMovementsTable' // 📋 tabla de movimientos filtrada
  | 'AppAntExpense' // 🐜 análisis de gastos hormiga (hero que cambia de color)
  | 'AppQuickStats'; // 📌 tira compacta de KPIs (cabecera natural de un panel compuesto)

/**
 * Decisión de enrutamiento del LLM.
 * - `componentToRender`: qué mostrar.
 * - `params`: pistas para que TypeScript calcule el `data` real (método, categoría,
 *   producto, precio, período…). El modelo NO rellena importes; solo intención.
 * - `narrative`: análisis en lenguaje natural (se muestra con streaming).
 */
export interface A2uiResponse {
  componentToRender: A2uiComponent;
  params: Record<string, unknown>;
  narrative: string;
}

/** Lista de componentes válidos, usada para validar la salida del modelo en runtime. */
export const A2UI_COMPONENTS: readonly A2uiComponent[] = [
  'AppSpendingReport',
  'AppRecommendations',
  'AppSavingsPlan',
  'AppCreditAdvisor',
  'AppMovementsTable',
  'AppAntExpense',
  'AppQuickStats',
] as const;

/**
 * JSON Schema del ENRUTADOR (responseConstraint del chat).
 *
 * ✨ En Chrome moderno el modelo queda OBLIGADO a producir exactamente esta
 * estructura (structured output nativo), eliminando casi todos los errores de
 * parseo. `params` se deja abierto porque su forma depende de la intención.
 *
 * 🧩 COMPOSICIÓN: la salida es una LISTA de secciones. Una consulta simple
 * devuelve 1 sección (comportamiento clásico); una consulta de panorama
 * ("resumen de mi mes") devuelve varias, que la app apila para construir una
 * interfaz completa. `maxItems` acota el panel para que la demo sea estable.
 */
export const A2UI_ROUTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          componentToRender: {
            type: 'string',
            enum: A2UI_COMPONENTS,
          },
          params: {
            type: 'object',
          },
        },
        required: ['componentToRender', 'params'],
      },
    },
  },
  required: ['sections'],
} as const;

/** Estados posibles del veredicto de gastos hormiga. */
export type AntStatus = 'good' | 'warning' | 'risk';

/** Veredicto estructurado sobre los gastos hormiga. */
export interface AntVerdict {
  status: AntStatus;
  headline: string;
  message: string;
}

/**
 * JSON Schema del VEREDICTO de gastos hormiga.
 * El LLM redacta el mensaje; TypeScript ya calculó las cifras y tiene un
 * fallback por umbrales si el modelo falla (la demo nunca se rompe).
 */
export const ANT_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['good', 'warning', 'risk'] },
    headline: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['status', 'headline', 'message'],
} as const;
