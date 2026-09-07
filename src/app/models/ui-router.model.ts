/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  CONTRATO DEL ENRUTADOR DE UI  (niveles Intermedio y Avanzado)         ║
 * ║                                                                       ║
 * ║  El "lenguaje" compartido entre el LLM local (Gemini Nano) y Angular. ║
 * ║  El modelo NO calcula dinero ni redacta la UI: interpreta la INTENCIÓN║
 * ║  del usuario y elige QUÉ componentes mostrar y con qué PARÁMETROS. La  ║
 * ║  matemática (los números reales) la pone TypeScript de forma          ║
 * ║  determinista a partir de esos parámetros.                            ║
 * ║                                                                       ║
 * ║  ⚠️  NO CONFUNDIR CON EL PROTOCOLO A2UI. Este es un contrato PROPIO    ║
 * ║  de la demo — deliberadamente mínimo — que usan por igual el nivel     ║
 * ║  Intermedio y el Avanzado: en ambos la decisión del modelo es la       ║
 * ║  misma. Lo que cambia es cómo se materializa esa decisión:            ║
 * ║    · Intermedio → Angular monta el componente directamente.           ║
 * ║    · Avanzado   → se traduce al protocolo A2UI v0.9 estándar,         ║
 * ║                   descrito aparte en `a2ui-protocol.ts`.              ║
 * ║                                                                       ║
 * ║  La versión reducida de este mismo contrato, para el nivel Básico,    ║
 * ║  vive en `basico.model.ts` (3 componentes, 1 sola sección).           ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

/** Componentes que el LLM puede "invocar". Deben coincidir con el registro. */
export type UiComponent =
  | 'AppSpendingReport' // 📊 reporte de gastos (KPIs + dona + tendencia + tabla)
  | 'AppRecommendations' // 💡 consejos + nivel de riesgo + alertas
  | 'AppSavingsPlan' // 🎯 metas de ahorro + progreso + simulación
  | 'AppCreditAdvisor' // 💳 capacidad de crédito + endeudamiento + cuota
  | 'AppMovementsTable' // 📋 tabla de movimientos filtrada
  | 'AppAntExpense' // 🐜 análisis de gastos hormiga (hero que cambia de color)
  | 'AppQuickStats'; // 📌 tira compacta de KPIs (cabecera natural de un panel compuesto)

/** Lista de componentes válidos, usada para validar la salida del modelo en runtime. */
export const UI_COMPONENTS: readonly UiComponent[] = [
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
 * ✨ Chrome restringe la generación a esta forma (structured output nativo), así
 * que la salida es JSON parseable en vez de texto con markdown alrededor. Ojo
 * con el matiz: la especificación NO promete cumplimiento garantizado — si el
 * navegador no logra producir una respuesta conforme, `prompt()` lanza un
 * `SyntaxError`; y si el schema usa palabras clave que la implementación no
 * soporta, lanza `NotSupportedError`. Por eso el parseo de `GenUiService` sigue
 * siendo defensivo. `params` se deja abierto porque su forma depende de la
 * intención.
 *
 * Ref.: https://developer.chrome.com/docs/ai/structured-output-for-prompt-api
 *       https://github.com/webmachinelearning/prompt-api (comportamiento de error)
 *
 * 🧩 COMPOSICIÓN: la salida es una LISTA de secciones. Una consulta simple
 * devuelve 1 sección (comportamiento clásico); una consulta de panorama
 * ("resumen de mi mes") devuelve varias, que la app apila para construir una
 * interfaz completa. `maxItems` acota el panel para que la demo sea estable.
 *
 * El system prompt que acompaña a este schema es `UI_ROUTER_PROMPT`
 * (`services/prompts/router-completo.prompt.ts`).
 */
export const UI_ROUTER_SCHEMA = {
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
            enum: UI_COMPONENTS,
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
