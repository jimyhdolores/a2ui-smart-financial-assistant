import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { readArr, readStr } from '../../shared/data-access';

/** Un KPI de la tira: icono + etiqueta + importe + tono (color de acento). */
interface StatItem {
  icon: string;
  label: string;
  value: number;
  tone: string;
}

/**
 * AppQuickStats — tira compacta de KPIs (versión CASERA / Intermedio).
 *
 * Cabecera natural de un panel compuesto: en cuatro cifras da el pulso del mes
 * (Disponible · Gasto del mes · Gastos hormiga · Ahorro potencial). Los números
 * los calcula el servicio de analítica; el LLM solo decidió incluir esta sección.
 * Recibe su `data` por `@Input` y lo lee con helpers tolerantes.
 */
@Component({
  selector: 'app-quick-stats',
  imports: [DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './quick-stats.html',
  styleUrl: './quick-stats.scss',
})
export class QuickStats {
  readonly data = input<Record<string, unknown>>({});

  readonly currency = computed(() => readStr(this.data(), 'currency', '$'));
  readonly items = computed(() => readArr<StatItem>(this.data(), 'items'));
}
