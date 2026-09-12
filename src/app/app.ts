import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ACCOUNT_ICON, CURRENCY } from './models/finance.model';
import { FinanceDataService } from './services/finance-data';
import { GenUiService } from './services/gen-ui';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  App — SHELL RAÍZ DEL ASISTENTE FINANCIERO                            ║
 * ║                                                                       ║
 * ║  Header único, común a las 3 páginas de la demo (Básico · Intermedio  ║
 * ║  · Avanzado): sidebar de cuentas + barra superior con el selector de  ║
 * ║  nivel (routing), el estado de Gemini Nano y el banner/barra de       ║
 * ║  descarga del modelo on-device. El cuerpo es un <router-outlet/> que   ║
 * ║  intercambia la página del nivel activo; el estado de Nano y la cuenta ║
 * ║  seleccionada persisten entre niveles (viven en servicios raíz).      ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Component({
  selector: 'app-root',
  imports: [
    DecimalPipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly finance = inject(FinanceDataService);
  protected readonly ai = inject(GenUiService);

  protected readonly accountIcon = ACCOUNT_ICON;
  protected readonly currency = CURRENCY;

  /** Los 3 niveles de la demo (selector del header). */
  protected readonly levels = [
    { path: '/basico', icon: 'filter_1', label: 'Básico' },
    { path: '/intermedio', icon: 'filter_2', label: 'Intermedio' },
    { path: '/avanzado', icon: 'filter_3', label: 'Avanzado' },
  ];

  /** Error de descarga del modelo (si lo hubiera). */
  protected readonly downloadError = signal<string | null>(null);

  /** Etiqueta corta del saldo según el tipo de cuenta. */
  protected balanceLabel(kind: string): string {
    return kind === 'credito' ? 'Deuda' : 'Disponible';
  }

  /**
   * Descarga el modelo Gemini Nano. Se llama desde un clic (user activation),
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
