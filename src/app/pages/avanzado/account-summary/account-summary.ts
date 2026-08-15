import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';
import { A2uiRendererService, SurfaceComponent } from '@a2ui/angular/v0_9';

import { Account, CATEGORY_META, CURRENCY, PAYMENT_METHOD_META } from '../../../models/finance.model';
import { A2uiMessageBuilder } from '../../../services/a2ui-message-builder';
import { FinanceAnalyticsService } from '../../../services/finance-analytics';
import { FinanceDataService } from '../../../services/finance-data';
import { ChartConfig, donutChart } from '../../../catalog/shared/chart-theme';

/** Superficie A2UI dedicada del hero de gastos hormiga del dashboard. */
const ANT_SURFACE = 'summary-ant';

interface RecentRow {
  id: string;
  date: string;
  merchant: string;
  category: string;
  icon: string;
  amount: number;
  methodLabel: string;
  methodIcon: string;
  isIncome: boolean;
  isAnt: boolean;
}

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  AccountSummary — pestaña "Resumen de cuenta"                          ║
 * ║                                                                       ║
 * ║  Cabecera de saldo + HERO de gastos hormiga (veredicto del LLM con    ║
 * ║  fallback determinista) con el simulador "¿y si…?" en vivo + dona de  ║
 * ║  categorías + movimientos recientes. Todos los números los calcula    ║
 * ║  TypeScript; el LLM solo redacta el veredicto.                        ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-account-summary',
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule, NgApexchartsModule, SurfaceComponent],
  templateUrl: './account-summary.html',
  styleUrl: './account-summary.scss',
})
export class AccountSummary {
  private readonly finance = inject(FinanceDataService);
  private readonly analytics = inject(FinanceAnalyticsService);
  private readonly renderer = inject(A2uiRendererService);
  private readonly builder = inject(A2uiMessageBuilder);

  /** "Hoy" para calcular el offset de mes de cada movimiento. */
  private readonly today = new Date();

  protected readonly currency = CURRENCY;
  protected readonly account = this.finance.selectedAccount;

  /** Id de la superficie A2UI del hero (usada por `<a2ui-v09-surface>`). */
  protected readonly antSurface = ANT_SURFACE;

  /** Movimientos por página en la lista. */
  protected readonly pageSize = 6;

  /** Mes visible: 0 = actual, 1 = anterior, 2 = hace dos meses… */
  protected readonly monthOffset = signal(0);
  /** Página actual dentro del mes visible. */
  protected readonly pageIndex = signal(0);

  constructor() {
    effect(() => {
      const acc = this.finance.selectedAccount();
      this.monthOffset.set(0);
      this.pageIndex.set(0);
      this.renderAntHero(acc);
    });
  }

  /**
   * Emite el stream A2UI del hero de gastos hormiga a su superficie dedicada.
   * El slider "¿y si…?" ya NO vive aquí: mueve el % vía `action.event` y el
   * `A2uiActionService` recalcula la proyección con `updateDataModel`.
   */
  private renderAntHero(acc: Account): void {
    const fallback = this.analytics.antVerdictFallback(acc);
    const data = this.analytics.antData(acc, fallback, 0, true);
    this.renderer.processMessages(this.builder.build('AppAntExpense', data, ANT_SURFACE));
  }

  // ─── Datos derivados (deterministas) ───────────────────────────────────────

  /** Saldo mostrado en la cabecera + subtítulo contextual. */
  protected readonly available = computed(() => this.analytics.availableFunds(this.account()));
  protected readonly isCredit = computed(() => this.account().kind === 'credito');
  protected readonly spent = computed(() => this.analytics.totalGasto(this.account(), 'current'));

  /** Dona de categorías del mes. */
  protected readonly donut = computed<ChartConfig | null>(() => {
    const cats = this.analytics.categoryBreakdown(this.account(), 'current');
    if (!cats.length) return null;
    return donutChart(
      cats.map((c) => c.label),
      cats.map((c) => c.total),
    );
  });

  // ─── Movimientos: navegación por mes + paginación ──────────────────────────

  /** Meses hacia atrás con datos (el dataset genera historial; el más viejo marca el tope). */
  protected readonly maxOffset = computed(() => {
    const txs = this.account().transactions;
    let max = 0;
    for (const t of txs) {
      const o = this.offsetOf(t.date);
      if (o > max) max = o;
    }
    return max;
  });

  protected readonly canOlder = computed(() => this.monthOffset() < this.maxOffset());
  protected readonly canNewer = computed(() => this.monthOffset() > 0);

  /** Etiqueta del mes visible, p. ej. "Julio 2026" (con mayúscula inicial). */
  protected readonly monthLabel = computed(() => {
    const d = new Date(this.today.getFullYear(), this.today.getMonth() - this.monthOffset(), 1);
    let label: string;
    try {
      label = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(d);
    } catch {
      label = d.toLocaleDateString();
    }
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  /** Movimientos del mes visible (orden descendente por fecha ya viene del servicio). */
  private readonly monthTx = computed(() =>
    this.account().transactions.filter((t) => this.offsetOf(t.date) === this.monthOffset()),
  );

  /** Filas listas para pintar (todas las del mes; la paginación recorta después). */
  protected readonly monthRows = computed<RecentRow[]>(() =>
    this.monthTx().map((t) => ({
      id: t.id,
      date: this.formatDate(t.date),
      merchant: t.merchant,
      category: CATEGORY_META[t.category].label,
      icon: CATEGORY_META[t.category].icon,
      amount: t.amount,
      methodLabel: PAYMENT_METHOD_META[t.method].label,
      methodIcon: PAYMENT_METHOD_META[t.method].icon,
      isIncome: t.type === 'ingreso',
      isAnt: this.analytics.isAnt(t),
    })),
  );

  /** Gasto total del mes visible (solo egresos). */
  protected readonly monthSpent = computed(() =>
    this.monthTx().reduce((sum, t) => (t.type === 'gasto' ? sum + t.amount : sum), 0),
  );

  /** Nº de páginas del mes visible (mínimo 1 para no romper el pager). */
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.monthRows().length / this.pageSize)));

  /** Filas de la página actual. */
  protected readonly pagedRows = computed<RecentRow[]>(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.monthRows().slice(start, start + this.pageSize);
  });

  // ─── Handlers de navegación ────────────────────────────────────────────────

  protected olderMonth(): void {
    if (!this.canOlder()) return;
    this.monthOffset.update((o) => o + 1);
    this.pageIndex.set(0);
  }

  protected newerMonth(): void {
    if (!this.canNewer()) return;
    this.monthOffset.update((o) => o - 1);
    this.pageIndex.set(0);
  }

  protected prevPage(): void {
    this.pageIndex.update((p) => Math.max(0, p - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((p) => Math.min(this.pageCount() - 1, p + 1));
  }

  /** Meses de diferencia entre "hoy" y una fecha (0 = mes actual). */
  private offsetOf(d: Date): number {
    return (this.today.getFullYear() - d.getFullYear()) * 12 + (this.today.getMonth() - d.getMonth());
  }

  private formatDate(d: Date): string {
    try {
      return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(d);
    } catch {
      return d.toLocaleDateString();
    }
  }
}
