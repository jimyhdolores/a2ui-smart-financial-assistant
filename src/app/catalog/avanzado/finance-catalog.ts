/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceCatalog — catálogo A2UI v0.9 "grueso" del asistente financiero ║
 * ║                                                                       ║
 * ║  Mapea cada NOMBRE de componente del protocolo (`AppSpendingReport`,   ║
 * ║  `AppAntExpense`, …) a su clase Angular y a un schema de props. El      ║
 * ║  renderer oficial NO valida las props contra el schema en runtime (lo   ║
 * ║  resuelve por forma: literal | { path } | { call }), así que el schema  ║
 * ║  es METADATO didáctico: documenta qué campos acepta cada componente.    ║
 * ║  Por eso todos los campos usan `DynamicValueSchema` (literal o binding   ║
 * ║  de cualquier tipo: string, number, boolean, objeto o array).           ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
import { z } from 'zod';
import { AngularCatalog } from '@a2ui/angular/v0_9';
import {
  AccessibilityAttributesSchema,
  DynamicNumberSchema,
  DynamicValueSchema,
} from '@a2ui/web_core/v0_9';

import { COMPONENT_FIELDS, FINANCE_CATALOG_ID } from '../../models/a2ui-protocol';
import type { A2uiComponent } from '../../models/a2ui.model';

import { AntExpense } from './ant-expense/ant-expense';
import { CreditAdvisor } from './credit-advisor/credit-advisor';
import { MovementsTable } from './movements-table/movements-table';
import { QuickStats } from './quick-stats/quick-stats';
import { Recommendations } from './recommendations/recommendations';
import { SavingsPlan } from './savings-plan/savings-plan';
import { SpendingReport } from './spending-report/spending-report';

/** Clase Angular que renderiza cada nombre de componente A2UI. */
const COMPONENT_CLASS: Record<A2uiComponent, unknown> = {
  AppAntExpense: AntExpense,
  AppSpendingReport: SpendingReport,
  AppMovementsTable: MovementsTable,
  AppRecommendations: Recommendations,
  AppSavingsPlan: SavingsPlan,
  AppCreditAdvisor: CreditAdvisor,
  AppQuickStats: QuickStats,
};

/**
 * Construye el schema de props de un componente a partir de sus campos.
 * Cada campo se declara como `DynamicValueSchema` (acepta literal o binding
 * `{ path }`), más las props comunes del protocolo (`weight`, `accessibility`).
 */
function schemaFor(fields: readonly string[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    // Props comunes A2UI (opcionales, presentes en cualquier componente).
    weight: DynamicNumberSchema.optional() as unknown as z.ZodTypeAny,
    accessibility: AccessibilityAttributesSchema.optional() as unknown as z.ZodTypeAny,
  };
  for (const field of fields) {
    shape[field] = DynamicValueSchema.optional() as unknown as z.ZodTypeAny;
  }
  return z.object(shape);
}

/**
 * Fábrica del catálogo. Se llama una vez al configurar el renderer
 * (`A2UI_RENDERER_CONFIG`). Devuelve un `AngularCatalog` con todos los componentes.
 */
export function buildFinanceCatalog(): AngularCatalog {
  const components = (Object.keys(COMPONENT_CLASS) as A2uiComponent[]).map((name) => ({
    name,
    schema: schemaFor(COMPONENT_FIELDS[name]),
    component: COMPONENT_CLASS[name],
  }));

  // `AngularCatalog` hereda de `Catalog(id, components, functions?, themeSchema?)`.
  return new AngularCatalog(FINANCE_CATALOG_ID, components as never);
}
