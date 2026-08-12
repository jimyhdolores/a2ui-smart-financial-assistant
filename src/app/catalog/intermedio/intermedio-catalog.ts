import { Type } from '@angular/core';
import { A2uiComponent } from '../../models/a2ui.model';
import { AntExpense } from './ant-expense/ant-expense';
import { CreditAdvisor } from './credit-advisor/credit-advisor';
import { MovementsTable } from './movements-table/movements-table';
import { QuickStats } from './quick-stats/quick-stats';
import { Recommendations } from './recommendations/recommendations';
import { SavingsPlan } from './savings-plan/savings-plan';
import { SpendingReport } from './spending-report/spending-report';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  🎯 REGISTRO DE GENERATIVE UI                                          ║
 * ║                                                                       ║
 * ║  Mapa que traduce el STRING que devuelve el LLM en una CLASE de       ║
 * ║  componente Angular real. Es el "catálogo de Lego" del agente.        ║
 * ║                                                                       ║
 * ║  👉 Añadir un componente nuevo al vocabulario del agente = UNA línea  ║
 * ║     aquí + añadirlo al union `A2uiComponent`. No se toca ningún       ║
 * ║     template: el <ng-container *ngComponentOutlet> lo renderiza solo. ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
export const INTERMEDIO_REGISTRY: Record<A2uiComponent, Type<unknown>> = {
  AppSpendingReport: SpendingReport,
  AppRecommendations: Recommendations,
  AppSavingsPlan: SavingsPlan,
  AppCreditAdvisor: CreditAdvisor,
  AppMovementsTable: MovementsTable,
  AppAntExpense: AntExpense,
  AppQuickStats: QuickStats,
};
