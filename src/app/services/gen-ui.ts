import { Injectable, computed, signal } from '@angular/core';
import {
  A2UI_COMPONENTS,
  A2UI_ROUTER_SCHEMA,
  ANT_VERDICT_SCHEMA,
  A2uiComponent,
  AntVerdict,
} from '../models/a2ui.model';

/** Estados de disponibilidad normalizados para la UI (`Availability` viene de @types/dom-chromium-ai). */
type ModelStatus = Availability | 'unsupported';

/** Qué "forma" de la API encontramos en este navegador. */
type ApiKind = 'modern' | 'legacy';

// --- Tipos mínimos de la API CLÁSICA (window.ai.languageModel) ---
interface LegacyCapabilities {
  available: 'readily' | 'after-download' | 'no';
}
interface LegacySession {
  prompt(input: string): Promise<string>;
  destroy?(): void;
}
interface LegacyFactory {
  capabilities(): Promise<LegacyCapabilities>;
  create(options: { systemPrompt?: string }): Promise<LegacySession>;
}

/** Decisión de enrutamiento que produce el LLM: qué componente + parámetros. */
export interface RouteDecision {
  componentToRender: A2uiComponent;
  params: Record<string, unknown>;
}

/** Resultado de `route()` con telemetría por mensaje. */
export interface RouteResult {
  decision: RouteDecision;
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
Analizas la pregunta del usuario y decides qué componente mostrar y con qué parámetros.
NO calculas cifras ni montos: de eso se encarga la app. Solo eliges componente e intención.

Responde EXCLUSIVAMENTE con JSON válido (sin markdown ni texto extra) con esta forma:
{ "componentToRender": <nombre>, "params": { ... } }

Componentes disponibles:
- "AppSpendingReport": resumen/reporte de gastos, "¿en qué gasto más?", comparar con el mes pasado. params: {}
- "AppAntExpense": gastos hormiga, consumos pequeños, "gastos innecesarios", "en qué se me va el dinero en pequeñas cosas". params: {}
- "AppMovementsTable": listar/filtrar movimientos concretos. params: { "method"?, "category"?, "merchant"?, "largest"?, "antsOnly"?, "period"? }
- "AppRecommendations": consejos para gastar mejor, "qué compras reducir", "qué gastos quitar". params: {}
- "AppSavingsPlan": ahorrar, metas de ahorro, "cómo ahorro más". params: { "goalName"?, "goalTarget"? }
- "AppCreditAdvisor": tarjeta de crédito, endeudamiento, préstamos, comprar algo a crédito. params: { "product"?, "price"?, "months"? }

Valores válidos:
- method: "yape" | "plin" | "debito" | "credito" | "efectivo" | "transferencia"
- category: "cafeteria" | "snacks" | "comida_rapida" | "conveniencia" | "transporte" | "suscripciones" | "restaurantes" | "supermercado" | "servicios" | "ocio" | "salud" | "compras"
- largest/antsOnly: true ; period: "current" | "previous"

Ejemplos:
Usuario: "¿En qué estoy gastando más dinero?"
{ "componentToRender": "AppSpendingReport", "params": {} }
Usuario: "Muéstrame únicamente los pagos realizados con Yape"
{ "componentToRender": "AppMovementsTable", "params": { "method": "yape" } }
Usuario: "¿Cuál fue mi compra más grande este mes?"
{ "componentToRender": "AppMovementsTable", "params": { "largest": true } }
Usuario: "¿Cuánto pagué en restaurantes?"
{ "componentToRender": "AppMovementsTable", "params": { "category": "restaurantes" } }
Usuario: "Quiero sacar un celular a crédito, ¿me conviene?"
{ "componentToRender": "AppCreditAdvisor", "params": { "product": "celular", "price": 1200, "months": 12 } }
Usuario: "¿Tengo capacidad para pedir un préstamo?"
{ "componentToRender": "AppCreditAdvisor", "params": {} }
Usuario: "¿Qué gastos son innecesarios?"
{ "componentToRender": "AppAntExpense", "params": {} }
Usuario: "¿Cómo puedo ahorrar más?"
{ "componentToRender": "AppSavingsPlan", "params": {} }
Usuario: "¿Qué compras podría reducir?"
{ "componentToRender": "AppRecommendations", "params": {} }`;

/**
 * ASESOR: redacta el análisis en lenguaje natural (se muestra con streaming).
 * Usa SOLO las cifras del contexto; nunca inventa números.
 */
const ADVISOR_SYSTEM_PROMPT = `Eres un asesor financiero personal, cercano, claro y motivador.
Respondes en español en 2 a 4 frases, con tono humano. Usas ÚNICAMENTE las cifras del
contexto que se te da; NO inventes montos ni datos que no estén ahí. No uses markdown ni
listas ni viñetas: solo texto corrido y natural, como un buen asesor que explica en confianza.`;

/** VEREDICTO de gastos hormiga: estado + titular + mensaje. */
const ANT_SYSTEM_PROMPT = `Eres un asesor financiero que evalúa los "gastos hormiga" (consumos pequeños y frecuentes).
A partir del resumen que se te da, emites un veredicto en JSON válido con esta forma exacta:
{ "status": "good" | "warning" | "risk", "headline": <titular corto>, "message": <1-2 frases> }
- "good": los gastos hormiga están bajo control o bajando. headline tipo "Vas administrando bien tus gastos".
- "warning": están subiendo o pesan bastante. headline tipo "Estás aumentando tus gastos pequeños".
- "risk": suben mucho y ponen en peligro el saldo. headline tipo "Podrías quedarte sin dinero antes de fin de mes".
Escribe en español, cercano y claro. Responde SOLO el JSON, sin markdown ni texto extra.`;

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
  /** Qué API detectamos (o null si el navegador no la soporta). */
  private readonly apiKind = signal<ApiKind | null>(this.detectApi());

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

  /** ¿Existe alguna forma de la API en este navegador? */
  readonly isSupported = computed(() => this.apiKind() !== null);

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

  private detectApi(): ApiKind | null {
    if (typeof LanguageModel !== 'undefined') return 'modern';
    if (this.legacyFactory()) return 'legacy';
    return null;
  }

  private legacyFactory(): LegacyFactory | null {
    return (globalThis as any)?.ai?.languageModel ?? null;
  }

  async refreshAvailability(): Promise<void> {
    const kind = this.apiKind();
    try {
      if (kind === 'modern') {
        this.status.set(await LanguageModel.availability());
      } else if (kind === 'legacy') {
        const caps = await this.legacyFactory()!.capabilities();
        this.status.set(
          caps.available === 'readily'
            ? 'available'
            : caps.available === 'after-download'
              ? 'downloadable'
              : 'unavailable',
        );
      } else {
        this.status.set('unsupported');
      }
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
    const kind = this.apiKind();
    if (!kind) return;

    this.isDownloading.set(true);
    this.status.set('downloading');
    this.downloadProgress.set(0);
    try {
      if (kind === 'modern') {
        const session = await LanguageModel.create({ monitor: this.monitor });
        session.destroy();
      } else {
        const session = await this.legacyFactory()!.create({});
        session.destroy?.();
      }
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
    const kind = this.requireApi();
    const input = `${context}\n\nPregunta del usuario: "${query}"`;

    console.groupCollapsed(
      '%c🧭 Gemini Nano — Enrutado de UI (Prompt API)',
      'color:#7c4dff;font-weight:bold',
    );
    console.log('%c📤 Consulta:', 'font-weight:bold', query);

    const start = performance.now();
    try {
      let raw: string;
      if (kind === 'modern') {
        const session = await LanguageModel.create({
          initialPrompts: [{ role: 'system', content: ROUTER_SYSTEM_PROMPT }],
          monitor: this.monitor,
        });
        try {
          raw = await session.prompt(input, {
            responseConstraint: A2UI_ROUTER_SCHEMA as unknown as Record<string, unknown>,
          });
        } finally {
          session.destroy();
        }
      } else {
        const session = await this.legacyFactory()!.create({ systemPrompt: ROUTER_SYSTEM_PROMPT });
        try {
          raw = await session.prompt(input);
        } finally {
          session.destroy?.();
        }
      }

      const durationMs = Math.round(performance.now() - start);
      const decision = this.parseDecision(raw);
      this.lastRawOutput.set(raw);
      this.lastDurationMs.set(durationMs);

      console.log('%c📥 Salida CRUDA:', 'font-weight:bold', raw);
      console.log(`%c⏱️ Inferencia local: ${durationMs} ms (sin red, on-device)`, 'color:#00897b;font-weight:bold');
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
  //  2️⃣ NARRATIVA — respuesta en lenguaje natural con STREAMING token a token
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera el análisis en lenguaje natural y lo entrega en streaming: `onChunk`
   * recibe el texto acumulado en cada token. Devuelve el texto final completo.
   * (En la API clásica, sin streaming, entrega el texto de una sola vez.)
   */
  async answerStreaming(
    query: string,
    context: string,
    onChunk: (accumulated: string) => void,
  ): Promise<string> {
    const kind = this.requireApi();
    const input = `Contexto de la cuenta:\n${context}\n\nPregunta del usuario: "${query}"\nResponde como su asesor financiero.`;

    if (kind === 'modern') {
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

    // Camino clásico: sin streaming real → una sola entrega.
    const session = await this.legacyFactory()!.create({ systemPrompt: ADVISOR_SYSTEM_PROMPT });
    try {
      const text = await session.prompt(input);
      onChunk(text);
      return text;
    } finally {
      session.destroy?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  3️⃣ VEREDICTO de gastos hormiga (estructurado, con fallback en el llamador)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pide al modelo un veredicto sobre los gastos hormiga a partir del resumen ya
   * calculado. Lanza si el modelo no está disponible/falla → el llamador aplica
   * su fallback determinista para que la tarjeta nunca quede vacía.
   */
  async analyzeAntExpenses(summary: string): Promise<AntVerdict> {
    const kind = this.requireApi();
    const start = performance.now();

    let raw: string;
    if (kind === 'modern') {
      const session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: ANT_SYSTEM_PROMPT }],
        monitor: this.monitor,
      });
      try {
        raw = await session.prompt(summary, {
          responseConstraint: ANT_VERDICT_SCHEMA as unknown as Record<string, unknown>,
        });
      } finally {
        session.destroy();
      }
    } else {
      const session = await this.legacyFactory()!.create({ systemPrompt: ANT_SYSTEM_PROMPT });
      try {
        raw = await session.prompt(summary);
      } finally {
        session.destroy?.();
      }
    }

    this.lastRawOutput.set(raw);
    this.lastDurationMs.set(Math.round(performance.now() - start));
    return this.parseVerdict(raw);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  🛡️ Utilidades de parseo defensivo
  // ─────────────────────────────────────────────────────────────────────────

  private requireApi(): ApiKind {
    const kind = this.apiKind();
    if (!kind) {
      throw new Error(
        'La IA integrada de Chrome no está disponible. Activa los flags de Prompt API y usa Chrome 138+.',
      );
    }
    return kind;
  }

  private parseDecision(raw: string): RouteDecision {
    const obj = this.parseObject(raw);
    const component = obj['componentToRender'];
    if (typeof component !== 'string' || !(A2UI_COMPONENTS as readonly string[]).includes(component)) {
      throw new Error(`Componente no reconocido en la respuesta del modelo:\n${raw}`);
    }
    const params = obj['params'];
    return {
      componentToRender: component as A2uiComponent,
      params: typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {},
    };
  }

  private parseVerdict(raw: string): AntVerdict {
    const obj = this.parseObject(raw);
    const status = obj['status'];
    const valid = status === 'good' || status === 'warning' || status === 'risk';
    if (!valid) throw new Error(`Veredicto inválido del modelo:\n${raw}`);
    return {
      status,
      headline: typeof obj['headline'] === 'string' ? (obj['headline'] as string) : 'Análisis de gastos hormiga',
      message: typeof obj['message'] === 'string' ? (obj['message'] as string) : '',
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
