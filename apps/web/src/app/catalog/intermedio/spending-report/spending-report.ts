import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { areaChart, ChartConfig, donutChart } from '../../shared/chart-theme';
import { readArr, readNum, readStr } from '../../shared/data-access';

interface CategoryRow {
  label: string;
  icon: string;
  total: number;
  pct: number;
}
interface MovementRow {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  icon: string;
}

/**
 * AppSpendingReport — reporte ejecutivo de gastos.
 *
 * KPIs (total, nº de movimientos, comparación mensual), dona por categoría,
 * tendencia semanal y top de movimientos. Todos los números los calcula el
 * servicio de analítica; el LLM solo decidió mostrar este componente.
 */
@Component({
  selector: 'app-spending-report',
  imports: [DecimalPipe, MatCardModule, MatIconModule, NgApexchartsModule],
  templateUrl: './spending-report.html',
  styleUrl: './spending-report.scss',
})
export class SpendingReport {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Reporte de gastos'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly total = computed(() => readNum(this.data(), 'total'));
  readonly txCount = computed(() => readNum(this.data(), 'txCount'));
  readonly topCategory = computed(() => readStr(this.data(), 'topCategory', '—'));
  readonly topCategoryTotal = computed(() => readNum(this.data(), 'topCategoryTotal'));
  readonly antTotal = computed(() => readNum(this.data(), 'antTotal'));
  readonly deltaPct = computed(() => readNum(this.data(), 'momDeltaPct'));
  readonly direction = computed(() => readStr(this.data(), 'momDirection', 'flat'));

  readonly categories = computed(() => readArr<CategoryRow>(this.data(), 'categories'));
  readonly trend = computed(() => readArr<{ label: string; value: number }>(this.data(), 'trend'));
  readonly movements = computed(() => readArr<MovementRow>(this.data(), 'topMovements'));

  readonly directionIcon = computed(
    () =>
      ({ up: 'trending_up', down: 'trending_down', flat: 'trending_flat' })[this.direction()] ??
      'trending_flat',
  );
  readonly directionText = computed(() => {
    const pct = Math.abs(this.deltaPct());
    if (this.direction() === 'up') return `+${pct}% vs. mes pasado`;
    if (this.direction() === 'down') return `−${pct}% vs. mes pasado`;
    return 'Estable vs. mes pasado';
  });

  readonly donut = computed<ChartConfig>(() => {
    const cats = this.categories();
    return donutChart(
      cats.map((c) => c.label),
      cats.map((c) => c.total),
    );
  });

  readonly area = computed<ChartConfig>(() => {
    const t = this.trend();
    return areaChart(
      t.map((p) => p.label),
      t.map((p) => p.value),
    );
  });
}
