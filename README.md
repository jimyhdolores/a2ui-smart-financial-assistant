# 🤖 Asistente Financiero Inteligente — Demo de Generative UI (A2UI)

Demo técnica para una charla sobre **creación de aplicaciones adaptativas con Generative UI mediante la IA integrada de Chrome (Edge AI / Gemini Nano)**, construida con **Angular 22** y **Angular Material 3**.

Es un asistente bancario ficticio pero realista: varias cuentas navegables desde un **sidebar**, un análisis inteligente de **gastos hormiga** que cambia de aspecto según el veredicto, y un **chat en lenguaje natural** donde la IA local interpreta la **intención** y responde **generando componentes visuales** (no solo texto).

---

## 🎯 ¿De qué trata el proyecto?

Este panel demuestra el patrón **A2UI (Agent-to-User Interface / Interfaz Agente-Usuario)**:

> En lugar de que el LLM genere **texto** para el usuario, el LLM decide **qué componente de interfaz renderizar** y con qué intención, devolviendo un JSON estricto. Angular actúa como el *runtime* que materializa esa decisión en componentes reales y vivos.

Todo ocurre **100% en local, dentro del navegador**, usando el modelo **Gemini Nano** integrado en Chrome. No hay servidor, no hay API key, no hay costo ni latencia de red, y los datos del usuario nunca salen del dispositivo.

### 🧠 La decisión de arquitectura clave: híbrido LLM + matemática local

Gemini Nano tiene una ventana de contexto pequeña y **no es fiable con la aritmética**. Por eso el dinero **nunca** lo calcula el modelo. La app reparte el trabajo así:

| Capa | Responsable | Qué hace |
|------|-------------|----------|
| 🗣️ **Lenguaje e intención** | Gemini Nano (on-device) | Entiende la pregunta, clasifica la intención, elige el **componente + parámetros** y redacta el **análisis narrado** |
| 🧮 **Dinero** | TypeScript determinista | Totales por categoría, gastos hormiga, comparación mes-a-mes, proyección de saldo, perfil de crédito, filtros… **todos los números** |

> 🎤 **La frase de la charla:** *"LLM para el lenguaje y la intención; matemática local para el dinero — y todo sin salir del navegador."*

Al modelo jamás se le pasa la lista cruda de movimientos: solo un **resumen compacto** (`buildContext`, <~300 tokens) con cifras ya calculadas. El modelo razona sobre lenguaje, no sobre números.

### El flujo de un turno del chat, en una frase

```
Pregunta del usuario
   └─► Gemini Nano · route()          → { componentToRender, params }   (intención)
        └─► TypeScript · buildData()  → data real del componente         (matemática)
             └─► Angular · NgComponentOutlet → componente vivo renderizado
                  └─► Gemini Nano · answerStreaming() → narrativa token a token (streaming)
```

Son **dos inferencias locales por mensaje**: una estructurada (`route`) para elegir la UI y otra en *streaming* (`answerStreaming`) para el texto que se escribe en vivo.

### Ejemplo de la "conversación" agéntica

El usuario escribe *"Quiero sacar un celular de $1200 a crédito en 12 cuotas, ¿me conviene?"* y el modelo responde **únicamente** con la intención:

```json
{
  "componentToRender": "AppCreditAdvisor",
  "params": { "product": "celular", "price": 1200, "months": 12 }
}
```

Angular toma ese `componentToRender`, TypeScript calcula la cuota, el DTI y el veredicto de riesgo de forma **determinista**, y se renderiza dinámicamente el `AppCreditAdvisor` con los números reales inyectados como *Signal Input*.

---

## 🧩 Conceptos que ilustra

