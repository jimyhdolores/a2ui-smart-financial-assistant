import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { ChartConfig, gaugeChart, STATUS_COLOR } from '../../shared/chart-theme';
import { readNum, readStr } from '../../shared/data-access';

/**
 * 💳 AppCreditAdvisor — salud crediticia y simulación de compra a crédito.
 *
 * Gauge radial de capacidad de pago, barra de endeudamiento (uso de la línea),
 * cuota mensual estimada y veredicto. Toda la aritmética (cuota = precio·1.15 /
 * meses, DTI, capacidad) la hace TypeScript; el LLM solo eligió el componente y
 * extrajo `product/price/months` de la pregunta en lenguaje natural.
 */
@Component({
  selector: 'app-credit-advisor',
  imports: [DecimalPipe, MatCardModule, MatIconModule, NgApexchartsModule],
  templateUrl: './credit-advisor.html',
  styleUrl: './credit-advisor.scss',
})
export class CreditAdvisor {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Tu salud crediticia'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly limit = computed(() => readNum(this.data(), 'limit'));
  readonly debt = computed(() => readNum(this.data(), 'debt'));
  readonly available = computed(() => readNum(this.data(), 'available'));
  readonly usagePct = computed(() => readNum(this.data(), 'usagePct'));
  readonly capacity = computed(() => readNum(this.data(), 'capacity'));
  readonly minPayment = computed(() => readNum(this.data(), 'minPayment'));
  readonly income = computed(() => readNum(this.data(), 'income'));
  readonly riskLevel = computed(() => readStr(this.data(), 'riskLevel', 'low'));
  readonly recommendation = computed(() => readStr(this.data(), 'recommendation'));

  // Campos de simulación (solo presentes si el usuario preguntó por una compra)
  readonly product = computed(() => readStr(this.data(), 'product'));
  readonly price = computed(() => readNum(this.data(), 'price'));
  readonly months = computed(() => readNum(this.data(), 'months'));
  readonly monthlyPayment = computed(() => readNum(this.data(), 'monthlyPayment'));
  readonly dti = computed(() => readNum(this.data(), 'dti'));
  readonly verdict = computed(() => readStr(this.data(), 'verdict'));
  readonly hasSimulation = computed(() => this.price() > 0 && this.months() > 0);

  readonly riskColor = computed(() => STATUS_COLOR[this.riskLevel()] ?? STATUS_COLOR['low']);
  readonly gauge = computed<ChartConfig>(() =>
    gaugeChart(Math.round(this.capacity()), 'Capacidad de pago', this.riskColor()),
  );

  readonly riskLabel = computed(
    () =>
      ({ low: 'Saludable', medium: 'Moderado', high: 'En riesgo' })[this.riskLevel()] ??
      'Saludable',
  );
  readonly verdictLabel = computed(
    () =>
      ({
        low: 'Te lo puedes permitir',
        medium: 'Ajustado — piénsalo bien',
        high: 'No es recomendable ahora',
      })[this.verdict()] ?? '',
  );
  readonly verdictIcon = computed(
    () =>
      ({ low: 'check_circle', medium: 'warning', high: 'dangerous' })[this.verdict()] ??
      'info',
  );
}
