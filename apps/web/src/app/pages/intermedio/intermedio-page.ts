import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { AccountSummary } from './account-summary/account-summary';
import { Chat } from './chat/chat';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  IntermedioPage — NIVEL 2: catálogo rico con contrato "casero"         ║
 * ║                                                                       ║
 * ║  Misma idea que el nivel Básico (Nano enruta → TypeScript calcula)     ║
 * ║  pero con 6 componentes financieros ricos (gráficos, tablas, hero      ║
 * ║  interactivo). El render usa `NgComponentOutlet` + input `data`: un    ║
 * ║  contrato propio, sin protocolo estándar. Dos pestañas: "Resumen de    ║
 * ║  cuenta" y "Asistente IA".                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-intermedio-page',
  imports: [MatTabsModule, AccountSummary, Chat],
  templateUrl: './intermedio-page.html',
  styleUrl: './intermedio-page.scss',
})
export class IntermedioPage {}
