import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { readArr, readNum, readStr } from '../../shared/data-access';

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
 * 💡 AppRecommendations — consejos accionables.
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
export class Recommendations {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Recomendaciones para ti'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly riskLevel = computed(() => readStr(this.data(), 'riskLevel', 'low'));
  readonly potentialTotal = computed(() => readNum(this.data(), 'potentialTotal'));
  readonly tips = computed(() => readArr<Tip>(this.data(), 'tips'));
  readonly alerts = computed(() => readArr<Alert>(this.data(), 'alerts'));

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
