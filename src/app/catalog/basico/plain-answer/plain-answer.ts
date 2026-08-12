import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { readStr } from '../../shared/data-access';

/**
 * 💬 PlainAnswer — el componente toy más simple: una respuesta en texto.
 *
 * Nivel Básico. No calcula nada: solo muestra el texto que Gemini Nano generó
 * (con streaming). Sirve para preguntas conceptuales ("¿qué es un gasto
 * hormiga?") donde la respuesta correcta es una explicación, no un dato.
 */
@Component({
  selector: 'app-plain-answer',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './plain-answer.html',
  styleUrl: './plain-answer.scss',
})
export class PlainAnswer {
  readonly data = input<Record<string, unknown>>({});

  readonly text = computed(() => readStr(this.data(), 'text'));

  /** Párrafos (divididos por saltos de línea) para un render limpio. */
  readonly paragraphs = computed(() =>
    this.text()
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean),
  );
}
