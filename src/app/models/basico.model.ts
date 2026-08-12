/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  CONTRATO BÁSICO  (nivel didáctico 1)                                  ║
 * ║                                                                       ║
 * ║  Versión mínima del contrato de enrutamiento: Gemini Nano elige entre ║
 * ║  solo TRES componentes "toy" (texto, un dato, una lista). Es el mismo  ║
 * ║  principio que `a2ui.model.ts` (el LLM decide QUÉ mostrar; TypeScript  ║
 * ║  pone los números), reducido al esqueleto para explicar el concepto    ║
 * ║  sin gráficos ni protocolo A2UI de por medio.                          ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/** Los 3 componentes toy que el modelo puede elegir en el nivel Básico. */
export type BasicoComponent = 'PlainAnswer' | 'StatCard' | 'SimpleList';

/** Lista de componentes válidos (para validar la salida del modelo en runtime). */
export const BASICO_COMPONENTS: readonly BasicoComponent[] = [
  'PlainAnswer',
  'StatCard',
  'SimpleList',
] as const;

/** Decisión de enrutamiento del nivel Básico: qué componente + parámetros. */
export interface BasicoDecision {
  componentToRender: BasicoComponent;
  params: Record<string, unknown>;
}

/** Resultado de `routeBasic()` con telemetría por mensaje. */
export interface BasicoRouteResult {
  decision: BasicoDecision;
  raw: string;
  durationMs: number;
}

/**
 * JSON Schema del ENRUTADOR BÁSICO (responseConstraint). Espejo reducido de
 * `A2UI_ROUTER_SCHEMA`: en Chrome moderno obliga al modelo a producir
 * exactamente esta forma (structured output nativo). `params` queda abierto
 * porque su contenido depende de la intención.
 */
export const BASICO_ROUTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    componentToRender: {
      type: 'string',
      enum: BASICO_COMPONENTS,
    },
    params: {
      type: 'object',
    },
  },
  required: ['componentToRender', 'params'],
} as const;
