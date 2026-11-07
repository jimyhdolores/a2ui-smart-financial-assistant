import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { FinanceComponent } from '../finance-component.base';
import { ChartConfig, radialChart } from '../../shared/chart-theme';

/**
 * AppSavingsPlan — meta de ahorro con progreso y simulación.
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
export class SavingsPlan extends FinanceComponent {
  readonly title = computed(() => this.str('title', 'Tu plan de ahorro'));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly goalName = computed(() => this.str('goalName', 'Meta de ahorro'));
  readonly goalTarget = computed(() => this.num('goalTarget'));
  readonly goalCurrent = computed(() => this.num('goalCurrent'));
  readonly pct = computed(() => this.num('pct'));
  readonly monthlyPotential = computed(() => this.num('monthlyPotential'));
  readonly months = computed(() => this.num('months'));
  readonly projection = computed(() =>
    this.arr<{ label: string; amount: number }>('projection'),
  );

  readonly radial = computed<ChartConfig>(() =>
    radialChart(this.pct(), this.goalName(), '#00a9a5'),
  );

  /** Altura máxima de las barras de proyección (para escalar el alto en %). */
  readonly maxProjection = computed(() =>
    Math.max(1, ...this.projection().map((p) => p.amount)),
  );
}
