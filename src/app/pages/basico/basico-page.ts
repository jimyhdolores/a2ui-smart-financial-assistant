import { JsonPipe, NgComponentOutlet } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { BASICO_REGISTRY } from '../../catalog/basico/basico-catalog';
import { BasicoDecision } from '../../models/basico.model';
import { CATEGORY_META, CURRENCY } from '../../models/finance.model';
import { FinanceAnalyticsService } from '../../services/finance-analytics';
import { FinanceDataService } from '../../services/finance-data';
import { GenUiService } from '../../services/gen-ui';

/** Un mensaje del chat básico (usuario o asistente). */
interface BasicoMessage {
  role: 'user' | 'assistant';
  /** Texto del usuario (en `role: 'user'`). */
  text: string;
  /** Decisión de UI del LLM (solo asistente). */
  decision?: BasicoDecision;
  /** `data` calculado en TypeScript para el componente generado. */
  data?: Record<string, unknown>;
  /** Salida cruda del modelo (para el toggle didáctico). */
  raw?: string;
  /** Duración de la inferencia de enrutado, en ms. */
  durationMs?: number;
  /** true mientras el LLM decide el componente (muestra skeleton). */
  loading?: boolean;
  /** true mientras PlainAnswer llega token a token. */
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
 * ║  BasicoPage — NIVEL 1: Gemini Nano + routing, sin A2UI                 ║
 * ║                                                                       ║
 * ║  El pipeline de Generative UI en su forma más desnuda: la pregunta    ║
 * ║  del usuario → `routeBasic()` (schema de 3 componentes) → el modelo    ║
 * ║  elige UNO → TypeScript calcula el `data` → `NgComponentOutlet` pinta  ║
 * ║  el componente toy. Sin ApexCharts, sin protocolo A2UI: solo la idea   ║
 * ║  central "el LLM decide QUÉ mostrar, TypeScript pone los números".     ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-basico-page',
  imports: [
    FormsModule,
    JsonPipe,
    NgComponentOutlet,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './basico-page.html',
  styleUrl: './basico-page.scss',
})
export class BasicoPage {
  private readonly finance = inject(FinanceDataService);
  private readonly analytics = inject(FinanceAnalyticsService);
  protected readonly ai = inject(GenUiService);

  /** Mapa string→clase para NgComponentOutlet (3 entradas). */
  protected readonly registry = BASICO_REGISTRY;

  protected readonly messages = signal<BasicoMessage[]>([]);
  protected readonly input = signal('');
  protected readonly busy = signal(false);

  /** Contenedor de mensajes (para autoscroll al fondo). */
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** Consultas de ejemplo (cubren los 3 componentes toy). */
  protected readonly suggestions: Suggestion[] = [
    { icon: 'account_balance_wallet', label: 'Mi saldo', query: '¿Cuál es mi saldo disponible?' },
    { icon: 'shopping_cart', label: 'Gasto del mes', query: '¿Cuánto he gastado este mes?' },
    { icon: 'trending_up', label: 'Mayor gasto', query: '¿Cuál fue mi mayor gasto este mes?' },
    {
      icon: 'receipt_long',
      label: 'Últimos movimientos',
      query: 'Muéstrame mis últimos movimientos',
    },
    { icon: 'help', label: '¿Gasto hormiga?', query: '¿Qué es un gasto hormiga?' },
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
   * Flujo de un turno básico: enruta (componente + params), calcula el
   * `data` con TypeScript y, solo para PlainAnswer, stream-ea el texto.
   */
  private async send(rawQuery: string): Promise<void> {
    const query = rawQuery.trim();
    if (!query || this.busy()) return;

    this.input.set('');
    this.busy.set(true);
    this.push({ role: 'user', text: query });

    const assistant: BasicoMessage = { role: 'assistant', text: '', loading: true };
    this.push(assistant);

    const account = this.finance.selectedAccount();
    const context = this.analytics.buildContext(account);

    try {
      // 1.- Nano elige QUÉ componente mostrar (schema mínimo de 3).
      const { decision, raw, durationMs } = await this.ai.routeBasic(query, context);
      assistant.decision = decision;
      assistant.raw = raw;
      assistant.durationMs = durationMs;

      // 2.- La matemática la hace TypeScript, no el LLM.
      assistant.data = this.buildBasicData(decision);
      assistant.loading = false;

      // 3.- Solo PlainAnswer necesita una segunda pasada del modelo (texto en streaming).
      if (decision.componentToRender === 'PlainAnswer') {
        assistant.streaming = true;
        this.commit();
        await this.ai.answerStreaming(query, context, (acc) => {
          assistant.data = { text: acc };
          this.commit();
        });
        assistant.streaming = false;
      }
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
   * Arma el `data` de cada componente toy de forma determinista. Este es el
   * punto pedagógico: Nano eligió el componente y la intención; los números
   * salen de `FinanceAnalyticsService`, nunca del modelo.
   */
  private buildBasicData(decision: BasicoDecision): Record<string, unknown> {
    switch (decision.componentToRender) {
      case 'StatCard':
        return this.statData(String(decision.params['metric'] ?? 'balance'));
      case 'SimpleList': {
        const limit = Number(decision.params['limit']);
        return this.listData(Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 6);
      }
      case 'PlainAnswer':
      default:
        return { text: '' }; // se rellena con streaming
    }
  }

  /** Un solo número según la métrica que pidió el modelo. */
  private statData(metric: string): Record<string, unknown> {
    const account = this.finance.selectedAccount();
    switch (metric) {
      case 'spent':
        return {
          label: 'Gastado este mes',
          value: this.analytics.totalGasto(account),
          currency: CURRENCY,
          icon: 'shopping_cart',
        };
      case 'income':
        return {
          label: 'Ingreso mensual estimado',
          value: this.analytics.estimatedMonthlyIncome(),
          currency: CURRENCY,
          icon: 'payments',
        };
      case 'largest': {
        const gastos = account.transactions.filter((t) => t.type === 'gasto');
        if (!gastos.length) {
          return { label: 'Mayor gasto', value: 0, currency: CURRENCY, icon: 'trending_up' };
        }
        const top = gastos.reduce((max, t) => (t.amount > max.amount ? t : max), gastos[0]);
        return {
          label: `Mayor gasto: ${top.merchant}`,
          value: top.amount,
          currency: CURRENCY,
          icon: 'trending_up',
          hint: CATEGORY_META[top.category].label,
        };
      }
      case 'balance':
      default:
        return {
          label: account.kind === 'credito' ? 'Crédito disponible' : 'Saldo disponible',
          value: this.analytics.availableFunds(account),
          currency: CURRENCY,
          icon: 'account_balance_wallet',
        };
    }
  }

  /** Los `limit` movimientos más recientes, ya formateados. */
  private listData(limit: number): Record<string, unknown> {
    const account = this.finance.selectedAccount();
    const items = account.transactions.slice(0, limit).map((t) => ({
      label: t.merchant,
      sublabel: CATEGORY_META[t.category].label,
      icon: CATEGORY_META[t.category].icon,
      amount: t.amount,
      isIncome: t.type === 'ingreso',
    }));
    return { title: `Últimos ${items.length} movimientos`, currency: CURRENCY, items };
  }

  private push(msg: BasicoMessage): void {
    this.messages.update((m) => [...m, msg]);
  }

  /** Re-emite el array para que los signals reaccionen tras mutar un mensaje. */
  private commit(): void {
    this.messages.update((m) => [...m]);
  }
}
