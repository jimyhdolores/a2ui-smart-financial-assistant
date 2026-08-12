import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';
import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { makeSurfaceId } from '../../../models/a2ui-protocol';
import { A2uiMessageBuilder } from '../../../services/a2ui-message-builder';
import { FinanceAnalyticsService } from '../../../services/finance-analytics';
import { FinanceDataService } from '../../../services/finance-data';
import { CompositeDecision, GenUiService } from '../../../services/gen-ui';

/** Un mensaje del chat (usuario o asistente). */
interface ChatMessage {
  role: 'user' | 'assistant';
  /** Texto del usuario, o narrativa (streaming) del asistente. */
  text: string;
  /** Decisión de UI del LLM: 1..N secciones a componer (solo asistente). */
  decision?: CompositeDecision;
  /** Ids de las superficies A2UI de este turno (una por sección apilada). */
  surfaces?: string[];
  /** Stream JSONL A2UI real emitido en el turno (para el toggle didáctico). */
  a2uiStream?: string;
  /** Salida cruda del modelo (para el toggle didáctico). */
  raw?: string;
  /** Duración de la inferencia de enrutado, en ms. */
  durationMs?: number;
  /** true mientras el LLM decide el componente (muestra skeleton). */
  loading?: boolean;
  /** true mientras llega la narrativa token a token. */
  streaming?: boolean;
  /** Mensaje de error si algo falló. */
  error?: string;
}

/** Chip de sugerencia (consulta de ejemplo). */
interface Suggestion {
  icon: string;
  label: string;
  query: string;
}

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  Chat — pestaña "Asistente IA" (Generative UI conversacional)         ║
 * ║                                                                       ║
 * ║  El usuario escribe en lenguaje natural. Gemini Nano (1) enruta a un  ║
 * ║  componente + params, y (2) redacta el análisis en streaming. La      ║
 * ║  matemática la hace TypeScript, que arma el stream A2UI v0.9 real      ║
 * ║  (createSurface/updateComponents/updateDataModel) y lo entrega al      ║
 * ║  renderer oficial `@a2ui/angular`. Cada turno abre su propia          ║
 * ║  superficie; el toggle muestra el JSONL A2UI de verdad.               ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-chat',
  imports: [
    FormsModule,
    SurfaceComponent,
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

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly input = signal('');
  protected readonly busy = signal(false);

  /** Contador de turnos → superficie única por respuesta del asistente. */
  private turn = 0;

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
  }

  protected sendSuggestion(s: Suggestion): void {
    void this.send(s.query);
  }

  protected submit(): void {
    void this.send(this.input());
  }

  /**
   * 🧠 Flujo completo de un turno: enruta (componente + params), calcula el
   * `data` con TypeScript, emite el stream A2UI a su superficie y stream-ea la
   * narrativa.
   */
  private async send(rawQuery: string): Promise<void> {
    const query = rawQuery.trim();
    if (!query || this.busy()) return;

    this.input.set('');
    this.busy.set(true);
    this.push({ role: 'user', text: query });

    const assistant: ChatMessage = { role: 'assistant', text: '', loading: true };
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
      //     stream A2UI v0.9 y abre su PROPIA superficie apilada. Superficies
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

  private push(msg: ChatMessage): void {
    this.messages.update((m) => [...m, msg]);
  }

  /** Re-emite el array para que los signals reaccionen tras mutar un mensaje. */
  private commit(): void {
    this.messages.update((m) => [...m]);
  }
}