| Concepto | Dónde se ve en el código |
|----------|--------------------------|
| **🧭 Enrutamiento de UI por el LLM** — el modelo elige el componente, no el desarrollador | [`GenUiService.route()`](src/app/services/gen-ui.ts) |
| **✍️ Narrativa en streaming** token a token (`promptStreaming`) | [`GenUiService.answerStreaming()`](src/app/services/gen-ui.ts) |
| **🧮 Matemática determinista del dinero** (nunca el LLM) | [`FinanceAnalyticsService`](src/app/services/finance-analytics.ts) |
| **✨ Generative UI** — un string del modelo se convierte en un componente vivo | `[ngComponentOutlet]` en [`chat.html`](src/app/dashboard/chat/chat.html) |
| **🎯 Catálogo de componentes ("bloques de Lego")** | [`src/app/ui-catalog/`](src/app/ui-catalog/) + [`component.registry.ts`](src/app/ui-catalog/component.registry.ts) |
| **📜 Contrato tipado A2UI + salida estructurada** | [`a2ui.model.ts`](src/app/models/a2ui.model.ts) (`responseConstraint` / JSON Schema) |
| **🐜 Veredicto estructurado con fallback determinista** | [`GenUiService.analyzeAntExpenses()`](src/app/services/gen-ui.ts) + [`antVerdictFallback()`](src/app/services/finance-analytics.ts) |
| **⬇️ Descarga del modelo bajo gesto del usuario** | [`GenUiService.downloadModel()`](src/app/services/gen-ui.ts) |

---

## 🎨 El catálogo generativo (6 componentes)

Estos son los "bloques de Lego" que el LLM puede invocar. Cada uno es *standalone*, recibe su `data` como `input()` y se pinta con tokens del tema (`--mat-sys-*`):

| Componente | Icono | Para qué intención | Qué muestra |
|------------|:-----:|--------------------|-------------|
| `AppSpendingReport` | 📊 | *"¿en qué gasto más?"*, resumen del mes | KPIs + **dona** de categorías + tendencia semanal + top movimientos |
| `AppAntExpense` | 🐜 | *"¿qué gastos son innecesarios?"* | **Hero que cambia de color** por veredicto + comparación mes-a-mes + **simulador "¿y si...?"** |
| `AppMovementsTable` | 📋 | *"muéstrame solo mis Yape"*, *"mi compra más grande"* | **MatTable** filtrada (fecha, comercio, categoría, monto, método) |
| `AppRecommendations` | 💡 | *"¿qué compras reducir?"* | Nivel de riesgo + tarjetas de consejo con impacto + alertas |
| `AppSavingsPlan` | 🎯 | *"¿cómo ahorro más?"* | Meta con progreso **radial** + ahorro potencial + proyección a 3 meses |
| `AppCreditAdvisor` | 💳 | *"¿me conviene un celular a crédito?"* | **Gauge** de capacidad + endeudamiento + cuota estimada + veredicto |

