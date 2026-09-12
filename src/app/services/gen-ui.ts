import { Injectable, computed, signal } from '@angular/core';
import {
  BASICO_COMPONENTS,
  BASICO_ROUTER_SCHEMA,
  BasicoComponent,
  BasicoDecision,
  BasicoRouteResult,
} from '../models/basico.model';
import { UI_COMPONENTS, UI_ROUTER_SCHEMA, UiComponent } from '../models/ui-router.model';
import { ASESOR_PROMPT } from './prompts/asesor.prompt';
import { BASICO_ROUTER_PROMPT } from './prompts/router-basico.prompt';
import { UI_ROUTER_PROMPT } from './prompts/router-completo.prompt';

/** Estados de disponibilidad normalizados para la UI (`Availability` viene de @types/dom-chromium-ai). */
type ModelStatus = Availability | 'unsupported';

/** Decisión de enrutamiento de UNA sección: qué componente + parámetros. */
export interface RouteDecision {
  componentToRender: UiComponent;
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

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  GenUiService — EL CEREBRO AGÉNTICO (Gemini Nano, 100% on-device)     ║
 * ║                                                                       ║
 * ║  Traduce el lenguaje del usuario en decisiones de UI (route) y en     ║
 * ║  análisis narrado (streaming). La matemática la hace TypeScript; el   ║
 * ║  modelo solo entiende, clasifica y redacta.                           ║
 * ║                                                                       ║
 * ║  Un único servicio sirve a los tres niveles de la demo:               ║
 * ║    · `routeBasic()`      → nivel Básico (3 componentes, 1 sección)    ║
 * ║    · `route()`           → niveles Intermedio y Avanzado (7           ║
 * ║                            componentes, 1..N secciones apiladas)      ║
 * ║    · `answerStreaming()` → la narrativa, en los tres niveles          ║
 * ║                                                                       ║
 * ║  Ojo: aquí NO interviene el protocolo A2UI. Este servicio solo        ║
 * ║  produce la DECISIÓN del modelo; cada nivel la materializa a su       ║
 * ║  manera después (ver `models/ui-router.model.ts`).                    ║
 * ║                                                                       ║
 * ║  Los tres system prompts viven en `services/prompts/` para que este   ║
 * ║  archivo se lea como pura mecánica: crear sesión, inferir, parsear.   ║
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

  // ─── TELEMETRÍA (prueba en vivo de que la IA es REAL) ───────────────────────
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
        return 'Modelo local listo (Gemini Nano)';
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
   * Dispara la descarga de Gemini Nano (requiere gesto del usuario: se llama
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
  //  1. ENRUTADO — qué componentes + parámetros (salida estructurada)
  //      Niveles Intermedio y Avanzado: LOS DOS llaman a este mismo método.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Interpreta la consulta del usuario y decide qué componentes renderizar
   * (1..N secciones que luego se apilan). Devuelve la decisión + telemetría
   * (raw, ms) para probar que la IA es real.
   */
  async route(query: string, context: string): Promise<RouteResult> {
    this.requireApi();
    const input = `${context}\n\nPregunta del usuario: "${query}"`;

    console.groupCollapsed(
      '%cGemini Nano — Enrutado de UI (Prompt API)',
      'color:#7c4dff;font-weight:bold',
    );
    console.log('%cConsulta:', 'font-weight:bold', query);

    const start = performance.now();
    try {
      const session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: UI_ROUTER_PROMPT }],
        monitor: this.monitor,
      });
      let raw: string;
      try {
        raw = await session.prompt(input, {
          responseConstraint: UI_ROUTER_SCHEMA,
        });
      } finally {
        session.destroy();
      }

      const durationMs = Math.round(performance.now() - start);
      const decision = this.parseDecision(raw);
      this.lastRawOutput.set(raw);
      this.lastDurationMs.set(durationMs);

      console.log('%cSalida CRUDA:', 'font-weight:bold', raw);
      console.log(
        `%cInferencia local: ${durationMs} ms (sin red, on-device)`,
        'color:#00897b;font-weight:bold',
      );
      console.log('%cDecisión de UI:', 'font-weight:bold', decision);
      console.groupEnd();

      return { decision, raw, durationMs };
    } catch (err) {
      console.error('%cError en el enrutado:', 'color:#d32f2f', err);
      console.groupEnd();
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  1.B  ENRUTADOR BÁSICO — versión mínima del enrutador (3 componentes toy)
  //          Nivel Básico únicamente.
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Igual que `route()` pero para el nivel Básico: usa `BASICO_ROUTER_SCHEMA` y
   * un system prompt reducido para elegir UN componente entre 3 (sin componer
   * varias secciones). Método aditivo — no toca el flujo de `route()`.
   */
  async routeBasic(query: string, context: string): Promise<BasicoRouteResult> {
    this.requireApi();
    const input = `${context}\n\nPregunta del usuario: "${query}"`;
    console.groupCollapsed(
      '%cGemini Nano — Enrutado BÁSICO (Prompt API)',
      'color:#7c4dff;font-weight:bold',
    );
    console.log('%cContexto:', 'font-weight:bold', context);

    console.log('%cConsulta:', 'font-weight:bold', query);

    const start = performance.now();
    try {
      const session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: BASICO_ROUTER_PROMPT }],
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

      console.log('%cSalida CRUDA:', 'font-weight:bold', raw);
      console.log(
        `%cInferencia local: ${durationMs} ms (sin red, on-device)`,
        'color:#00897b;font-weight:bold',
      );
      console.log('%cDecisión básica:', 'font-weight:bold', decision);
      console.groupEnd();

      return { decision, raw, durationMs };
    } catch (err) {
      console.error('%cError en el enrutado básico:', 'color:#d32f2f', err);
      console.groupEnd();
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  2. NARRATIVA — respuesta en lenguaje natural con STREAMING token a token
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
      initialPrompts: [{ role: 'system', content: ASESOR_PROMPT }],
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
  //  Utilidades de parseo defensivo
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
   * Tolerante por seguridad: aunque `responseConstraint` restringe la salida al
   * formato `{ sections: [...] }`, no es una garantía formal (ver la nota de
   * `ui-router.model.ts`), así que aceptamos también el viejo
   * `{ componentToRender, params }` (lo envolvemos como una única sección) y
   * descartamos secciones inválidas. Solo lanza si no queda ninguna reconocible.
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
        !(UI_COMPONENTS as readonly string[]).includes(component)
      )
        continue;
      const params = rec['params'];
      sections.push({
        componentToRender: component as UiComponent,
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
