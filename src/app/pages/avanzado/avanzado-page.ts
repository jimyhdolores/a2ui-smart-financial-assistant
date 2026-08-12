import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { AccountSummary } from './account-summary/account-summary';
import { Chat } from './chat/chat';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  AvanzadoPage — NIVEL 3: el protocolo A2UI v0.9 real                   ║
 * ║                                                                       ║
 * ║  La MISMA decisión de Nano que el nivel Intermedio, pero renderizada   ║
 * ║  con el protocolo estándar A2UI: TypeScript emite el stream JSONL      ║
 * ║  (createSurface / updateComponents / updateDataModel) hacia el         ║
 * ║  renderer oficial `@a2ui/angular` (`<a2ui-v09-surface>`), con          ║
 * ║  round-trip agéntico por `action.event`. Dos pestañas: "Resumen de     ║
 * ║  cuenta" y "Asistente IA".                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-avanzado-page',
  imports: [MatTabsModule, AccountSummary, Chat],
  templateUrl: './avanzado-page.html',
  styleUrl: './avanzado-page.scss',
})
export class AvanzadoPage {}
