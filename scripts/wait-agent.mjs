// Espera a que el agente Python (apps/agent) responda en /api/health.
//
// Lo usa `pnpm dev` para levantar primero el backend y, solo cuando ya
// contesta, el front: así la primera petición de Angular a /api (vía el proxy
// de desarrollo, apps/web/proxy.conf.json) nunca choca con un agente a medio
// arrancar.
//
// - Sale con 0 en cuanto /api/health devuelve 2xx.
// - Sale con 1 si se agota el tiempo; `concurrently --kill-others-on-fail`
//   apaga entonces también el agente.
//
// Variables opcionales: AGENT_HEALTH_URL y AGENT_WAIT_TIMEOUT_MS.
const url = process.env.AGENT_HEALTH_URL ?? 'http://127.0.0.1:8787/api/health';
const timeoutMs = Number(process.env.AGENT_WAIT_TIMEOUT_MS ?? 120_000);
const intervalMs = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isUp() {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false; // Aún no escucha en el puerto, o tardó demasiado en responder.
  }
}

console.log(`⏳ Esperando al agente en ${url}…`);
const start = Date.now();

while (!(await isUp())) {
  if (Date.now() - start > timeoutMs) {
    console.error(
      `✖ El agente no respondió en ${Math.round(timeoutMs / 1000)} s. ` +
        'Revisa los mensajes de [agente] arriba (¿falta `uv`? prueba con: pnpm setup:agent).',
    );
    process.exit(1);
  }
  await sleep(intervalMs);
}

console.log(`✔ Agente listo en ${((Date.now() - start) / 1000).toFixed(1)} s. Arrancando el front…`);
