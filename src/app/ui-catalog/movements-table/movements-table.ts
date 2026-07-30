import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { readArr, readNum, readStr } from '../shared/data-access';

interface MovementRow {
  date: string;
  merchant: string;
  category: string;
  icon: string;
  amount: number;
  method: string;
  methodLabel: string;
  methodIcon: string;
}

/**
 * 📋 AppMovementsTable — movimientos filtrados en tabla.
 *
 * El LLM interpreta la consulta ("solo mis Yape", "mi mayor compra",
 * "movimientos en cafeterías") y produce `params` de filtro; TypeScript filtra
 * la lista real. Aquí solo se renderiza: fecha, comercio, categoría (chip),
 * monto y método (chip). El chip superior describe el filtro aplicado.
 */
@Component({
  selector: 'app-movements-table',
  imports: [DecimalPipe, MatCardModule, MatChipsModule, MatIconModule, MatTableModule],
  templateUrl: './movements-table.html',
  styleUrl: './movements-table.scss',
})
export class MovementsTable {
  readonly data = input<Record<string, unknown>>({});

  readonly title = computed(() => readStr(this.data(), 'title', 'Tus movimientos'));
  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly filterLabel = computed(() => readStr(this.data(), 'filterLabel'));
  readonly total = computed(() => readNum(this.data(), 'total'));
  readonly count = computed(() => readNum(this.data(), 'count'));
  readonly rows = computed(() => readArr<MovementRow>(this.data(), 'rows'));

  readonly columns = ['date', 'merchant', 'amount', 'method'] as const;
}
