import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { FinanceComponent } from '../finance-component.base';
import { areaChart, ChartConfig, donutChart } from '../../shared/chart-theme';

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
 * 📊 AppSpendingReport — reporte ejecutivo de gastos.
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
export class SpendingReport extends FinanceComponent {
  readonly title = computed(() => this.str('title', 'Reporte de gastos'));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly total = computed(() => this.num('total'));
  readonly txCount = computed(() => this.num('txCount'));
  readonly topCategory = computed(() => this.str('topCategory', '—'));
  readonly topCategoryTotal = computed(() => this.num('topCategoryTotal'));
  readonly antTotal = computed(() => this.num('antTotal'));
  readonly deltaPct = computed(() => this.num('momDeltaPct'));
  readonly direction = computed(() => this.str('momDirection', 'flat'));

  readonly categories = computed(() => this.arr<CategoryRow>('categories'));
  readonly trend = computed(() => this.arr<{ label: string; value: number }>('trend'));
  readonly movements = computed(() => this.arr<MovementRow>('topMovements'));

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
