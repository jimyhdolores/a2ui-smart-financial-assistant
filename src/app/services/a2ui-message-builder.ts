import { Injectable } from '@angular/core';

import {
  A2UI_VERSION,
  COMPONENT_FIELDS,
  DATA_ROOT,
  FINANCE_CATALOG_ID,
  type A2uiMessage,
} from '../models/a2ui-protocol';
import type { UiComponent } from '../models/ui-router.model';

/** Id del nodo raíz del árbol de componentes de cada superficie. */
const ROOT_ID = 'root';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  A2uiMessageBuilder — traduce una decisión (componente + data) al       ║
 * ║  stream JSONL del protocolo A2UI v1.0.                                  ║
 * ║                                                                       ║
 * ║  Produce los tres mensajes del envelope:                                ║
 * ║   1) createSurface     → abre la superficie + declara el catálogo.      ║
 * ║   2) updateComponents  → estructura: un único nodo raíz (el componente  ║
 * ║      "grueso") cuyas props se BINDEAN por JSON Pointer                  ║
 * ║      (`{"@path": "/data/<campo>"}`). Aquí NO viaja ni un número: solo   ║
 * ║      la forma. (Trabajo de Nano.)                                       ║
 * ║   3) updateDataModel   → los valores reales bajo `/data` (los importes   ║
 * ║      calculados de forma determinista en TypeScript).                   ║
 * ║                                                                       ║
 * ║  v1.0 permitiría mandarlo todo en un solo `createSurface` (con          ║
 * ║  `components` y `dataModel` en línea); lo dejamos en tres mensajes      ║
 * ║  porque esa separación es la tesis del proyecto hecha protocolo:        ║
 * ║  "el LLM decide la intención, TypeScript pone el dinero".               ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class A2uiMessageBuilder {
  /**
   * Stream completo de un turno: abre superficie, declara el componente con
   * sus campos bindeados y rellena el data-model.
   */
  build(component: UiComponent, data: Record<string, unknown>, surfaceId: string): A2uiMessage[] {
    return [
      this.createSurface(surfaceId),
      this.updateComponents(component, surfaceId),
      this.updateData(surfaceId, data),
    ];
  }

  /** Mensaje `createSurface` para una superficie del catálogo de finanzas. */
  private createSurface(surfaceId: string): A2uiMessage {
    return {
      version: A2UI_VERSION,
      createSurface: { surfaceId, catalogId: FINANCE_CATALOG_ID },
    } as A2uiMessage;
  }

  /**
   * Mensaje `updateComponents`: un único nodo raíz (`id:"root"`) del tipo del
   * componente, con cada campo declarado como binding `{ "@path": "/data/<campo>" }`.
   */
  private updateComponents(component: UiComponent, surfaceId: string): A2uiMessage {
    const node: Record<string, unknown> = { id: ROOT_ID, component };
    for (const field of COMPONENT_FIELDS[component]) {
      node[field] = { '@path': `${DATA_ROOT}/${field}` };
    }
    return {
      version: A2UI_VERSION,
      updateComponents: { surfaceId, components: [node] },
    } as A2uiMessage;
  }

  /** Mensaje `updateDataModel` que reemplaza TODO el subárbol `/data`. */
  updateData(surfaceId: string, data: Record<string, unknown>): A2uiMessage {
    return {
      version: A2UI_VERSION,
      updateDataModel: { surfaceId, path: DATA_ROOT, value: data },
    } as A2uiMessage;
  }

  /**
   * Mensaje `updateDataModel` quirúrgico sobre UNA hoja (`/data/<campo>`).
   * Lo usan los `actionHandler` para recalcular solo lo que cambia (p. ej. la
   * proyección de agotamiento tras mover el slider) sin pisar el resto.
   * En v1.0 `value` es obligatorio: `null` borra la hoja.
   */
  patch(surfaceId: string, field: string, value: unknown): A2uiMessage {
    return {
      version: A2UI_VERSION,
      updateDataModel: { surfaceId, path: `${DATA_ROOT}/${field}`, value: value ?? null },
    } as A2uiMessage;
  }
}
