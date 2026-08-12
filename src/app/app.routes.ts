import { Routes } from '@angular/router';

/**
 * Tres niveles didácticos de Generative UI, en complejidad creciente:
 *   /basico      → Gemini Nano + routing a 3 componentes toy (sin A2UI)
 *   /intermedio  → catálogo casero de 6 componentes (NgComponentOutlet)
 *   /avanzado    → los mismos 6 vía el protocolo A2UI v0.9 real
 * El shell raíz (App) provee el header con la descarga de Nano en las 3.
 *
 * Cada nivel se carga bajo demanda (`loadComponent`) → su propio chunk. Así el
 * nivel Básico arranca ligero, sin arrastrar ApexCharts ni las 6 tarjetas del
 * catálogo, que solo se descargan al entrar a Intermedio/Avanzado.
 */
export const routes: Routes = [
  {
    path: 'basico',
    loadComponent: () => import('./pages/basico/basico-page').then((m) => m.BasicoPage),
  },
  {
    path: 'intermedio',
    loadComponent: () => import('./pages/intermedio/intermedio-page').then((m) => m.IntermedioPage),
  },
  {
    path: 'avanzado',
    loadComponent: () => import('./pages/avanzado/avanzado-page').then((m) => m.AvanzadoPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'basico' },
  { path: '**', redirectTo: 'basico' },
];
