import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular';
import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { makeSurfaceId } from '../../../models/a2ui-protocol';
import { A2uiMessageBuilder } from '../../../services/a2ui-message-builder';
import { AgentMode, AgentModeService } from '../../../services/agent-mode';
import { FinanceAnalyticsService } from '../../../services/finance-analytics';
import { FinanceDataService } from '../../../services/finance-data';
import { CompositeDecision, GenUiService } from '../../../services/gen-ui';
import { AgentUsage, RemoteAgentService } from '../../../services/remote-agent';

/** Un mensaje del chat (usuario o asistente). */
interface ChatMessage {
  role: 'user' | 'assistant';
  /** Texto del usuario, o narrativa (streaming) del asistente. */
  text: string;
  /** Dónde vivía el agente que respondió. */
  origin?: AgentMode;
  /** Decisión de UI del LLM: 1..N secciones a componer (solo asistente, modo local). */
  decision?: CompositeDecision;
  /** Ids de las superficies A2UI de este turno. */
  surfaces?: string[];
  /** Stream A2UI real emitido o recibido en el turno (para el toggle didáctico). */
  a2uiStream?: string;
  /** Salida cruda del modelo: el enrutado de Nano (local) o la estructura de Gemini (servidor). */
  raw?: string;
  /** Duración del turno, en ms. */
  durationMs?: number;
  /** Modelo que pedimos (configuración del servidor). */
  model?: string;
  /** Modelo que Google confirma que atendió la respuesta (no lo pone nuestro código). */
  servedModel?: string;
  /** Tokens que Google reporta (incluidos los de razonamiento). */
  usage?: AgentUsage;
  /** Lo último que el modelo del servidor contó que está razonando. */
  thought?: string;
  /** El servidor tuvo que reintentar o usar la pantalla de respaldo. */
  note?: string;
  /** true mientras el LLM decide el componente (muestra skeleton). */
  loading?: boolean;
  /** true mientras llega la narrativa token a token. */
  streaming?: boolean;
  /** Mensaje de error si algo falló. */
  error?: string;
}

/**
 * Los resúmenes de razonamiento de Gemini llegan como párrafos que empiezan con un
 * título en negrita ("**Comparing Expenses** …"): en el esqueleto basta el título.
 */
function thoughtTitle(text: string): string {
  const bold = /\*\*(.+?)\*\*/.exec(text);
  const title = (bold?.[1] ?? text).trim();
  return title.length > 90 ? `${title.slice(0, 90)}…` : title;
}

