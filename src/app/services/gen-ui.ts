import { Injectable, computed, signal } from '@angular/core';
import {
  A2UI_COMPONENTS,
  A2UI_ROUTER_SCHEMA,
  A2uiComponent,
} from '../models/a2ui.model';
import {
  BASICO_COMPONENTS,
  BASICO_ROUTER_SCHEMA,
  BasicoComponent,
  BasicoDecision,
  BasicoRouteResult,
} from '../models/basico.model';

/** Estados de disponibilidad normalizados para la UI (`Availability` viene de @types/dom-chromium-ai). */
type ModelStatus = Availability | 'unsupported';

/** Decisión de enrutamiento de UNA sección: qué componente + parámetros. */
export interface RouteDecision {
  componentToRender: A2uiComponent;
  params: Record<string, unknown>;
}

/**
 * Decisión COMPUESTA: una o varias secciones que se apilan para formar la
 * interfaz completa. Una consulta simple trae 1 sección; una de panorama, varias.
 */
export interface CompositeDecision {
  sections: RouteDecision[];
}

/** Resultado de `route()` con telemetría por mensaje. */
export interface RouteResult {
  decision: CompositeDecision;
  raw: string;
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  🧠 SYSTEM PROMPTS — tres "personalidades" del mismo modelo local
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ENRUTADOR: convierte al LLM en un motor de selección de UI. Su única salida
 * es el componente + los parámetros. NO calcula importes: solo intención.
 */
const ROUTER_SYSTEM_PROMPT = `Eres un MOTOR DE ENRUTAMIENTO DE INTERFAZ para una app financiera.
Analizas la pregunta del usuario y decides qué componentes mostrar y con qué parámetros.
NO calculas cifras ni montos: de eso se encarga la app. Solo eliges componentes e intención.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown ni texto extra) con esta forma:
{ "sections": [ { "componentToRender": <nombre>, "params": { ... } }, ... ] }

Componentes disponibles:
- "AppQuickStats": tira compacta de KPIs. Ideal como CABECERA de un panorama. params: {}
- "AppSpendingReport": reporte de gastos, "¿en qué gasto más?". params: {}
- "AppAntExpense": gastos hormiga, consumos pequeños. params: {}
- "AppMovementsTable": listar/filtrar movimientos. params: { "method"?, "category"?, "merchant"?, "largest"?, "antsOnly"?, "period"? }
- "AppRecommendations": consejos para gastar mejor. params: {}
- "AppSavingsPlan": metas de ahorro. params: { "goalName"?, "goalTarget"? }
- "AppCreditAdvisor": crédito, endeudamiento, compras a crédito. params: { "product"?, "price"?, "months"? }

Valores válidos:
- method: "yape" | "plin" | "debito" | "credito" | "efectivo" | "transferencia"
- category: "cafeteria" | "snacks" | "comida_rapida" | "conveniencia" | "transporte" | "suscripciones" | "restaurantes" | "supermercado" | "servicios" | "ocio" | "salud" | "compras"
- largest/antsOnly: true ; period: "current" | "previous"

REGLA IMPORTANTE — cuántas secciones devolver:
- Pregunta CONCRETA (un solo tema) → 1 sección.
- Pregunta AMPLIA o PANORÁMICA → VARIAS secciones (2 a 4) apiladas.
  Palabras clave de panorama: "resumen", "cómo voy", "mi situación", "panorama", "estado de mis finanzas", "mi mes", "todo junto", "análisis completo", "cómo estoy".

Ejemplos de 1 sección (preguntas concretas):
Usuario: "Muéstrame solo mis Yape"
{ "sections": [ { "componentToRender": "AppMovementsTable", "params": { "method": "yape" } } ] }
Usuario: "Quiero sacar un celular a crédito"
{ "sections": [ { "componentToRender": "AppCreditAdvisor", "params": { "product": "celular", "price": 1200, "months": 12 } } ] }
Usuario: "¿Qué gastos son innecesarios?"
{ "sections": [ { "componentToRender": "AppAntExpense", "params": {} } ] }
Usuario: "¿Cómo puedo ahorrar más?"
{ "sections": [ { "componentToRender": "AppSavingsPlan", "params": {} } ] }
Usuario: "¿Cuál fue mi compra más grande?"
{ "sections": [ { "componentToRender": "AppMovementsTable", "params": { "largest": true } } ] }

Ejemplos de VARIAS secciones (preguntas amplias / panorama):
Usuario: "Hazme un resumen de mis finanzas de este mes"
{ "sections": [ { "componentToRender": "AppQuickStats", "params": {} }, { "componentToRender": "AppSpendingReport", "params": {} }, { "componentToRender": "AppAntExpense", "params": {} }, { "componentToRender": "AppRecommendations", "params": {} } ] }
Usuario: "¿Cómo voy este mes? Quiero ver todo"
{ "sections": [ { "componentToRender": "AppQuickStats", "params": {} }, { "componentToRender": "AppSpendingReport", "params": {} }, { "componentToRender": "AppRecommendations", "params": {} } ] }
Usuario: "¿Cómo estoy financieramente?"
{ "sections": [ { "componentToRender": "AppQuickStats", "params": {} }, { "componentToRender": "AppSpendingReport", "params": {} }, { "componentToRender": "AppAntExpense", "params": {} } ] }
Usuario: "Dame mi situación financiera y consejos"
{ "sections": [ { "componentToRender": "AppQuickStats", "params": {} }, { "componentToRender": "AppRecommendations", "params": {} } ] }
Usuario: "¿En qué gasto más y qué puedo recortar?"
{ "sections": [ { "componentToRender": "AppSpendingReport", "params": {} }, { "componentToRender": "AppRecommendations", "params": {} } ] }

RECUERDA: si la pregunta es amplia, panorámica o pide "resumen" / "cómo voy", DEBES devolver VARIAS secciones (2 a 4), NO una sola.`;

/**
 * ENRUTADOR BÁSICO (nivel didáctico 1): elige entre solo 3 componentes toy.
 * Mismo principio que el enrutador completo, con un catálogo mínimo para
 * explicar el concepto "el modelo elige la UI" sin ruido.
 */
const BASICO_ROUTER_SYSTEM_PROMPT = `Eres un MOTOR DE ENRUTAMIENTO DE INTERFAZ para una app financiera sencilla.
Analizas la pregunta del usuario y eliges UNO de tres componentes para responder.
NO calculas cifras ni montos: solo eliges el componente y la intención.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown ni texto extra) con esta forma:
{ "componentToRender": <nombre>, "params": { ... } }

Componentes disponibles:
- "StatCard": muestra UN número clave destacado. params: { "metric": "balance" | "spent" | "income" | "largest" }
- "SimpleList": muestra una lista de movimientos recientes. params: { "limit"?: <número> }
- "PlainAnswer": una respuesta explicativa en texto (definiciones, consejos generales, preguntas conceptuales). params: {}

Valores válidos para metric:
- "balance": saldo disponible ; "spent": total gastado este mes ; "income": ingreso mensual ; "largest": el mayor gasto

Ejemplos:
Usuario: "¿Cuánto he gastado este mes?"
{ "componentToRender": "StatCard", "params": { "metric": "spent" } }
Usuario: "¿Cuál es mi saldo disponible?"
{ "componentToRender": "StatCard", "params": { "metric": "balance" } }
Usuario: "¿Cuál fue mi mayor gasto?"
{ "componentToRender": "StatCard", "params": { "metric": "largest" } }
Usuario: "Muéstrame mis últimos movimientos"
{ "componentToRender": "SimpleList", "params": {} }
Usuario: "Enséñame mis 3 últimos gastos"
{ "componentToRender": "SimpleList", "params": { "limit": 3 } }
Usuario: "¿Qué es un gasto hormiga?"
{ "componentToRender": "PlainAnswer", "params": {} }
Usuario: "Dame un consejo para ahorrar"
{ "componentToRender": "PlainAnswer", "params": {} }`;

/**
 * ASESOR: redacta el análisis en lenguaje natural (se muestra con streaming).
 * Usa SOLO las cifras del contexto; nunca inventa números.
 */
const ADVISOR_SYSTEM_PROMPT = `Eres un asesor financiero personal, cercano, claro y motivador.
Respondes en español en 2 a 4 frases, con tono humano. Usas ÚNICAMENTE las cifras del
contexto que se te da; NO inventes montos ni datos que no estén ahí. No uses markdown ni
listas ni viñetas: solo texto corrido y natural, como un buen asesor que explica en confianza.`;


/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  GenUiService — EL CEREBRO AGÉNTICO (Gemini Nano, 100% on-device)     ║
 * ║                                                                       ║
 * ║  Traduce el lenguaje del usuario en decisiones de UI (route) y en     ║
 * ║  análisis narrado (streaming). La matemática la hace TypeScript; el   ║
 * ║  modelo solo entiende, clasifica y redacta.                           ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class GenUiService {
  /** ¿Existe la Prompt API (el global `LanguageModel`) en este navegador? */
  private readonly supported = signal<boolean>(typeof LanguageModel !== 'undefined');

  /** Estado de disponibilidad del modelo, para mostrarlo en el dashboard. */
  readonly status = signal<ModelStatus>('unsupported');

  /** Progreso de descarga del modelo (0-100), si Chrome lo está bajando. */
  readonly downloadProgress = signal(0);

  /** true mientras disparamos y esperamos la descarga del modelo. */
  readonly isDownloading = signal(false);

  // ─── 🔍 TELEMETRÍA (prueba en vivo de que la IA es REAL) ────────────────────
  /** Duración de la última inferencia local, en ms. Un `if/else` sería ~0 ms. */
  readonly lastDurationMs = signal<number | null>(null);
  /** Texto CRUDO devuelto por el modelo en la última inferencia (antes del parseo). */
  readonly lastRawOutput = signal<string | null>(null);

  /** ¿La Prompt API está disponible en este navegador? */
  readonly isSupported = computed(() => this.supported());

  /** ¿El modelo requiere descarga antes de poder usarse? */
  readonly needsDownload = computed(
    () => this.status() === 'downloadable' || this.status() === 'downloading',
  );

  /** ¿Está listo para inferir? */
  readonly isReady = computed(() => this.status() === 'available');

  /** Etiqueta legible para la UI. */
  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'available':
        return 'Modelo local listo (Gemini Nano) ✓';
      case 'downloadable':
        return 'El modelo se puede descargar…';
      case 'downloading':
        return `Descargando modelo… ${this.downloadProgress()}%`;
      case 'unavailable':
        return 'El modelo no está disponible en este dispositivo';
      default:
        return 'API de IA de Chrome no detectada';
    }
  });

  constructor() {
    void this.refreshAvailability();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Detección y disponibilidad
  // ─────────────────────────────────────────────────────────────────────────

  async refreshAvailability(): Promise<void> {
    if (!this.supported()) {
      this.status.set('unsupported');
      return;
    }
    try {
      this.status.set(await LanguageModel.availability());
    } catch {
      this.status.set('unavailable');
    }
  }

  /** Monitor de progreso de descarga reutilizable para cualquier `create()`. */
  private readonly monitor = (m: CreateMonitor) =>
    m.addEventListener('downloadprogress', (e) =>
      this.downloadProgress.set(Math.round(e.loaded * 100)),
    );

  /**
   * ⬇️ Dispara la descarga de Gemini Nano (requiere gesto del usuario: se llama
   * desde un botón). El propio `create()` baja el modelo y deja una sesión lista.
   */
  async downloadModel(): Promise<void> {
    if (!this.supported()) return;

    this.isDownloading.set(true);
    this.status.set('downloading');
    this.downloadProgress.set(0);
    try {
      const session = await LanguageModel.create({ monitor: this.monitor });
      session.destroy();
    } finally {
      this.isDownloading.set(false);
      await this.refreshAvailability();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  1️⃣ ENRUTADO — qué componente + parámetros (salida estructurada)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Interpreta la consulta del usuario y decide qué componente renderizar.
   * Devuelve la decisión + telemetría (raw, ms) para probar que la IA es real.
   */
  async route(query: string, context: string): Promise<RouteResult> {
    this.requireApi();
    const input = `${context}\n\nPregunta del usuario: "${query}"`;

    console.groupCollapsed(
      '%c🧭 Gemini Nano — Enrutado de UI (Prompt API)',
      'color:#7c4dff;font-weight:bold',
    );
    console.log('%c📤 Consulta:', 'font-weight:bold', query);

    const start = performance.now();
    try {
      const session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: ROUTER_SYSTEM_PROMPT }],
        monitor: this.monitor,
      });
      let raw: string;
      try {
        raw = await session.prompt(input, {
          responseConstraint: A2UI_ROUTER_SCHEMA as unknown as Record<string, unknown>,
        });
      } finally {
        session.destroy();
      }

      const durationMs = Math.round(performance.now() - start);
      const decision = this.parseDecision(raw);
      this.lastRawOutput.set(raw);
      this.lastDurationMs.set(durationMs);

      console.log('%c📥 Salida CRUDA:', 'font-weight:bold', raw);
      console.log(
        `%c⏱️ Inferencia local: ${durationMs} ms (sin red, on-device)`,
        'color:#00897b;font-weight:bold',
      );
      console.log('%c✅ Decisión A2UI:', 'font-weight:bold', decision);
      console.groupEnd();

      return { decision, raw, durationMs };
    } catch (err) {
      console.error('%c❌ Error en el enrutado:', 'color:#d32f2f', err);
      console.groupEnd();
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  1️⃣·B  ENRUTADOR BÁSICO — versión mínima del enrutador (3 componentes toy)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Igual que `route()` pero para el nivel Básico: usa `BASICO_ROUTER_SCHEMA` y
   * un system prompt reducido para elegir entre 3 componentes toy. Método
   * aditivo — no toca el flujo de `route()` que usan Intermedio/Avanzado.
   */
  async routeBasic(query: string, context: string): Promise<BasicoRouteResult> {
    this.requireApi();
    const input = `${context}\n\nPregunta del usuario: "${query}"`;
    console.groupCollapsed(
      '%c🧭 Gemini Nano — Enrutado BÁSICO (Prompt API)',
      'color:#7c4dff;font-weight:bold',
    );
    console.log('%c🔍 Contexto:', 'font-weight:bold', context);

    console.log('%c📤 Consulta:', 'font-weight:bold', query);

    const start = performance.now();
    try {
      const session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: BASICO_ROUTER_SYSTEM_PROMPT }],
        monitor: this.monitor,
      });
      let raw: string;
      try {
        raw = await session.prompt(input, {
          responseConstraint: BASICO_ROUTER_SCHEMA as unknown as Record<string, unknown>,
        });
      } finally {
        session.destroy();
      }

      const durationMs = Math.round(performance.now() - start);
      const decision = this.parseBasicDecision(raw);
      this.lastRawOutput.set(raw);
      this.lastDurationMs.set(durationMs);

      console.log('%c📥 Salida CRUDA:', 'font-weight:bold', raw);
      console.log(
        `%c⏱️ Inferencia local: ${durationMs} ms (sin red, on-device)`,
        'color:#00897b;font-weight:bold',
      );
      console.log('%c✅ Decisión básica:', 'font-weight:bold', decision);
      console.groupEnd();

      return { decision, raw, durationMs };
    } catch (err) {
      console.error('%c❌ Error en el enrutado básico:', 'color:#d32f2f', err);
      console.groupEnd();
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  2️⃣ NARRATIVA — respuesta en lenguaje natural con STREAMING token a token
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera el análisis en lenguaje natural y lo entrega en streaming: `onChunk`
   * recibe el texto acumulado en cada token. Devuelve el texto final completo.
   */
  async answerStreaming(
    query: string,
    context: string,
    onChunk: (accumulated: string) => void,
  ): Promise<string> {
    this.requireApi();
    const input = `Contexto de la cuenta:\n${context}\n\nPregunta del usuario: "${query}"\nResponde como su asesor financiero.`;

    const session = await LanguageModel.create({
      initialPrompts: [{ role: 'system', content: ADVISOR_SYSTEM_PROMPT }],
      monitor: this.monitor,
    });
    try {
      const stream = session.promptStreaming(input);
      const reader = stream.getReader();
      let acc = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += value ?? ''; // los chunks son deltas → se concatenan
          onChunk(acc);
        }
      } finally {
        reader.releaseLock();
      }
      return acc;
    } finally {
      session.destroy();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  🛡️ Utilidades de parseo defensivo
  // ─────────────────────────────────────────────────────────────────────────

  private requireApi(): void {
    if (!this.supported()) {
      throw new Error(
        'La IA integrada de Chrome no está disponible. Usa Chrome de escritorio 148+ (o 138+ con los flags de Prompt API activados).',
      );
    }
  }

  /**
   * Parsea la salida del enrutador a una decisión compuesta (1..N secciones).
   * Tolerante por seguridad: aunque `responseConstraint` fuerza el formato
   * `{ sections: [...] }`, aceptamos también el viejo `{ componentToRender, params }`
   * (lo envolvemos como una única sección) y descartamos secciones inválidas.
   * Solo lanza si no queda ninguna reconocible.
   */
  private parseDecision(raw: string): CompositeDecision {
    const obj = this.parseObject(raw);
    const rawList = Array.isArray(obj['sections']) ? (obj['sections'] as unknown[]) : [obj];
    const sections: RouteDecision[] = [];
    for (const s of rawList) {
      if (typeof s !== 'object' || s === null) continue;
      const rec = s as Record<string, unknown>;
      const component = rec['componentToRender'];
      if (
        typeof component !== 'string' ||
        !(A2UI_COMPONENTS as readonly string[]).includes(component)
      )
        continue;
      const params = rec['params'];
      sections.push({
        componentToRender: component as A2uiComponent,
        params:
          typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {},
      });
    }
    if (!sections.length) {
      throw new Error(`Ninguna sección válida en la respuesta del modelo:\n${raw}`);
    }
    return { sections };
  }

  private parseBasicDecision(raw: string): BasicoDecision {
    const obj = this.parseObject(raw);
    const component = obj['componentToRender'];
    if (
      typeof component !== 'string' ||
      !(BASICO_COMPONENTS as readonly string[]).includes(component)
    ) {
      throw new Error(`Componente básico no reconocido en la respuesta del modelo:\n${raw}`);
    }
    const params = obj['params'];
    return {
      componentToRender: component as BasicoComponent,
      params:
        typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {},
    };
  }

  private parseObject(raw: string): Record<string, unknown> {
    const jsonText = this.extractJson(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`La respuesta del modelo no es JSON válido. Recibido:\n${raw}`);
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error(`La respuesta no es un objeto. Recibido:\n${raw}`);
    }
    return parsed as Record<string, unknown>;
  }

  /** Quita fences de markdown y recorta al primer '{'…último '}'. */
  private extractJson(raw: string): string {
    let s = raw.trim();
    s = s
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      s = s.slice(start, end + 1);
    }
    return s;
  }
}
