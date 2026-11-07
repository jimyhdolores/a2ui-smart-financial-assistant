import { Injectable, Injector, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular';
import type { ActionPayload } from '@a2ui/web_core';
import { Subject } from 'rxjs';

import { A2UI_MIME_TYPE, A2UI_VERSION, type A2uiMessage } from '../models/a2ui-protocol';
import { FinanceDataService } from './finance-data';

/** Lo que el agente cuenta de sí mismo en `GET /api/health`. */
export interface AgentHealth {
  status: string;
  model: string;
  llmConfigured: boolean;
  a2uiVersion: string;
  mimeType: string;
  catalogs: string[];
}

/** Tokens que Google reporta para la respuesta. */
export interface AgentUsage {
  input?: number | null;
  output?: number | null;
  /** Tokens de razonamiento: la prueba de que pensó un modelo de razonamiento. */
  thought?: number | null;
  total?: number | null;
}

/** Cierre de un turno (`event: done`). */
export interface AgentDone {
  durationMs: number;
  kind: 'turn' | 'action' | 'error-ack' | string;
  /** El modelo que pedimos (configuración del servidor). */
  model?: string;
  /** El modelo que Google confirma que atendió (evento `interaction.completed`). */
  servedModel?: string | null;
  serviceTier?: string | null;
  usage?: AgentUsage;
  retries?: number;
  fallback?: boolean;
  /** La estructura que escribió Gemini, antes de que Python completara los datos. */
  llmOutput?: unknown;
}

/**
 * Cómo viaja cada mensaje A2UI: igual que en A2A, una "parte de datos" con su
 * tipo en `metadata.mimeType` (SSE no permite un Content-Type por evento).
 */
interface A2uiDataPart {
  kind: 'data';
  metadata?: { mimeType?: string };
  data: A2uiMessage;
}

/** Callbacks de un turno en streaming. */
export interface AgentTurnHandlers {
  /** Trozo de la narrativa del agente. */
  onText?(delta: string): void;
  /** Resumen de lo que el modelo está razonando (progreso mientras piensa). */
  onThought?(text: string): void;
  /** El servidor abrió una superficie nueva (ya existe en el renderer). */
  onSurface?(surfaceId: string): void;
  /** Mensaje A2UI recibido, tal cual llegó por la red. */
  onA2ui?(message: A2uiMessage, raw: string): void;
}

/** Error que el agente devolvió (`event: error`) o fallo de red. */
export class AgentError extends Error {
  constructor(
    message: string,
    readonly code = 'AGENT_ERROR',
  ) {
    super(message);
  }
}

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  RemoteAgentService — el navegador hablando A2UI con un servidor        ║
 * ║                                                                       ║
 * ║  POST /api/agent con la pregunta (o una acción) + las capacidades del   ║
 * ║  renderer (qué catálogos acepta). La respuesta es un stream SSE: cada   ║
 * ║  evento `a2ui` trae UN mensaje A2UI v1.0 (application/a2ui+json) que     ║
 * ║  se entrega al MISMO renderer que usa el modo local:                    ║
 * ║                                                                       ║
 * ║      renderer.processMessages([mensaje])   ← la línea que no cambia     ║
 * ║                                                                       ║
 * ║  Lo que el renderer no pueda pintar se le devuelve al agente como un    ║
 * ║  mensaje `error` (la validación en los dos lados de la frontera).       ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class RemoteAgentService {
  private readonly injector = inject(Injector);
  private readonly finance = inject(FinanceDataService);

  /** Base de la API. En desarrollo el proxy de Angular la reenvía al servidor Python. */
  readonly baseUrl = '/api';

  readonly health = signal<AgentHealth | null>(null);
  readonly healthError = signal<string | null>(null);

  /** Preguntas que un botón de seguimiento (de una superficie del servidor) pidió hacer. */
  readonly followUps = new Subject<string>();

  /** Superficies que creó el servidor: sus acciones viajan de vuelta a él. */
  private readonly serverSurfaces = new Set<string>();

  /** El renderer se obtiene perezosamente: config → renderer → actionHandler → aquí. */
  private get renderer(): A2uiRendererService {
    return this.injector.get(A2uiRendererService);
  }

  owns(surfaceId: string): boolean {
    return this.serverSurfaces.has(surfaceId);
  }

  requestFollowUp(question: string): void {
    this.followUps.next(question);
  }

  async checkHealth(): Promise<AgentHealth | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const health = (await res.json()) as AgentHealth;
      this.health.set(health);
      this.healthError.set(null);
      return health;
    } catch {
      this.health.set(null);
      this.healthError.set('No encuentro el agente en el servidor. Arráncalo con «pnpm dev» desde la raíz del repo.');
      return null;
    }
  }

  /** Un turno de conversación: la pregunta viaja, vuelven narrativa + mensajes A2UI. */
  ask(text: string, handlers: AgentTurnHandlers, signal?: AbortSignal): Promise<AgentDone> {
    return this.post({ text, metadata: this.metadata() }, handlers, signal);
  }

  /** Una acción de una superficie del servidor (slider, chips…) vuelve al agente. */
  async sendAction(action: ActionPayload): Promise<void> {
    const message = {
      version: A2UI_VERSION,
      action: {
        name: action.name,
        surfaceId: action.surfaceId,
        sourceComponentId: action.sourceComponentId,
        timestamp: action.timestamp,
        context: action.context ?? {},
      },
    };
    await this.post({ a2ui: message, metadata: this.metadata() }, {});
  }

  /** Qué viaja junto a cada petición: capacidades del renderer y la cuenta activa. */
  private metadata() {
    return {
      // v1.0: "a2uiRendererCapabilities": { "1.0": { "supportedCatalogIds": [...] } }
      a2uiRendererCapabilities: this.renderer.processor.getRendererCapabilities({ versions: [A2UI_VERSION] }),
      accountId: this.finance.selectedAccountId(),
    };
  }

  private async post(body: unknown, handlers: AgentTurnHandlers, signal?: AbortSignal): Promise<AgentDone> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new AgentError('No pude conectar con el agente. ¿Está corriendo el servidor? (pnpm dev)', 'NETWORK');
    }
    if (res.status >= 500) {
      // Con el agente apagado, el proxy de desarrollo responde 5xx con una página de error.
      throw new AgentError('No pude conectar con el agente. ¿Está corriendo el servidor? (pnpm dev)', 'NETWORK');
    }
    if (!res.ok || !res.body) {
      throw new AgentError(`El agente respondió ${res.status}: ${(await res.text()).slice(0, 200)}`, 'HTTP');
    }

    let done: AgentDone | null = null;
    for await (const event of readServerSentEvents(res.body)) {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      switch (event.event) {
        case 'text':
          handlers.onText?.(String(data['text'] ?? ''));
          break;
        case 'thought':
          handlers.onThought?.(String(data['text'] ?? ''));
          break;
        case 'a2ui': {
          const part = data as unknown as A2uiDataPart;
          if (part.kind !== 'data' || part.metadata?.mimeType !== A2UI_MIME_TYPE) {
            console.warn('[A2UI] Parte descartada: no es application/a2ui+json', part);
            break;
          }
          this.apply(part.data, event.data, handlers);
          break;
        }
        case 'error':
          throw new AgentError(String(data['message'] ?? 'Error del agente'), String(data['code'] ?? 'AGENT_ERROR'));
        case 'done':
          done = data as unknown as AgentDone;
          break;
      }
    }
    return done ?? { durationMs: 0, kind: 'unknown' };
  }

  /** Superficies creadas cuya estructura (`updateComponents`) aún no llegó. */
  private readonly pendingSurfaces = new Set<string>();

  /** Entrega UN mensaje al renderer; si no lo puede aplicar, se lo devuelve al agente. */
  private apply(message: A2uiMessage, raw: string, handlers: AgentTurnHandlers): void {
    const msg = message as {
      createSurface?: { surfaceId: string };
      updateComponents?: { surfaceId: string };
    };
    const created = msg.createSurface?.surfaceId;
    if (created) {
      this.serverSurfaces.add(created);
      this.pendingSurfaces.add(created);
    }

    // Uno a uno: si un mensaje falla, los demás se siguen aplicando (lo pide la spec).
    const errors = this.renderer.processor.processMessagesWithErrors([message]);
    handlers.onA2ui?.(message, raw);

    // La superficie se muestra cuando ya tiene estructura (su componente `root`).
    const structured = msg.updateComponents?.surfaceId;
    if (structured && this.pendingSurfaces.delete(structured)) handlers.onSurface?.(structured);

    for (const error of errors) {
      console.warn('[A2UI] El renderer rechazó un mensaje del servidor:', error);
      void this.post({ a2ui: error, metadata: this.metadata() }, {}).catch(() => undefined);
    }
  }
}

/** Lee un cuerpo `text/event-stream` (de un fetch POST) evento a evento. */
async function* readServerSentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const parsed = parseBlock(block);
        if (parsed) yield parsed;
      }
    }
    const tail = parseBlock(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(':')) continue; // comentario / keep-alive
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return data.length ? { event, data: data.join('\n') } : null;
}
