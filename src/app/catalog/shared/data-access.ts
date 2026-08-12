/**
 * Lectura TOLERANTE del `data: Record<string, unknown>` que reciben los
 * componentes generativos. Como el `data` lo arma la app (y a veces lo influye
 * un LLM), leemos cada campo con un valor por defecto para no romper nunca la UI.
 *
 * Se usan como helpers puros dentro de `computed()` en cada componente del catálogo.
 */

export function readStr(data: Record<string, unknown>, key: string, fallback = ''): string {
  const v = data?.[key];
  return typeof v === 'string' && v.trim() ? v : fallback;
}

export function readNum(data: Record<string, unknown>, key: string, fallback = 0): number {
  const v = data?.[key];
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && !Number.isNaN(n) ? n : fallback;
}

export function readBool(data: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = data?.[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function readArr<T = Record<string, unknown>>(
  data: Record<string, unknown>,
  key: string,
): T[] {
  const v = data?.[key];
  return Array.isArray(v) ? (v as T[]) : [];
}
