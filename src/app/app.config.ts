import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { A2UI_RENDERER_CONFIG } from '@a2ui/angular/v0_9';
import type { A2uiClientAction } from '@a2ui/web_core/v0_9';

import { routes } from './app.routes';
import { buildFinanceCatalog } from './catalog/avanzado/finance-catalog';
import { A2uiActionService } from './services/a2ui-action.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Angular Material necesita animaciones; las cargamos de forma diferida.
    provideAnimationsAsync(),
    // Renderer A2UI v0.9 (solo lo consume el nivel Avanzado): catálogo custom de
    // finanzas + handler global de actions. La fábrica corre en contexto de
    // inyección; el actionHandler delega en A2uiActionService (recálculo
    // determinista en TypeScript). Inocuo para los niveles Básico/Intermedio.
    {
      provide: A2UI_RENDERER_CONFIG,
      useFactory: () => {
        const actions = inject(A2uiActionService);
        return {
          catalogs: [buildFinanceCatalog()],
          actionHandler: (action: A2uiClientAction) => actions.handle(action),
        };
      },
    },
  ],
};
