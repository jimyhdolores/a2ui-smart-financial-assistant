import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { NgApexchartsModule } from 'ng-apexcharts';

import { barChart, ChartConfig } from '../../shared/chart-theme';
import { readArr, readBool, readNum, readStr } from '../../shared/data-access';

/**
 * AppAntExpense — HERO de gastos hormiga.
 *
 * Cambia por completo de aspecto según el veredicto (good / warning / risk):
 * borde, avatar, tinte de fondo e icono. Muestra el total hormiga, la comparación
 * con el mes anterior, el rango de fecha de agotamiento del saldo y un mini-gráfico
 * por categoría. El slider "¿y si…?" emite el % de recorte hacia el contenedor,
 * que recalcula la proyección al instante (matemática en TypeScript, no en el LLM).
 */
@Component({
  selector: 'app-ant-expense',
  imports: [DecimalPipe, MatCardModule, MatIconModule, MatSliderModule, NgApexchartsModule],
  templateUrl: './ant-expense.html',
  styleUrl: './ant-expense.scss',
})
export class AntExpense {
  readonly data = input<Record<string, unknown>>({});

  /** % de recorte de gastos hormiga elegido en el simulador (0-100). */
  readonly reduction = output<number>();

  readonly status = computed(() => readStr(this.data(), 'status', 'good'));
  readonly headline = computed(() => readStr(this.data(), 'headline', 'Análisis de gastos hormiga'));
  readonly message = computed(() => readStr(this.data(), 'message', ''));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly antTotal = computed(() => readNum(this.data(), 'antTotal'));
  readonly antCount = computed(() => readNum(this.data(), 'antCount'));
  readonly prevTotal = computed(() => readNum(this.data(), 'momPrevTotal'));
  readonly deltaPct = computed(() => readNum(this.data(), 'momDeltaPct'));
  readonly direction = computed(() => readStr(this.data(), 'momDirection', 'flat'));
  readonly daysLeft = computed(() => readNum(this.data(), 'daysLeft'));
  readonly fromDate = computed(() => readStr(this.data(), 'depletionFrom'));
  readonly toDate = computed(() => readStr(this.data(), 'depletionTo'));
  readonly interactive = computed(() => readBool(this.data(), 'interactive'));
  readonly reductionPct = computed(() => readNum(this.data(), 'reductionPct'));

  readonly categories = computed(() =>
    readArr<{ label: string; total: number }>(this.data(), 'byCategory'),
  );

  /** Icono grande del avatar según veredicto. */
  readonly icon = computed(
    () => ({ good: 'verified', warning: 'warning', risk: 'error' })[this.status()] ?? 'insights',
  );

  readonly directionIcon = computed(
    () =>
      ({ up: 'trending_up', down: 'trending_down', flat: 'trending_flat' })[this.direction()] ??
      'trending_flat',
  );

  readonly directionText = computed(() => {
    const pct = Math.abs(this.deltaPct());
    switch (this.direction()) {
      case 'up':
        return `Aumentó ${pct}% vs. el mes pasado`;
      case 'down':
        return `Disminuyó ${pct}% vs. el mes pasado`;
      default:
        return 'Se mantiene vs. el mes pasado';
    }
  });

  /** Mini-gráfico de barras por categoría hormiga. */
  readonly chart = computed<ChartConfig>(() => {
    const cats = this.categories();
    return barChart(
      cats.map((c) => c.label),
      cats.map((c) => c.total),
    );
  });

  protected onSlider(value: number): void {
    this.reduction.emit(value);
  }
}