Los gráficos (dona, radial, gauge, barras) usan **ApexCharts** vía `ng-apexcharts`, que se **carga de forma perezosa** solo cuando se renderiza un componente con gráfico (ver [Notas de build](#-notas-de-build)).

### 🐜 El hero de gastos hormiga (la pieza estrella)

`AppAntExpense` identifica automáticamente los consumos pequeños y frecuentes (cafeterías, snacks, delivery, micro-pagos por Yape/Plin) y emite un **veredicto que cambia el aspecto de la tarjeta**:

- 🟢 **`good`** — *"Vas administrando bien tus gastos"* (borde y tinte verdes).
- 🟡 **`warning`** — *"Estás aumentando tus gastos pequeños"* (ámbar).
- 🔴 **`risk`** — *"Si continúas así podrías quedarte sin dinero antes de finalizar el mes"* (rojo).

El **texto** del veredicto lo redacta Gemini Nano (`analyzeAntExpenses`), pero si el modelo falla o no está disponible hay un **fallback determinista por umbrales** ([`antVerdictFallback`](src/app/services/finance-analytics.ts)): la tarjeta **nunca queda vacía ni rota**.

Además incluye el **simulador "¿y si...?"**: un slider que recorta un % de los gastos hormiga y **recalcula en vivo** (TypeScript puro, instantáneo, sin IA) la fecha estimada de agotamiento del saldo.

---

## 🏗️ Arquitectura

```
src/app/
├── models/
│   ├── a2ui.model.ts          # 📜 Contrato A2UI: union de componentes + JSON Schemas (router / veredicto)
│   └── finance.model.ts       # 💰 Dominio: Account, Transaction, Category, PaymentMethod + metadatos
├── services/
│   ├── gen-ui.ts              # 🧠 GenUiService: detección/descarga + route() + answerStreaming() + analyzeAntExpenses()
│   ├── finance-data.ts        # 🗃️  Dataset ficticio (3 cuentas, 6 meses de historial determinista) + signals
│   └── finance-analytics.ts   # 🧮 Matemática DETERMINISTA: categorías, hormiga, mes-a-mes, proyección, crédito, filtros
├── ui-catalog/                # 🎯 Los "bloques de Lego" que el LLM puede invocar
│   ├── shared/                #    Helpers de lectura tolerante + tema de gráficos ApexCharts
│   ├── spending-report/       #    📊 AppSpendingReport
│   ├── ant-expense/           #    🐜 AppAntExpense (hero + simulador "¿y si...?")
│   ├── movements-table/       #    📋 AppMovementsTable
│   ├── recommendations/       #    💡 AppRecommendations
│   ├── savings-plan/          #    🎯 AppSavingsPlan
│   ├── credit-advisor/        #    💳 AppCreditAdvisor
│   └── component.registry.ts  #    Mapa string → clase de componente
└── dashboard/
    ├── dashboard.ts           # 🖥️  SHELL: MatSidenav (cuentas) + MatToolbar (estado IA + descarga) + MatTabGroup
    ├── account-summary/       #    📑 Pestaña "Resumen": saldo + hero hormiga + dona + movimientos (navegables por mes + paginados)
    └── chat/                  #    💬 Pestaña "Asistente IA": mensajes + Generative UI + streaming + chips
```

> 🗓️ **Historial determinista y reproducible.** El mes actual y el anterior salen de semillas fijas; los **4 meses previos** los genera `finance-data.ts` a partir del perfil de comercios de cada cuenta usando un **PRNG con semilla** (`mulberry32` + hash `FNV-1a` de `cuenta:mes`). Así el historial es variado pero **idéntico en cada recarga** — la demo se ve igual siempre. Este historial solo alimenta la lista de movimientos: la comparación mes-a-mes y la proyección siguen mirando únicamente el mes actual y el anterior.

Construido con las **mejores prácticas de Angular 22**: componentes *standalone*, **Signals** (`signal`, `computed`, `effect`, `afterRenderEffect`), `inject()`, **Signal Inputs/Outputs** (`input()`, `output()`), `viewChild()` y el nuevo *control flow* (`@if`, `@for`). La UI usa **Angular Material 3** (tema azure/blue, tokens `--mat-sys-*`): sidenav, tabs, listas, tabla, chips, slider, progress bar, skeletons con *shimmer* y animaciones sutiles.

---

## ⚙️ Requisitos técnicos para probarlo

> ⚠️ **Importante:** esta demo depende de una API experimental del navegador. Solo funciona en **Chrome de escritorio** (no en Firefox, Safari ni móviles).

### 1. Navegador y hardware

| Requisito | Detalle |
|-----------|---------|
| **Navegador** | Google Chrome **138+** (Canary / Dev / Beta / Stable). El global `LanguageModel` ya viene **activo por defecto** en Chrome **148+** (2026). |
| **Sistema operativo** | Windows 10/11, macOS 13+ o Linux (no Android/iOS/ChromeOS). |
| **Disco** | ~22 GB libres (Chrome reserva espacio para el modelo). |
| **GPU / RAM** | >4 GB de VRAM **o** 16 GB de RAM con 4+ núcleos de CPU. |

> ✅ **No necesitas instalar Gemini Nano por separado.** Basta con Chrome: el modelo (~4 GB) lo **gestiona y descarga el propio navegador** como un componente interno compartido.

### 2. Habilitar la API (flags de Chrome)

> ℹ️ **Novedad 2026:** en Chrome **148+** la Prompt API está **activa por defecto** y el antiguo flag `#prompt-api-for-gemini-nano` **fue eliminado**. Si tu Chrome es reciente, no tienes que activar nada — verifica en la consola con `'LanguageModel' in self` (debe dar `true`).

Solo si usas una versión más antigua o el equipo no pasa el chequeo de hardware, abre `chrome://flags`, pon en **Enabled** y **reinicia**:

- `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement** (fuerza la descarga aunque el hardware no cumpla el mínimo).
- *(opcional, para evitar que el filtro de seguridad bloquee salidas)* `#text-safety-classifier` → **Disabled**.

### 3. Descargar el modelo (primera vez)

La primera vez, `LanguageModel.availability()` devuelve `"downloadable"`: el modelo aún no está en disco. Chrome **exige un gesto del usuario** (un clic) para iniciar la descarga, por eso la app muestra un **banner con botón "Descargar modelo"** y una **barra de progreso** cuando detecta ese estado. Un solo clic dispara la bajada (~4 GB, varios minutos la primera vez) y el chip de la barra superior pasa a *"Modelo local listo ✓"* al terminar.

También puedes verificar/forzar el estado desde `chrome://on-device-internals` (sección *On-device model*), que muestra el estado, la versión y la **ruta exacta** al modelo.

### 4. ¿Dónde guarda Chrome el modelo?

**La app no almacena nada.** El modelo lo guarda **Chrome** como componente del navegador (compartido por todos los sitios). En Windows:

```
# Chrome estable
%LOCALAPPDATA%\Google\Chrome\User Data\OptGuideOnDeviceModel\<versión>\weights.bin

# Chrome Canary (carpeta "Chrome SxS")
%LOCALAPPDATA%\Google\Chrome SxS\User Data\OptGuideOnDeviceModel\<versión>\weights.bin
```

- `weights.bin` (~4 GB) son los **pesos de Gemini Nano**.
- La carpeta hermana `optimization_guide_model_store` guarda solo metadatos/índice, no los pesos.
- En **macOS**: `~/Library/Application Support/Google/Chrome/OptGuideOnDeviceModel/<versión>/weights.bin`
- En **Linux**: `~/.config/google-chrome/OptGuideOnDeviceModel/<versión>/weights.bin`

> Por eso la descarga **persiste entre recargas y entre sitios**: una vez presente, `availability()` devuelve `"available"` para siempre sin volver a bajar nada.

Dentro de la app, el **chip de estado** de la barra superior refleja en tiempo real si el modelo está: *listo* ✓, *descargable*, *descargando… %* o *no disponible*.

---

## 🚀 Puesta en marcha

```bash
# 1. Instalar dependencias (usa pnpm)
pnpm install

# 2. Arrancar el servidor de desarrollo
pnpm start
```

Abre `http://localhost:4200/` en tu Chrome ya configurado (pasos anteriores).

### Cómo usar la demo

1. Revisa el **chip de estado** de la barra superior:
   - Si dice *"El modelo se puede descargar…"*, aparecerá un **banner con el botón "Descargar modelo"**. Púlsalo una vez y espera a que la barra de progreso llegue al 100% (solo la primera vez).
   - Cuando diga *"Modelo local listo (Gemini Nano) ✓"*, ya puedes usar la demo.
2. En el **sidebar** cambia entre las 3 cuentas ficticias (Débito Principal, Débito Ahorros, Tarjeta de Crédito): el saldo, el hero de gastos hormiga y los movimientos se actualizan.
3. En la pestaña **"Resumen"**, observa cómo el hero de gastos hormiga **cambia de color** según el veredicto y mueve el **slider "¿y si...?"** para recalcular la fecha de agotamiento en vivo. En la tarjeta de **movimientos**, usa las flechas de la cabecera para navegar por los **últimos 6 meses** y el pager inferior para recorrer las páginas de cada mes.
4. En la pestaña **"Asistente IA"**, pulsa un **chip de sugerencia** o escribe tu propia pregunta. Verás un **skeleton** mientras el modelo decide, luego el **componente generado** por la IA y la **narrativa escribiéndose token a token**.
5. Despliega *"Ver decisión A2UI"* bajo cada respuesta para mostrar a tu audiencia la salida cruda del modelo y el JSON de componente + params.

---

## 🔍 Cómo demostrar que la IA es real (para la charla)

La pregunta inevitable del público es: *"¿cómo sé que no es un `if/else` con respuestas quemadas?"*. Estas son las pruebas, de la más contundente a la más técnica.

### 1. 🚫 No hay llamadas de red (la prueba definitiva)

Como Gemini Nano corre **dentro del navegador**, **no existe ninguna petición HTTP**:

1. Abre **DevTools → pestaña Network**.
2. Envía una pregunta en el chat.
3. Aparece el componente y la narrativa… pero **Network sigue en 0 requests**. No hubo ningún servidor.

> 🎤 *"Si esto fuera una API en la nube, aquí verían la llamada. No hay ninguna: todo ocurrió en la GPU de este equipo."*

### 2. ✈️ Funciona sin internet

**Desconecta el WiFi / activa modo avión** y vuelve a preguntar. Sigue funcionando. Ninguna API en la nube sobrevive a esto.

### 3. 🎲 Improvisación en vivo

Un `if/else` solo responde a frases conocidas. Pide al público una frase **inventada** y escríbela en el chat:

- *"Me acaba de llegar el pago de mi freelance, ¿en qué se me va el dinero en pequeñeces?"* → `AppAntExpense`.
- *"Solo quiero ver lo que pagué con la billetera móvil"* → `AppMovementsTable` filtrado por método.

Si enruta bien frases que **nunca se programaron**, hay un modelo razonando de verdad.

### 4. ✍️ El streaming token a token

La narrativa **se escribe en vivo, palabra por palabra** con un cursor parpadeante. Ese efecto no es un truco de CSS: viene de `session.promptStreaming()`, que **cede el texto en *chunks* conforme el modelo lo genera** en el dispositivo. Un texto quemado aparecería de golpe.

### 5. 🔬 El registro interno de Chrome

Abre `chrome://on-device-internals` → pestaña **"Event Logs"** (o *Model execution*). Envía una pregunta con esa pestaña abierta: verás aparecer **cada sesión e inferencia** que la app dispara (recuerda: son **dos por mensaje** — enrutado + narrativa). Es la traza oficial de las llamadas a Gemini Nano.

### 6. 🛠️ Evidencia dentro de la propia app

La app está **instrumentada** para exponer cada llamada al modelo (ver [`GenUiService`](src/app/services/gen-ui.ts)):

- **⏱️ Badge de tiempo de inferencia** — cada respuesta muestra *"NNN ms · on-device"*. Un `if/else` sería ~0 ms; ver cientos de ms de cómputo real prueba que el modelo pensó. Se mide con `performance.now()` alrededor de `session.prompt()`.
- **📥 Salida cruda + JSON A2UI** — al desplegar *"Ver decisión A2UI"* se muestra **el texto tal cual lo devolvió el modelo** (antes del parseo) junto a la decisión ya parseada (componente + params).
- **📋 Logs en la consola del navegador** — cada enrutado imprime un grupo con el *contexto enviado*, la *salida cruda*, el *tiempo de inferencia* y la *decisión A2UI parseada*. Abre **DevTools → Console** durante la charla para mostrarlo en vivo.

---

## 🧱 Notas de build

- **ApexCharts se carga de forma perezosa.** `ng-apexcharts` importa dinámicamente `apexcharts/client` y registra `window.ApexCharts` por sí mismo, así que **no** hay script global en `angular.json` (`"scripts": []`). El *bundle* inicial se mantiene ligero y el motor de gráficos (~800 kB) solo se descarga cuando se renderiza el primer componente con gráfico.
- **Presupuestos** (`angular.json`): *initial* 1 MB warn / 1.5 MB error; *anyComponentStyle* 6 kB warn / 8 kB error. El build de producción pasa sin advertencias.

---

## 🛠️ Comandos disponibles

```bash
pnpm start        # Servidor de desarrollo (ng serve) en http://localhost:4200/
pnpm build        # Build de producción en dist/
pnpm watch        # Build incremental en modo desarrollo
pnpm test         # Pruebas unitarias
```

---

## 📚 Referencias

- [Prompt API — Guía oficial de Chrome (GoogleChrome/modern-web-guidance)](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/language-model.md)
- [Build a sentiment classifier with Chrome's Prompt API in Angular (dev.to)](https://dev.to/railsstudent/build-a-sentiment-classifier-with-chromes-prompt-api-in-angular-43ek)
- [Chrome Gemini Nano / Prompt API — requisitos (May 2026)](https://www.computeleap.com/blog/chrome-gemini-nano-prompt-api-window-ai-may-2026/)
- [Dónde guarda Chrome el modelo: el archivo `weights.bin` de Gemini Nano (Android Authority)](https://www.androidauthority.com/google-chrome-weights-bin-ai-model-download-explained-3664043/)
- [ng-apexcharts (wrapper Angular de ApexCharts)](https://apexcharts.com/docs/angular-charts/)
- [Documentación de Angular](https://angular.dev)

---

*Generado como material de apoyo para una charla técnica sobre Generative UI y Edge AI. El código incluye comentarios y banners `// 🧠`, `// ✨` y `// 🎯` que señalan los puntos clave para explicar en vivo: el enrutado por el LLM, la matemática determinista y el render generativo con `NgComponentOutlet`.*
