import { DecimalPipe } from '@angular/common';
import { Component, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { FinanceComponent } from '../finance-component.base';

/** Un KPI de la tira: icono + etiqueta + importe + tono (color de acento). */
interface StatItem {
  icon: string;
  label: string;
  value: number;
  tone: string;
}

/**
 * 📌 AppQuickStats — tira compacta de KPIs (versión A2UI / Avanzado).
 *
 * Idéntica a la casera en plantilla y estilos; solo cambia la FUENTE de datos:
 * aquí cada campo llega resuelto desde el data-model por JSON Pointer y se lee
 * con los helpers tolerantes de {@link FinanceComponent}. Es la cabecera natural
 * de un panel compuesto por varias superficies A2UI apiladas.
 */
@Component({
  selector: 'app-quick-stats',
  imports: [DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './quick-stats.html',
  styleUrl: './quick-stats.scss',
})
export class QuickStats extends FinanceComponent {
  readonly currency = computed(() => this.str('currency', '$'));
  readonly items = computed(() => this.arr<StatItem>('items'));
}
