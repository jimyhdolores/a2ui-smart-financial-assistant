import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { readArr, readStr } from '../../shared/data-access';

/** Un ítem de la lista (ya formateado por TypeScript). */
interface ListItem {
  label: string;
  sublabel: string;
  icon: string;
  amount: number;
  isIncome: boolean;
}

/**
 * 📃 SimpleList — una lista de movimientos recientes.
 *
 * Nivel Básico. Nano decidió mostrar la lista (y cuántos ítems); TypeScript
 * seleccionó y formateó los movimientos reales. Ingresos en verde con "+".
 */
@Component({
  selector: 'app-simple-list',
  imports: [DecimalPipe, MatCardModule, MatIconModule, MatListModule],
  templateUrl: './simple-list.html',
  styleUrl: './simple-list.scss',
})
export class SimpleList {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Movimientos recientes'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly items = computed(() => readArr<ListItem>(this.data(), 'items'));
}
