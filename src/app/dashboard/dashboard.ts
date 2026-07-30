import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';

import { ACCOUNT_ICON, CURRENCY } from '../models/finance.model';
import { FinanceDataService } from '../services/finance-data';
import { GenUiService } from '../services/gen-ui';
import { AccountSummary } from './account-summary/account-summary';
import { Chat } from './chat/chat';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  Dashboard — SHELL DEL ASISTENTE FINANCIERO                            ║
 * ║                                                                       ║
 * ║  Sidebar de cuentas (MatSidenav) + barra superior con el estado de la ║
 * ║  IA local y banner de descarga + pestañas: "Resumen de cuenta" y      ║
 * ║  "Asistente IA". Al elegir una cuenta, ambas pestañas reaccionan vía  ║
 * ║  el signal `selectedAccount` del servicio de datos.                   ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    DecimalPipe,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    AccountSummary,
    Chat,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly finance = inject(FinanceDataService);
  protected readonly ai = inject(GenUiService);

  protected readonly accountIcon = ACCOUNT_ICON;
  protected readonly currency = CURRENCY;

  /** Error de descarga del modelo (si lo hubiera). */
  protected readonly downloadError = signal<string | null>(null);

  /** Etiqueta corta del saldo según el tipo de cuenta. */
  protected balanceLabel(kind: string): string {
    return kind === 'credito' ? 'Deuda' : 'Disponible';
  }

  /**
   * ⬇️ Descarga el modelo Gemini Nano. Se llama desde un clic (user activation),
   * tal como exige la API de Chrome.
   */
  protected async downloadModel(): Promise<void> {
    this.downloadError.set(null);
    try {
      await this.ai.downloadModel();
    } catch (err) {
      this.downloadError.set(err instanceof Error ? err.message : String(err));
    }
  }
}
