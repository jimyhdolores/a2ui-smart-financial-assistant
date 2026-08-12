import { Injectable, Injector, inject } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular/v0_9';
import type { A2uiClientAction } from '@a2ui/web_core/v0_9';

import { A2UI_ACTIONS } from '../models/a2ui-protocol';
import { A2uiMessageBuilder } from './a2ui-message-builder';
import { FinanceAnalyticsService } from './finance-analytics';
import { FinanceDataService } from './finance-data';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  A2uiActionService — el "cerebro determinista" del round-trip agéntico. ║
 * ║                                                                       ║
 * ║  Recibe cada `action.event` que un componente despacha (slider "¿y     ║
 * ║  si…?", chips de filtro), RECALCULA en TypeScript puro con             ║
 * ║  `FinanceAnalyticsService` y devuelve el resultado por `updateDataModel`║
 * ║  sobre la MISMA superficie (`action.surfaceId`). Ni un número lo pone   ║
 * ║  el LLM: el modelo solo eligió el componente; aquí vive la matemática.  ║
 * ║                                                                       ║
 * ║  Obtiene `A2uiRendererService` de forma perezosa (vía `Injector`) para  ║
 * ║  romper el ciclo config → renderer → actionHandler → renderer.          ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class A2uiActionService {
  private readonly injector = inject(Injector);
  private readonly analytics = inject(FinanceAnalyticsService);
  private readonly finance = inject(FinanceDataService);
  private readonly builder = inject(A2uiMessageBuilder);

  /** Handler global registrado en `A2UI_RENDERER_CONFIG.actionHandler`. */
  handle(action: A2uiClientAction): void {
    const surfaceId = action.surfaceId;
    const account = this.finance.selectedAccount();
    const context = (action.context ?? {}) as Record<string, unknown>;

    switch (action.name) {
      // 🐜 Slider de gastos hormiga: recalcula SOLO la proyección de agotamiento
      //    (deja intacto el veredicto status/headline/message y el resto).
      case A2UI_ACTIONS.simulateReduction: {
        const pct = this.toNum(context['pct']);
        const proj = this.analytics.projectDepletion(account, { antReductionPct: pct });
        this.renderer.processMessages([
          this.builder.patch(surfaceId, 'reductionPct', pct),
          this.builder.patch(surfaceId, 'daysLeft', proj.daysLeft),
          this.builder.patch(surfaceId, 'depletionFrom', proj.fromDate),
          this.builder.patch(surfaceId, 'depletionTo', proj.toDate),
        ]);
        break;
      }

      // 📋 Chips de filtro de la tabla: re-filtra y reemplaza todo el /data.
      case A2UI_ACTIONS.filterMovements: {
        const data = this.analytics.buildData('AppMovementsTable', context, account);
        this.renderer.processMessages([this.builder.updateData(surfaceId, data)]);
        break;
      }
    }
  }

  private get renderer(): A2uiRendererService {
    return this.injector.get(A2uiRendererService);
  }

  private toNum(v: unknown): number {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  }
}
