import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { ChartConfig, radialChart } from '../shared/chart-theme';
import { readArr, readNum, readStr } from '../shared/data-access';

/**
 * 🎯 AppSavingsPlan — meta de ahorro con progreso y simulación.
 *
 * Progreso radial hacia la meta, ahorro mensual potencial (derivado de recortar
 * gastos hormiga) y una proyección a 3 meses. El LLM elige mostrarlo cuando el
 * usuario quiere ahorrar; los cálculos son deterministas.
 */
@Component({
  selector: 'app-savings-plan',
  imports: [DecimalPipe, MatCardModule, MatIconModule, NgApexchartsModule],
  templateUrl: './savings-plan.html',
  styleUrl: './savings-plan.scss',
})
export class SavingsPlan {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Tu plan de ahorro'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly goalName = computed(() => readStr(this.data(), 'goalName', 'Meta de ahorro'));
  readonly goalTarget = computed(() => readNum(this.data(), 'goalTarget'));
  readonly goalCurrent = computed(() => readNum(this.data(), 'goalCurrent'));
  readonly pct = computed(() => readNum(this.data(), 'pct'));
  readonly monthlyPotential = computed(() => readNum(this.data(), 'monthlyPotential'));
  readonly months = computed(() => readNum(this.data(), 'months'));
  readonly projection = computed(() =>
    readArr<{ label: string; amount: number }>(this.data(), 'projection'),
  );

  readonly radial = computed<ChartConfig>(() =>
    radialChart(this.pct(), this.goalName(), '#00a9a5'),
  );

  /** Altura máxima de las barras de proyección (para escalar el alto en %). */
  readonly maxProjection = computed(() =>
    Math.max(1, ...this.projection().map((p) => p.amount)),
  );
}
