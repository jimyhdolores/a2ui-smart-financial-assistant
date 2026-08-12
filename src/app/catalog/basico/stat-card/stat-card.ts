import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { readNum, readStr } from '../../shared/data-access';

/**
 * 📊 StatCard — un solo número, en grande.
 *
 * Nivel Básico. Gemini Nano eligió QUÉ métrica mostrar (saldo, gasto, ingreso o
 * mayor gasto); TypeScript calculó el número con `FinanceAnalyticsService`. El
 * componente solo lo presenta: el LLM nunca ve ni produce el importe.
 */
@Component({
  selector: 'app-stat-card',
  imports: [DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
})
export class StatCard {
  readonly data = input<Record<string, unknown>>({});

  readonly label = computed(() => readStr(this.data(), 'label', 'Dato'));
  readonly value = computed(() => readNum(this.data(), 'value'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly icon = computed(() => readStr(this.data(), 'icon', 'insights'));
  readonly hint = computed(() => readStr(this.data(), 'hint'));
}
