// Prepara el agente Python (apps/agent) justo después de `pnpm install`,
// para que un solo comando deje listos los dos lados del monorepo.
//
// - Si `uv` está instalado: `uv sync` (descarga Python 3.13 si hace falta e
//   instala las dependencias del agente en apps/agent/.venv).
// - Si falta apps/agent/.env, lo crea a partir de .env.example (sin key).
// - Si `uv` no está instalado, avisa cómo instalarlo y NO rompe la instalación
//   del front. Se puede repetir en cualquier momento con: pnpm setup:agent
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = join(root, 'apps', 'agent');
// Sin shell: `uv` es un ejecutable y se encuentra en el PATH tal cual (también
// `uv.exe` en Windows). Sin rutas en los argumentos (se usa `cwd`), así no hay
// problemas con espacios en las carpetas. UV_LINK_MODE=copy evita el aviso de
// "hardlink" cuando la caché de uv y el proyecto están en discos distintos.
const run = (args, options = {}) =>
  spawnSync('uv', args, {
    cwd: agentDir,
    env: { ...process.env, UV_LINK_MODE: process.env.UV_LINK_MODE ?? 'copy' },
    ...options,
  });

const version = run(['--version'], { encoding: 'utf8' });
if (version.status !== 0) {
  console.warn(
    [
      '',
      '⚠  No encontré `uv`: el front quedó instalado, pero el agente Python no.',
      '   Instálalo (https://docs.astral.sh/uv/getting-started/installation/):',
      '     Windows:      powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
      '     macOS/Linux:  curl -LsSf https://astral.sh/uv/install.sh | sh',
      '   y luego ejecuta: pnpm setup:agent',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

console.log(`\n▶ Preparando el agente Python con ${version.stdout.trim()} (uv sync en apps/agent)…`);
const sync = run(['sync'], { stdio: 'inherit' });
if (sync.status !== 0) {
  console.warn('\n⚠  `uv sync` falló (mira el mensaje de arriba). Vuelve a intentarlo con: pnpm setup:agent\n');
  process.exit(0);
}

const envFile = join(agentDir, '.env');
if (!existsSync(envFile)) {
  copyFileSync(join(agentDir, '.env.example'), envFile);
  console.log('▶ Creé apps/agent/.env a partir de .env.example: pon ahí tu GEMINI_API_KEY.');
}

console.log('✔ Front y agente instalados. Arranca los dos con: pnpm dev\n');
