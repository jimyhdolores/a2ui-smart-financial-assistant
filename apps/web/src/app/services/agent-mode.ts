import { Injectable, computed, signal } from '@angular/core';

/** Dónde vive el agente del nivel Avanzado. */
export type AgentMode = 'local' | 'server';

const STORAGE_KEY = 'fintech-nano.agent-mode';

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  AgentModeService — el interruptor "¿dónde vive el agente?"            ║
 * ║                                                                       ║
 * ║  local  → Gemini Nano en el navegador arma los mensajes A2UI (sin red). ║
 * ║  server → un agente Python + Gemini en el servidor arma los mensajes y  ║
 * ║           los manda por la red. El renderer y el catálogo son los MISMOS.║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */
@Injectable({ providedIn: 'root' })
export class AgentModeService {
  readonly mode = signal<AgentMode>(readStoredMode());
  readonly isServer = computed(() => this.mode() === 'server');

  set(mode: AgentMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Sin almacenamiento (modo privado, etc.): el interruptor sigue funcionando en memoria.
    }
  }
}

function readStoredMode(): AgentMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'server' ? 'server' : 'local';
  } catch {
    return 'local';
  }
}
