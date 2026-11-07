import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { FinanceComponent } from '../finance-component.base';

interface Tip {
  icon: string;
  title: string;
  detail: string;
  impact: number;
}
interface Alert {
  icon: string;
  text: string;
}

/**
 * AppRecommendations — consejos accionables.
 *
 * Chip de nivel de riesgo, tarjetas de consejo con impacto estimado (dinero que
 * podrías liberar al mes) y alertas. Los consejos e importes son deterministas;
 * el LLM decidió que este era el componente adecuado para la intención.
 */
@Component({
  selector: 'app-recommendations',
  imports: [DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
})
export class Recommendations extends FinanceComponent {
  readonly title = computed(() => this.str('title', 'Recomendaciones para ti'));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly riskLevel = computed(() => this.str('riskLevel', 'low'));
  readonly potentialTotal = computed(() => this.num('potentialTotal'));
  readonly tips = computed(() => this.arr<Tip>('tips'));
  readonly alerts = computed(() => this.arr<Alert>('alerts'));

  readonly riskLabel = computed(
    () =>
      ({ low: 'Riesgo bajo', medium: 'Riesgo moderado', high: 'Riesgo alto' })[this.riskLevel()] ??
      'Riesgo bajo',
  );
  readonly riskIcon = computed(
    () =>
      ({ low: 'sentiment_satisfied', medium: 'sentiment_neutral', high: 'sentiment_dissatisfied' })[
        this.riskLevel()
      ] ?? 'sentiment_satisfied',
  );
}
