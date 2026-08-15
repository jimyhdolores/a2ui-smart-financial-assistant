import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgApexchartsModule } from 'ng-apexcharts';

import { FinanceComponent } from '../finance-component.base';
import { ChartConfig, gaugeChart, STATUS_COLOR } from '../../shared/chart-theme';

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
export class CreditAdvisor extends FinanceComponent {
  readonly title = computed(() => this.str('title', 'Tu salud crediticia'));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly limit = computed(() => this.num('limit'));
  readonly debt = computed(() => this.num('debt'));
  readonly available = computed(() => this.num('available'));
  readonly usagePct = computed(() => this.num('usagePct'));
  readonly capacity = computed(() => this.num('capacity'));
  readonly minPayment = computed(() => this.num('minPayment'));
  readonly income = computed(() => this.num('income'));
  readonly riskLevel = computed(() => this.str('riskLevel', 'low'));
  readonly recommendation = computed(() => this.str('recommendation'));

  // Campos de simulación (solo presentes si el usuario preguntó por una compra)
  readonly product = computed(() => this.str('product'));
  readonly price = computed(() => this.num('price'));
  readonly months = computed(() => this.num('months'));
  readonly monthlyPayment = computed(() => this.num('monthlyPayment'));
  readonly dti = computed(() => this.num('dti'));
  readonly verdict = computed(() => this.str('verdict'));
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
