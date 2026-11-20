import { Injectable, Injector, inject, signal } from '@angular/core';
import { A2uiRendererService } from '@a2ui/angular';
import type { RendererErrorMessage } from '@a2ui/web_core';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  A2uiRendererErrorsService — el visor A2UI también dice "no".          ║
 * ║                                                                       ║
 * ║  Entrega los mensajes al renderer con `processMessagesWithErrors`     ║
 * ║  (A2UI 1.0): procesa uno a uno y, si alguno no cumple el catálogo     ║
 * ║  (pieza desconocida, padre no permitido, dato inválido…), NO lanza:   ║
 * ║  devuelve el error con la forma estándar `{version, error:{code,…}}`  ║
 * ║  y sigue con los demás. Aquí los guardamos por superficie para que    ║
 * ║  el chat los muestre debajo de la pantalla que falló.                 ║
 * ║                                                                       ║
 * ║  Obtiene `A2uiRendererService` de forma perezosa (vía `Injector`)     ║
 * ║  para no cerrar el ciclo config → renderer → actionHandler → renderer.║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class A2uiRendererErrorsService {
  private readonly injector = inject(Injector);

  /** Errores legibles por superficie (`code: message`). */
  private readonly bySurface = signal<ReadonlyMap<string, readonly string[]>>(new Map());

  /**
   * Entrega `messages` al renderer y devuelve los que rechazó.
   * @param surfaceId superficie a la que atribuir un error que no trae la suya.
   */
  apply(messages: readonly unknown[], surfaceId?: string): RendererErrorMessage[] {
    const errors = this.renderer.processor.processMessagesWithErrors(messages);
    if (errors.length) this.record(errors, surfaceId);
    return errors;
  }

  /** Errores del visor para una superficie (vacío si todo se pintó bien). */
  forSurface(surfaceId: string): readonly string[] {
    return this.bySurface().get(surfaceId) ?? [];
  }

  private record(errors: readonly RendererErrorMessage[], fallbackSurfaceId?: string): void {
    this.bySurface.update((prev) => {
      const next = new Map(prev);
      for (const { error } of errors) {
        console.warn('[A2UI] El visor rechazó un mensaje:', error);
        const id = error.surfaceId ?? fallbackSurfaceId ?? '';
        next.set(id, [...(next.get(id) ?? []), `${error.code}: ${error.message}`]);
      }
      return next;
    });
  }

  private get renderer(): A2uiRendererService {
    return this.injector.get(A2uiRendererService);
  }
}
