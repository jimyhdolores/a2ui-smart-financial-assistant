/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceCatalog — catálogo A2UI v1.0 "grueso" del asistente financiero ║
 * ║                                                                       ║
 * ║  El CONTRATO vive en `finance-catalog.v1.json`: qué componentes        ║
 * ║  existen y qué campos acepta cada uno (todos "dinámicos": literal o    ║
 * ║  binding `{"@path": …}` al data-model). Es un documento de catálogo     ║
 * ║  A2UI estándar, el mismo formato que leería un agente en un servidor.   ║
 * ║                                                                       ║
 * ║  Aquí solo se le pone CARA a cada nombre: `Catalog.fromJson` (web_core) ║
 * ║  lee el contrato y genera los schemas que el renderer usa para validar  ║
 * ║  y para resolver los bindings; `createComponentImplementation` asocia   ║
 * ║  cada nombre con su clase Angular. Un nombre que no esté aquí, el       ║
 * ║  renderer simplemente no lo pinta: es la lista blanca.                  ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
import type { Type } from '@angular/core';
import {
  AngularCatalog,
  createComponentImplementation,
  type CatalogComponentInstance,
} from '@a2ui/angular';
import { Catalog } from '@a2ui/web_core';

import { A2UI_VERSION } from '../../models/a2ui-protocol';
import type { UiComponent } from '../../models/ui-router.model';

import financeCatalogDocument from './finance-catalog.v1.json';
import { AntExpense } from './ant-expense/ant-expense';
import { CreditAdvisor } from './credit-advisor/credit-advisor';
import { MovementsTable } from './movements-table/movements-table';
import { QuickStats } from './quick-stats/quick-stats';
import { Recommendations } from './recommendations/recommendations';
import { SavingsPlan } from './savings-plan/savings-plan';
import { SpendingReport } from './spending-report/spending-report';

/** Documento del catálogo (el contrato compartido con cualquier agente). */
export const FINANCE_CATALOG_DOCUMENT = financeCatalogDocument;

/** Clase Angular que renderiza cada nombre de componente A2UI. */
const COMPONENT_CLASS: Record<UiComponent, Type<CatalogComponentInstance>> = {
  AppAntExpense: AntExpense,
  AppSpendingReport: SpendingReport,
  AppMovementsTable: MovementsTable,
  AppRecommendations: Recommendations,
  AppSavingsPlan: SavingsPlan,
  AppCreditAdvisor: CreditAdvisor,
  AppQuickStats: QuickStats,
};

/**
 * Fábrica del catálogo. Se llama una vez al configurar el renderer
 * (`provideA2UI`). Devuelve un `AngularCatalog` v1.0 con los 7 componentes.
 */
export function buildFinanceCatalog(): AngularCatalog {
  const contract = Catalog.fromJson(financeCatalogDocument, A2UI_VERSION);

  const components = [...contract.components.values()].map((api) => {
    const cls = COMPONENT_CLASS[api.name as UiComponent];
    if (!cls) {
      throw new Error(`El catálogo declara "${api.name}" pero no tiene clase Angular.`);
    }
    return createComponentImplementation(api, cls);
  });

  return new AngularCatalog(contract.id, A2UI_VERSION, components);
}
