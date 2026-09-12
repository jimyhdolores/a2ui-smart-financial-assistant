import { JsonPipe, NgComponentOutlet } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { INTERMEDIO_REGISTRY } from '../../../catalog/intermedio/intermedio-catalog';
import { UiComponent } from '../../../models/ui-router.model';
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
  /** Componentes a apilar, cada uno con su `data` calculado en TypeScript. */
  blocks?: Array<{ component: UiComponent; data: Record<string, unknown> }>;
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
 * ║  Chat — NIVEL 2: catálogo rico, render casero (sin protocolo A2UI)    ║
 * ║                                                                       ║
 * ║  El usuario escribe en lenguaje natural. Gemini Nano (1) enruta a     ║
 * ║  1..N componentes + params, y (2) redacta el análisis en streaming.   ║
 * ║  La matemática la hace TypeScript; los componentes se apilan con      ║
 * ║  `@for` + NgComponentOutlet sobre INTERMEDIO_REGISTRY. Cada respuesta ║
 * ║  muestra los ms de inferencia y un toggle con la decisión del modelo. ║
 * ║                                                                       ║
 * ║  El nivel Avanzado parte de esta MISMA decisión (`route()`) y solo    ║
 * ║  cambia el motor de render por el protocolo A2UI v0.9.                ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-chat',
  imports: [
    FormsModule,
    JsonPipe,
    NgComponentOutlet,
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
  protected readonly ai = inject(GenUiService);

  /** Mapa string→clase para NgComponentOutlet. */
  protected readonly registry = INTERMEDIO_REGISTRY;

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly input = signal('');
  protected readonly busy = signal(false);

  /** Contenedor de mensajes (para autoscroll al fondo). */
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** Consultas de ejemplo. La primera compone un panel completo (varias secciones). */
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
   * Flujo completo de un turno: enruta (componente + params), calcula el
   * `data` con TypeScript, renderiza el componente y stream-ea la narrativa.
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
      // 2.- La matemática la hace TypeScript, no el LLM: un `data` por sección.
      assistant.blocks = decision.sections.map((s) => ({
        component: s.componentToRender,
        data: this.analytics.buildData(s.componentToRender, s.params, account),
      }));
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
