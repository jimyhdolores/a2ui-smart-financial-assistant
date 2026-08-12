import { Directive, inject } from '@angular/core';
import {
  A2uiRendererService,
  CatalogComponent,
  type BoundProperty,
} from '@a2ui/angular/v0_9';
import type { ComponentApi } from '@a2ui/web_core/v0_9';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  FinanceComponent — base de los componentes del catálogo A2UI          ║
 * ║                                                                       ║
 * ║  Extiende {@link CatalogComponent} (la base del renderer oficial) y    ║
 * ║  añade dos cosas:                                                      ║
 * ║   1) Lectores TOLERANTES de props (`str/num/bool/arr/obj`): cada prop  ║
 * ║      llega ya resuelta desde el data-model por JSON Pointer, en un      ║
 * ║      `BoundProperty.value()`. Leemos con un fallback para no romper la  ║
 * ║      UI si un campo falta (igual filosofía que el antiguo data-access). ║
 * ║   2) `dispatch()`: emite un `action.event` de A2UI hacia el            ║
 * ║      `actionHandler` global (round-trip agéntico determinista).        ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Directive()
export abstract class FinanceComponent<
  Api extends ComponentApi = ComponentApi,
> extends CatalogComponent<Api> {
  private readonly renderer = inject(A2uiRendererService);

  /** Valor crudo ya resuelto (literal o binding por path) de una prop. */
  private raw(key: string): unknown {
    const bag = this.props() as unknown as Record<string, BoundProperty | undefined>;
    return bag[key]?.value();
  }

  protected str(key: string, fallback = ''): string {
    const v = this.raw(key);
    return typeof v === 'string' && v.trim() ? v : fallback;
  }

  protected num(key: string, fallback = 0): number {
    const v = this.raw(key);
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && !Number.isNaN(n) ? n : fallback;
  }

  protected bool(key: string, fallback = false): boolean {
    const v = this.raw(key);
    return typeof v === 'boolean' ? v : fallback;
  }

  protected arr<T = Record<string, unknown>>(key: string): T[] {
    const v = this.raw(key);
    return Array.isArray(v) ? (v as T[]) : [];
  }

  /**
   * Emite un `action.event` de A2UI (name + context) desde este componente
   * hacia el `actionHandler` global. El handler recalcula de forma determinista
   * en TypeScript y devuelve un `updateDataModel` sobre esta misma superficie.
   */
  protected dispatch(name: string, context: Record<string, unknown> = {}): void {
    const surface = this.renderer.surfaceGroup?.getSurface(this.surfaceId());
    if (!surface) return;
    void surface.dispatchAction({ event: { name, context } }, this.componentId());
  }
}
