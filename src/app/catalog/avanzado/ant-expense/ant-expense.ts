import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { NgApexchartsModule } from 'ng-apexcharts';

import { A2UI_ACTIONS } from '../../../models/a2ui-protocol';
import { FinanceComponent } from '../finance-component.base';
import { barChart, ChartConfig } from '../../shared/chart-theme';

/**
 * 🐜 AppAntExpense — HERO de gastos hormiga.
 *
 * Cambia por completo de aspecto según el veredicto (🟢 good / 🟡 warning / 🔴 risk):
 * borde, avatar, tinte de fondo e icono. Muestra el total hormiga, la comparación
 * con el mes anterior, el rango de fecha de agotamiento del saldo y un mini-gráfico
 * por categoría. El slider "¿y si…?" emite una `action.event` de A2UI con el % de
 * recorte; el `actionHandler` recalcula la proyección al instante en TypeScript
 * (matemática determinista) y devuelve un `updateDataModel` sobre esta superficie.
 */
@Component({
  selector: 'app-ant-expense',
  imports: [DecimalPipe, MatCardModule, MatIconModule, MatSliderModule, NgApexchartsModule],
  templateUrl: './ant-expense.html',
  styleUrl: './ant-expense.scss',
})
export class AntExpense extends FinanceComponent {
  readonly status = computed(() => this.str('status', 'good'));
  readonly headline = computed(() => this.str('headline', 'Análisis de gastos hormiga'));
  readonly message = computed(() => this.str('message', ''));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly antTotal = computed(() => this.num('antTotal'));
  readonly antCount = computed(() => this.num('antCount'));
  readonly prevTotal = computed(() => this.num('momPrevTotal'));
  readonly deltaPct = computed(() => this.num('momDeltaPct'));
  readonly direction = computed(() => this.str('momDirection', 'flat'));
  readonly daysLeft = computed(() => this.num('daysLeft'));
  readonly fromDate = computed(() => this.str('depletionFrom'));
  readonly toDate = computed(() => this.str('depletionTo'));
  readonly interactive = computed(() => this.bool('interactive'));
  readonly reductionPct = computed(() => this.num('reductionPct'));

  readonly categories = computed(() =>
    this.arr<{ label: string; total: number }>('byCategory'),
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

  /**
   * El slider "¿y si recorto X%?" ya no emite un `output` local: dispara una
   * `action.event` A2UI que el `actionHandler` global traduce en recálculo TS.
   */
  protected onSlider(value: number): void {
    this.dispatch(A2UI_ACTIONS.simulateReduction, { pct: value });
  }
}
