import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideA2UI } from '@a2ui/angular';
import type { ActionPayload } from '@a2ui/web_core';

import { routes } from './app.routes';
import { buildFinanceCatalog } from './catalog/avanzado/finance-catalog';
import { A2uiActionService } from './services/a2ui-action.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Angular Material necesita animaciones; las cargamos de forma diferida.
    provideAnimationsAsync(),
    // Renderer A2UI v1.0 (solo lo consume el nivel Avanzado): catálogo custom de
    // finanzas + handler global de actions. `provideA2UI` activa los componentes
    // universales (web components), el modo recomendado en v1.0. La fábrica corre
    // en contexto de inyección; el actionHandler delega en A2uiActionService
    // (recálculo determinista en TypeScript). Inocuo para Básico/Intermedio.
    provideA2UI(() => {
      const actions = inject(A2uiActionService);
      return {
        catalogs: [buildFinanceCatalog()],
        actionHandler: (action: ActionPayload) => actions.handle(action),
      };
    }),
  ],
};
