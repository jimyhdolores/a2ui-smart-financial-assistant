import { Injectable, inject } from '@angular/core';
import type { ActionPayload } from '@a2ui/web_core';

import { A2UI_ACTIONS, FOLLOW_UP_ACTION } from '../models/a2ui-protocol';
import { A2uiMessageBuilder } from './a2ui-message-builder';
import { A2uiRendererErrorsService } from './a2ui-renderer-errors';
import { FinanceAnalyticsService } from './finance-analytics';
import { FinanceDataService } from './finance-data';
import { RemoteAgentService } from './remote-agent';

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
 * ║  Entrega por `A2uiRendererErrorsService`, que obtiene el renderer de    ║
 * ║  forma perezosa (rompe el ciclo config → renderer → actionHandler) y    ║
 * ║  anota bajo la superficie lo que el visor rechace.                      ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class A2uiActionService {
  private readonly a2uiErrors = inject(A2uiRendererErrorsService);
  private readonly analytics = inject(FinanceAnalyticsService);
  private readonly finance = inject(FinanceDataService);
  private readonly builder = inject(A2uiMessageBuilder);
  private readonly remote = inject(RemoteAgentService);

  /** Handler global registrado como `actionHandler` en `provideA2UI`. */
  handle(action: ActionPayload): void {
    // Superficie creada por el agente del servidor: la acción viaja de vuelta a él
    // (la flecha "acciones del usuario" de la diapositiva). Los botones de
    // seguimiento se convierten en un turno nuevo del chat.
    if (this.remote.owns(action.surfaceId)) {
      const question = (action.context as Record<string, unknown> | undefined)?.['question'];
      if (action.name === FOLLOW_UP_ACTION && typeof question === 'string' && question.trim()) {
        this.remote.requestFollowUp(question.trim());
        return;
      }
      void this.remote.sendAction(action).catch((err) => console.error('[A2UI] Acción no enviada:', err));
      return;
    }

    const surfaceId = action.surfaceId;
    const account = this.finance.selectedAccount();
    const context = (action.context ?? {}) as Record<string, unknown>;

    switch (action.name) {
      // Slider de gastos hormiga: recalcula SOLO la proyección de agotamiento
      //    (deja intacto el veredicto status/headline/message y el resto).
      case A2UI_ACTIONS.simulateReduction: {
        const pct = this.toNum(context['pct']);
        const proj = this.analytics.projectDepletion(account, { antReductionPct: pct });
        this.a2uiErrors.apply(
          [
            this.builder.patch(surfaceId, 'reductionPct', pct),
            this.builder.patch(surfaceId, 'daysLeft', proj.daysLeft),
            this.builder.patch(surfaceId, 'depletionFrom', proj.fromDate),
            this.builder.patch(surfaceId, 'depletionTo', proj.toDate),
          ],
          surfaceId,
        );
        break;
      }

      // Chips de filtro de la tabla: re-filtra y reemplaza todo el /data.
      case A2UI_ACTIONS.filterMovements: {
        const data = this.analytics.buildData('AppMovementsTable', context, account);
        this.a2uiErrors.apply([this.builder.updateData(surfaceId, data)], surfaceId);
        break;
      }
    }
  }

  private toNum(v: unknown): number {
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  }
}
