import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import { A2UI_ACTIONS } from '../../../models/a2ui-protocol';
import { FinanceComponent } from '../finance-component.base';

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

/** Filtro rápido: id + etiqueta + icono + params para `filterMovements`. */
interface QuickFilter {
  id: string;
  label: string;
  icon: string;
  params: Record<string, unknown>;
}

/**
 * 📋 AppMovementsTable — movimientos filtrados en tabla.
 *
 * El LLM interpreta la consulta inicial ("solo mis Yape", "mi mayor compra")
 * y produce `params` de filtro; TypeScript filtra la lista real. Además, los
 * chips superiores permiten REFINAR el filtro en vivo: cada uno dispara una
 * `action.event` A2UI (`filterMovements`) que el `actionHandler` recalcula de
 * forma determinista y devuelve por `updateDataModel` sobre esta superficie.
 */
@Component({
  selector: 'app-movements-table',
  imports: [DecimalPipe, MatCardModule, MatChipsModule, MatIconModule, MatTableModule],
  templateUrl: './movements-table.html',
  styleUrl: './movements-table.scss',
})
export class MovementsTable extends FinanceComponent {
  readonly title = computed(() => this.str('title', 'Tus movimientos'));
  readonly currency = computed(() => this.str('currency', '$'));
  readonly filterLabel = computed(() => this.str('filterLabel'));
  readonly total = computed(() => this.num('total'));
  readonly count = computed(() => this.num('count'));
  readonly rows = computed(() => this.arr<MovementRow>('rows'));

  readonly columns = ['date', 'merchant', 'amount', 'method'] as const;

  /** Filtros rápidos disponibles como chips interactivos. */
  readonly quickFilters: readonly QuickFilter[] = [
    { id: 'all', label: 'Todos', icon: 'list', params: {} },
    { id: 'ants', label: 'Gastos hormiga', icon: 'pest_control', params: { antsOnly: true } },
    { id: 'yape', label: 'Yape', icon: 'qr_code_2', params: { method: 'yape' } },
    { id: 'largest', label: 'Compra más grande', icon: 'trending_up', params: { largest: true } },
    { id: 'previous', label: 'Mes anterior', icon: 'history', params: { period: 'previous' } },
  ];

  /** Chip activo (refinamiento local; visual). Arranca en "Todos". */
  protected readonly active = signal<string>('all');

  protected onFilter(f: QuickFilter): void {
    this.active.set(f.id);
    this.dispatch(A2UI_ACTIONS.filterMovements, f.params);
  }
}
