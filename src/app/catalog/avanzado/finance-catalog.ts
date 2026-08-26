/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceCatalog — catálogo A2UI v0.9 "grueso" del asistente financiero ║
 * ║                                                                       ║
 * ║  Mapea cada NOMBRE de componente del protocolo (`AppSpendingReport`,   ║
 * ║  `AppAntExpense`, …) a su clase Angular y a un schema de props. El      ║
 * ║  renderer SÍ valida las props contra este schema (`schema.safeParse`)   ║
 * ║  como puerta previa a montar el componente, pero luego resuelve los     ║
 * ║  valores por forma (literal | { path } | { call }) y descarta el        ║
 * ║  resultado parseado. Por eso el schema es didáctico y PERMISIVO.        ║
 * ║                                                                       ║
 * ║  ⚠️ Se construye con la Zod de la app (v4). NO mezclar aquí los schemas ║
 * ║  de `@a2ui/web_core` (Zod v3): combinar dos instancias/versiones de     ║
 * ║  Zod en un mismo `z.object` rompe el `safeParse` con                    ║
 * ║  «expected a Zod schema». Todos los campos son `z.any()` (aceptan       ║
 * ║  literal o binding de cualquier tipo).                                   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
import { z } from 'zod';
import { AngularCatalog } from '@a2ui/angular/v0_9';

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
 * Cada campo es `z.any()` (acepta literal o binding `{ path }`/`{ call }` de
 * cualquier tipo), más las props comunes del protocolo (`weight`,
 * `accessibility`). Se usa la Zod de la app para no mezclar versiones.
 */
function schemaFor(fields: readonly string[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    // Props comunes A2UI (opcionales, presentes en cualquier componente).
    weight: z.any().optional(),
    accessibility: z.any().optional(),
  };
  for (const field of fields) {
    shape[field] = z.any().optional();
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
