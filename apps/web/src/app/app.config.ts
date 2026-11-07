import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideA2UI, provideMarkdownRenderer } from '@a2ui/angular';
import type { ActionPayload } from '@a2ui/web_core';

import { routes } from './app.routes';
import { buildFinanceCatalog, buildLayoutCatalog } from './catalog/avanzado/finance-catalog';
import { A2uiActionService } from './services/a2ui-action.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Angular Material necesita animaciones; las cargamos de forma diferida.
    provideAnimationsAsync(),
    // Renderer A2UI v1.0 (solo lo consume el nivel Avanzado). Dos catálogos = la
    // lista blanca del navegador:
    //  · finanzas: los 7 widgets (los usan el modo local y el agente del servidor);
    //  · básico recortado: piezas de maquetación para que el servidor componga.
    // `provideA2UI` activa los componentes universales (web components), el modo
    // recomendado en v1.0. El actionHandler decide si la acción se resuelve aquí
    // (modo local) o viaja al agente del servidor.
    provideA2UI(() => {
      const actions = inject(A2uiActionService);
      return {
        catalogs: [buildFinanceCatalog(), buildLayoutCatalog()],
        actionHandler: (action: ActionPayload) => actions.handle(action),
      };
    }),
    // Markdown en los `Text` del catálogo básico (títulos "## …", negritas). Sin
    // argumentos usa el renderer por defecto, que carga `@a2ui/markdown-it` de forma
    // perezosa (no engorda el bundle inicial).
    provideMarkdownRenderer(),
  ],
};