/** Chip de sugerencia (consulta de ejemplo). */
interface Suggestion {
  icon: string;
  label: string;
  query: string;
}

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  Chat — NIVEL 3: la misma decisión, servida por el protocolo A2UI      ║
 * ║                                                                       ║
 * ║  Con un interruptor para elegir DÓNDE vive el agente:                  ║
 * ║                                                                       ║
 * ║   · En tu navegador (Gemini Nano): el enrutado es IDÉNTICO al del      ║
 * ║     nivel Intermedio; TypeScript arma el stream A2UI v1.0 y lo entrega ║
 * ║     al renderer oficial `@a2ui/angular`. Sin red.                      ║
 * ║   · En el servidor (Gemini, modelo grande): un agente Python compone   ║
 * ║     la pantalla con el catálogo y manda los mensajes A2UI por la red.  ║
 * ║                                                                       ║
 * ║  En ambos casos todo termina en `renderer.processMessages(...)`: el    ║
 * ║  renderer, el catálogo y los componentes son exactamente los mismos.   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-chat',
  imports: [
    DecimalPipe,
    FormsModule,
    SurfaceComponent,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  private readonly finance = inject(FinanceDataService);
  private readonly analytics = inject(FinanceAnalyticsService);
  private readonly renderer = inject(A2uiRendererService);
  private readonly builder = inject(A2uiMessageBuilder);
  protected readonly ai = inject(GenUiService);
  protected readonly agentMode = inject(AgentModeService);
  protected readonly remote = inject(RemoteAgentService);

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly input = signal('');
  protected readonly busy = signal(false);

  /** Contador de turnos → superficie única por respuesta del asistente (modo local). */
  private turn = 0;

  /** Cancela el turno remoto en curso si se sale de la página. */
  private readonly abort = new AbortController();

  /** Contenedor de mensajes (para autoscroll al fondo). */
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** Consultas de ejemplo. La primera compone un panel completo (varias superficies). */
  protected readonly suggestions: Suggestion[] = [
    {
      icon: 'dashboard',
      label: 'Resumen de mi mes',
      query: 'Hazme un resumen completo de mis finanzas de este mes',
    },
    {
      icon: 'pie_chart',
      label: '¿En qué gasto más?',
      query: '¿En qué estoy gastando más dinero este mes?',
    },
    {
      icon: 'emoji_nature',
      label: 'Mis gastos hormiga',
      query: '¿Qué gastos hormiga tengo y cómo van?',
    },
    {
      icon: 'qr_code_2',
      label: 'Solo mis Yape',
      query: 'Muéstrame únicamente los pagos que hice con Yape',
    },
    {
      icon: 'trending_up',
      label: 'Mi mayor compra',
      query: '¿Cuál fue mi compra más grande este mes?',
    },
    {
      icon: 'savings',
      label: '¿Cómo ahorro más?',
      query: '¿Cómo puedo ahorrar más dinero cada mes?',
    },
    {
      icon: 'credit_card',
      label: 'Celular a crédito',
      query: 'Quiero comprar un celular de $1200 a crédito en 12 cuotas, ¿me conviene?',
    },
  ];

  constructor() {
    // Autoscroll al fondo cuando cambian los mensajes (streaming incluido).
    afterRenderEffect(() => {
      this.messages();
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });

    // Los botones "siguiente pregunta" que compone el agente del servidor.
    this.remote.followUps
      .pipe(takeUntilDestroyed())
      .subscribe((question) => void this.send(question, 'server'));

    inject(DestroyRef).onDestroy(() => this.abort.abort());

    if (this.agentMode.isServer()) void this.remote.checkHealth();
  }

  /** ¿Se puede escribir? En modo servidor no hace falta Gemini Nano. */
  protected canAsk(): boolean {
    return this.agentMode.isServer() || this.ai.isSupported();
  }

  protected setMode(mode: AgentMode): void {
    this.agentMode.set(mode);
    if (mode === 'server') void this.remote.checkHealth();
  }

  protected sendSuggestion(s: Suggestion): void {
    void this.send(s.query);
  }

  protected submit(): void {
    void this.send(this.input());
  }

  private async send(rawQuery: string, forceMode?: AgentMode): Promise<void> {
    const query = rawQuery.trim();
    if (!query || this.busy()) return;
    const mode = forceMode ?? this.agentMode.mode();
    if (mode === 'server') return this.sendRemote(query);
    return this.sendLocal(query);
  }

  /**
   * MODO LOCAL — flujo completo de un turno en el navegador: enruta (componente +
   * params) con Gemini Nano, calcula el `data` con TypeScript, emite el stream
   * A2UI a su superficie y stream-ea la narrativa.
   */
  private async sendLocal(query: string): Promise<void> {
    this.input.set('');
    this.busy.set(true);
    this.push({ role: 'user', text: query });

    const assistant: ChatMessage = { role: 'assistant', text: '', loading: true, origin: 'local' };
    this.push(assistant);

    const account = this.finance.selectedAccount();
    const context = this.analytics.buildContext(account);

    try {
      // 1.- Enrutado estructurado → qué componentes (1..N) + parámetros.
      const { decision, raw, durationMs } = await this.ai.route(query, context);
      assistant.decision = decision;
      assistant.raw = raw;
      assistant.durationMs = durationMs;

      // 2.- Por cada sección: TypeScript calcula el `data`, lo traduce al
      //     stream A2UI v1.0 y abre su PROPIA superficie apilada. Superficies
      //     independientes ⇒ el round-trip (slider/filtros) de cada una es aislado.
      const turn = ++this.turn;
      const surfaces: string[] = [];
      const streams: string[] = [];
      decision.sections.forEach((s, i) => {
        const data = this.analytics.buildData(s.componentToRender, s.params, account);
        const surfaceId = makeSurfaceId(turn, i);
        const stream = this.builder.build(s.componentToRender, data, surfaceId);
        this.renderer.processMessages(stream);
        surfaces.push(surfaceId);
        streams.push(stream.map((m) => JSON.stringify(m, null, 2)).join('\n'));
      });
      assistant.surfaces = surfaces;
      assistant.a2uiStream = streams.join('\n\n');
      assistant.loading = false;
      assistant.streaming = true;
      this.commit();

      // 3.- Narrativa en streaming (efecto máquina de escribir real).
      await this.ai.answerStreaming(query, context, (acc) => {
        assistant.text = acc;
        this.commit();
      });
      assistant.streaming = false;
      this.commit();
    } catch (err) {
      assistant.loading = false;
      assistant.streaming = false;
      assistant.error = err instanceof Error ? err.message : String(err);
      this.commit();
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * MODO SERVIDOR — la pregunta cruza la red. El agente Python (Gemini + datos)
   * devuelve un stream: narrativa (texto) y mensajes A2UI v1.0, que se entregan
   * uno a uno al MISMO renderer. Aquí no se calcula nada: solo se pinta.
   */
  private async sendRemote(query: string): Promise<void> {
    this.input.set('');
    this.busy.set(true);
    this.push({ role: 'user', text: query });

    const assistant: ChatMessage = {
      role: 'assistant',
      text: '',
      loading: true,
      origin: 'server',
      surfaces: [],
    };
    this.push(assistant);
    const received: string[] = [];

    try {
      const done = await this.remote.ask(
        query,
        {
          onThought: (text) => {
            assistant.thought = thoughtTitle(text);
            this.commit();
          },
          onText: (delta) => {
            assistant.text += delta;
            assistant.loading = false;
            assistant.streaming = true;
            this.commit();
          },
          onSurface: (surfaceId) => {
            assistant.surfaces = [...(assistant.surfaces ?? []), surfaceId];
            assistant.loading = false;
            this.commit();
          },
          onA2ui: (_message, raw) => {
            received.push(raw);
          },
        },
        this.abort.signal,
      );
      assistant.durationMs = done.durationMs;
      assistant.model = done.model;
      assistant.servedModel = done.servedModel ?? undefined;
      assistant.usage = done.usage;
      assistant.a2uiStream = received.join('\n');
      if (done.llmOutput) assistant.raw = JSON.stringify(done.llmOutput, null, 2);
      if (done.fallback) assistant.note = 'El modelo no logró una pantalla válida: se muestra la de respaldo.';
      else if (done.retries) assistant.note = 'El servidor corrigió la primera respuesta del modelo (1 reintento).';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      assistant.error = err instanceof Error ? err.message : String(err);
    } finally {
      assistant.loading = false;
      assistant.streaming = false;
      this.commit();
      this.busy.set(false);
    }
  }

  private push(msg: ChatMessage): void {
    this.messages.update((m) => [...m, msg]);
  }

  /** Re-emite el array para que los signals reaccionen tras mutar un mensaje. */
  private commit(): void {
    this.messages.update((m) => [...m]);
  }
}
