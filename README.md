# 🤖 Asistente Financiero Inteligente — Generative UI con Gemini Nano + A2UI

> 🔗 **Síganme en mis redes:** [linktr.ee/jimydev](https://linktr.ee/jimydev)

Demo técnica **"¿Y si la IA construyera la pantalla?"** — sobre **creación de interfaces adaptativas con Generative UI mediante la IA integrada de Chrome (Edge AI / Gemini Nano)**, construida con **Angular 22** y **Angular Material 3**.

Es un asistente bancario ficticio pero realista: varias cuentas navegables desde un **sidebar**, un análisis inteligente de **gastos hormiga**, y un **chat en lenguaje natural** donde la IA local interpreta la **intención** del usuario y responde **generando componentes visuales** (no solo texto).

La demo está organizada en **tres niveles de complejidad creciente** — Básico, Intermedio y Avanzado — accesibles desde un selector en el header. Los tres comparten el mismo cerebro (Gemini Nano) y la misma matemática determinista; lo que cambia es **cómo se materializa** la decisión del modelo en pantalla.

---

## 🎯 ¿De qué trata el proyecto?

Este panel demuestra el patrón **Agent-to-UI (Interfaz Agente-Usuario)**:

> En lugar de que el LLM genere **texto** para el usuario, el LLM decide **qué componente de interfaz renderizar** y con qué intención, devolviendo un JSON estricto. Angular actúa como el _runtime_ que materializa esa decisión en componentes reales y vivos.

Todo ocurre **100% en local, dentro del navegador**, usando el modelo **Gemini Nano** integrado en Chrome. No hay servidor, no hay API key, no hay costo ni latencia de red, y los datos del usuario nunca salen del dispositivo.

> ⚠️ **Dos sentidos de "A2UI" en esta demo.** El **patrón** Agent-to-UI (el modelo elige la UI) se ve en los **tres** niveles. El **protocolo A2UI v0.9** — un estándar concreto con _surfaces_, _data-model_ y _actions_ — es solo el nivel **Avanzado**. El nivel Intermedio implementa la misma idea con un contrato "casero" mucho más simple.

### 🧠 La decisión de arquitectura clave: híbrido LLM + matemática local

Gemini Nano tiene una ventana de contexto pequeña y **no es fiable con la aritmética**. Por eso el dinero **nunca** lo calcula el modelo. La app reparte el trabajo así:

| Capa                        | Responsable             | Qué hace                                                                                                                             |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 🗣️ **Lenguaje e intención** | Gemini Nano (on-device) | Entiende la pregunta, clasifica la intención, elige el **componente + parámetros** y redacta el **análisis narrado**                 |
| 🧮 **Dinero**               | TypeScript determinista | Totales por categoría, gastos hormiga, comparación mes-a-mes, proyección de saldo, perfil de crédito, filtros… **todos los números** |

> 🎤 **La frase de la charla:** _"LLM para el lenguaje y la intención; matemática local para el dinero — y todo sin salir del navegador."_

Al modelo jamás se le pasa la lista cruda de movimientos: solo un **resumen compacto** (`buildContext`, <~300 tokens) con cifras ya calculadas. El modelo razona sobre lenguaje, no sobre números.

### El flujo de un turno del chat, en una frase

```
Pregunta del usuario
   └─► Gemini Nano · route()          → { sections: [ { componentToRender, params }, … ] }  (intención)
        └─► TypeScript · buildData()  → data real de CADA sección        (matemática)
             └─► Angular · render     → 1..N componentes apilados en pantalla
                  └─► Gemini Nano · answerStreaming() → narrativa token a token (streaming)
```

Son hasta **dos inferencias locales por mensaje**: una estructurada (`route`) para elegir la UI —una o varias piezas— y otra en _streaming_ (`answerStreaming`) para el texto que se escribe en vivo.

### Ejemplo de la "conversación" agéntica

El usuario escribe _"Quiero sacar un celular de $1200 a crédito en 12 cuotas, ¿me conviene?"_ y el modelo responde **únicamente** con la intención — una **lista de secciones** (aquí, una sola):

```json
{
  "sections": [
    {
      "componentToRender": "AppCreditAdvisor",
      "params": { "product": "celular", "price": 1200, "months": 12 }
    }
  ]
}
```

Angular toma ese `componentToRender`, TypeScript calcula la cuota, el DTI y el veredicto de riesgo de forma **determinista**, y se renderiza dinámicamente el `AppCreditAdvisor` con los números reales inyectados como _Signal Input_.

> 🧩 **Una frase → una pantalla completa.** El enrutador devuelve **1..N secciones**. Una consulta concreta trae **una** pieza; una de panorama (_"hazme un resumen de mi mes"_) trae **varias** (KPIs + reporte + gastos hormiga + recomendaciones) que se **apilan** para formar la interfaz completa — el título de la charla hecho código. _(Solo en Intermedio y Avanzado; el nivel Básico se mantiene en 1 intención → 1 componente.)_

---

## 🪜 Los tres niveles de la demo

Cada nivel es una **ruta** propia (`/basico`, `/intermedio`, `/avanzado`) y se carga de forma perezosa (su propio _chunk_). El **header único** — con el sidebar de cuentas y el estado/descarga de Gemini Nano — es común a los tres.

| Nivel             | Ruta          | Qué enseña                                                                                                                                         | Cómo renderiza la decisión del modelo                                                                                  |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Básico**     | `/basico`     | El pipeline de Generative UI en su forma más desnuda: pregunta → schema → componente. Sin gráficos, sin protocolo. **1 intención → 1 componente.** | `routeBasic()` elige **1** de **3 componentes toy** → `NgComponentOutlet` con un registro mínimo de 3 entradas         |
| 🔵 **Intermedio** | `/intermedio` | El catálogo rico completo con un **contrato casero**: el mismo patrón, con 7 componentes de verdad y gráficos, y **composición** de varias piezas. | `route()` elige **1..N** de **7 componentes** → `@for` + `NgComponentOutlet` + `INTERMEDIO_REGISTRY` (string → clase)  |
| 🟣 **Avanzado**   | `/avanzado`   | Los **mismos 7 componentes** pero servidos por el **protocolo A2UI v0.9 real** (surfaces + data-model + actions bidireccionales).                  | `route()` (idéntico a Intermedio) → **una superficie A2UI por sección** → `<a2ui-v09-surface>` vía el renderer oficial |

> 🎓 **La moraleja Intermedio → Avanzado:** _la decisión del modelo es exactamente la misma_ (ambos usan `route()` y el contrato de [`a2ui.model.ts`](src/app/models/a2ui.model.ts)). Lo único que cambia es el **mecanismo de render**: un `NgComponentOutlet` casero frente a un protocolo estándar con _round-trip_ agéntico. Primero enseñas la idea con lo mínimo, luego muestras cómo se ve "en serio".

El nivel **Básico** existe para explicar el concepto sin ruido: tres componentes de juguete (un texto, una tarjeta de un dato, una lista) y un enrutador que solo elige entre esos tres.

---

## 🧩 Conceptos que ilustra

| Concepto                                                                                                       | Dónde se ve en el código                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🧭 Enrutamiento de UI por el LLM** — el modelo elige el componente, no el desarrollador                      | [`GenUiService.route()`](src/app/services/gen-ui.ts) (Intermedio/Avanzado) · [`routeBasic()`](src/app/services/gen-ui.ts) (Básico)                                                          |
| **🧩 Composición de varios componentes** — una consulta de panorama apila 1..N piezas en una pantalla completa | [`GenUiService.route()`](src/app/services/gen-ui.ts) → `CompositeDecision.sections` + `@for` en ambos chats                                                                                 |
| **✍️ Narrativa en streaming** token a token (`promptStreaming`)                                                | [`GenUiService.answerStreaming()`](src/app/services/gen-ui.ts)                                                                                                                              |
| **🧮 Matemática determinista del dinero** (nunca el LLM)                                                       | [`FinanceAnalyticsService`](src/app/services/finance-analytics.ts)                                                                                                                          |
| **✨ Generative UI casera** — un string del modelo se convierte en un componente vivo                          | `[ngComponentOutlet]` en [`chat.html`](src/app/pages/intermedio/chat/chat.html) + [`basico-page.html`](src/app/pages/basico/basico-page.html)                                               |
| **📡 Protocolo A2UI v0.9 real** — surfaces, data-model y actions con el renderer oficial                       | [`<a2ui-v09-surface>`](src/app/pages/avanzado/chat/chat.html) + [`finance-catalog.ts`](src/app/catalog/avanzado/finance-catalog.ts) + [`a2ui-protocol.ts`](src/app/models/a2ui-protocol.ts) |
| **🔁 Round-trip agéntico** — el componente emite un `action.event` y TypeScript devuelve un `updateDataModel`  | [`FinanceComponent.dispatch()`](src/app/catalog/avanzado/finance-component.base.ts) + [`A2uiActionService`](src/app/services/a2ui-action.service.ts)                                        |
| **🎯 Catálogos de componentes ("bloques de Lego"), uno por nivel**                                             | [`src/app/catalog/`](src/app/catalog/) — `BASICO_REGISTRY` · `INTERMEDIO_REGISTRY` · `buildFinanceCatalog()`                                                                                |
| **📜 Contrato tipado + salida estructurada**                                                                   | [`a2ui.model.ts`](src/app/models/a2ui.model.ts) + [`basico.model.ts`](src/app/models/basico.model.ts) (`responseConstraint` / JSON Schema)                                                  |
| **🐜 Veredicto determinista de gastos hormiga** (sin depender del LLM)                                         | [`antVerdictFallback()`](src/app/services/finance-analytics.ts) — umbrales por tipo de cuenta, tendencia mes-a-mes y proyección                                                            |
| **⬇️ Descarga del modelo bajo gesto del usuario** (en el header único)                                         | [`GenUiService.downloadModel()`](src/app/services/gen-ui.ts) + [`app.html`](src/app/app.html)                                                                                               |

---

## 🎨 El catálogo generativo

Los "bloques de Lego" que el LLM puede invocar. Cada uno es _standalone_, recibe su `data` ya calculado y se pinta con tokens del tema (`--mat-sys-*`).

### Intermedio y Avanzado — el catálogo rico (7 componentes)

Ambos niveles comparten el **mismo vocabulario** (la misma decisión del modelo); solo difiere el motor de render. En Intermedio cada componente recibe su `data` como `input()`; en Avanzado extiende [`FinanceComponent`](src/app/catalog/avanzado/finance-component.base.ts) y lee sus props del data-model de A2UI.

| Componente           | Icono | Para qué intención                                       | Qué muestra                                                                                    |
| -------------------- | :---: | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `AppQuickStats`      |  📌   | _"hazme un resumen de mi mes"_ (cabecera de un panorama) | **Tira compacta de KPIs**: Disponible · Gasto del mes · Gastos hormiga · Ahorro potencial      |
| `AppSpendingReport`  |  📊   | _"¿en qué gasto más?"_, resumen del mes                  | KPIs + **dona** de categorías + tendencia semanal + top movimientos                            |
| `AppAntExpense`      |  🐜   | _"¿qué gastos son innecesarios?"_                        | **Hero que cambia de color** por veredicto + comparación mes-a-mes + **simulador "¿y si...?"** |
| `AppMovementsTable`  |  📋   | _"muéstrame solo mis Yape"_, _"mi compra más grande"_    | **MatTable** filtrada (fecha, comercio, categoría, monto, método)                              |
| `AppRecommendations` |  💡   | _"¿qué compras reducir?"_                                | Nivel de riesgo + tarjetas de consejo con impacto + alertas                                    |
| `AppSavingsPlan`     |  🎯   | _"¿cómo ahorro más?"_                                    | Meta con progreso **radial** + ahorro potencial + proyección a 3 meses                         |
| `AppCreditAdvisor`   |  💳   | _"¿me conviene un celular a crédito?"_                   | **Gauge** de capacidad + endeudamiento + cuota estimada + veredicto                            |

> 🧩 **Composición.** El enrutador devuelve una **lista de secciones** (`{ sections: [...] }`), así que una sola consulta de panorama puede **apilar varias** de estas piezas en una pantalla completa; `AppQuickStats` es la **cabecera** natural de ese panel. En Intermedio se apilan con `@for` + `NgComponentOutlet`; en Avanzado, como **varias superficies A2UI** (una por sección), de modo que cada pieza conserva su propio _round-trip_.

Los gráficos (dona, radial, gauge, barras) usan **ApexCharts** vía `ng-apexcharts`, que se **carga de forma perezosa** solo cuando se renderiza un componente con gráfico (ver [Notas de build](#-notas-de-build)).

### Básico — el catálogo toy (3 componentes)

Un vocabulario mínimo para explicar el concepto sin gráficos ni protocolo:

| Componente    | Icono | Para qué intención                              | Qué muestra                                                        |
| ------------- | :---: | ----------------------------------------------- | ------------------------------------------------------------------ |
| `StatCard`    |  📊   | _"¿cuánto he gastado?"_, _"¿cuál es mi saldo?"_ | **Un solo número** clave (saldo, gasto, ingreso o mayor gasto)     |
| `SimpleList`  |  📃   | _"muéstrame mis últimos movimientos"_           | Una **lista** simple de transacciones recientes                    |
| `PlainAnswer` |  💬   | _"¿qué es un gasto hormiga?"_, consejos         | Una **respuesta en texto** (streaming) para preguntas conceptuales |

### 🐜 El hero de gastos hormiga (la pieza estrella)

`AppAntExpense` identifica automáticamente los consumos pequeños y frecuentes (cafeterías, snacks, delivery, micro-pagos por Yape/Plin) y emite un **veredicto que cambia el aspecto de la tarjeta**:

- 🟢 **`good`** — _"Vas administrando bien tus gastos"_ (borde y tinte verdes).
- 🟡 **`warning`** — _"Estás aumentando tus gastos pequeños"_ (ámbar).
- 🔴 **`risk`** — _"Si continúas así podrías quedarte sin dinero antes de finalizar el mes"_ (rojo).

El veredicto lo calcula TypeScript de forma **determinista por umbrales** ([`antVerdictFallback`](src/app/services/finance-analytics.ts)): tendencia mes-a-mes, peso relativo del gasto hormiga, proyección de agotamiento y, para tarjetas de crédito, nivel de uso de la línea. La tarjeta se renderiza instantáneamente con el estado correcto, sin depender de la disponibilidad del modelo.

Además incluye el **simulador "¿y si...?"**: un slider que recorta un % de los gastos hormiga y **recalcula en vivo** (TypeScript puro, instantáneo, sin IA) la fecha estimada de agotamiento del saldo. En el nivel Avanzado ese slider viaja como un `action.event` de A2UI y el recálculo vuelve como `updateDataModel` sobre la misma superficie.

---

## 🏗️ Arquitectura

La app separa **lo que el modelo puede generar** (`catalog/`, segmentado por nivel) de **las páginas que lo alojan** (`pages/`). Así, mirando el árbol se entiende de un vistazo qué componentes usa cada nivel.

```
src/app/
├── app.ts / app.html / app.scss   # 🖥️  SHELL único: sidebar de cuentas + header (selector de nivel +
│                                   #     estado/descarga de Gemini Nano) + <router-outlet/>
├── app.routes.ts                   # 🧭 3 rutas lazy (loadComponent) + redirect '' → 'basico'
├── app.config.ts                   # ⚙️  Providers raíz, incl. A2UI_RENDERER_CONFIG (nivel Avanzado)
│
├── models/
│   ├── finance.model.ts            # 💰 Dominio: Account, Transaction, Category, PaymentMethod + metadatos
│   ├── a2ui.model.ts               # 📜 Contrato de enrutado: union A2uiComponent + JSON Schemas (router / veredicto)
│   ├── basico.model.ts             # 📜 Contrato mínimo del nivel Básico: BasicoComponent + BASICO_ROUTER_SCHEMA
│   └── a2ui-protocol.ts            # 📡 Protocolo A2UI v0.9: catalog id, campos por componente, actions, surface ids
│
├── services/
│   ├── gen-ui.ts                   # 🧠 GenUiService: detección/descarga + route() + routeBasic() + answerStreaming()
│   ├── finance-data.ts             # 🗃️  Dataset ficticio (3 cuentas, 6 meses de historial determinista) + signals
│   ├── finance-analytics.ts        # 🧮 Matemática DETERMINISTA: categorías, hormiga, mes-a-mes, proyección, crédito, filtros
│   ├── a2ui-message-builder.ts     # 📡 Arma el documento/mensaje A2UI que consume la surface (Avanzado)
│   └── a2ui-action.service.ts      # 🔁 Handler global de actions A2UI: recalcula en TS y devuelve updateDataModel (Avanzado)
│
├── catalog/                        # 🎯 Los "bloques de Lego" que el LLM puede invocar, por nivel
│   ├── basico/                     #    🟢 3 componentes toy + basico-catalog.ts → BASICO_REGISTRY
│   │   ├── plain-answer/           #       💬 PlainAnswer (respuesta en texto)
│   │   ├── stat-card/              #       📊 StatCard (un dato)
│   │   └── simple-list/            #       📃 SimpleList (lista simple)
│   ├── intermedio/                 #    🔵 7 componentes caseros (input data) + intermedio-catalog.ts → INTERMEDIO_REGISTRY
│   │   ├── quick-stats/  spending-report/  ant-expense/  movements-table/
│   │   └── recommendations/  savings-plan/  credit-advisor/
│   ├── avanzado/                   #    🟣 los 7 vía protocolo A2UI (extends FinanceComponent)
│   │   ├── quick-stats/  spending-report/  ant-expense/  movements-table/
│   │   ├── recommendations/  savings-plan/ credit-advisor/
│   │   ├── finance-catalog.ts      #       buildFinanceCatalog(): el AngularCatalog A2UI
│   │   └── finance-component.base.ts  #    FinanceComponent: base con lectores tolerantes + dispatch()
│   └── shared/                     #    🔧 Utilidades transversales (Básico/Intermedio ↔ Avanzado)
│       ├── chart-theme.ts          #       Tema y fábricas de gráficos ApexCharts (Intermedio + Avanzado)
│       └── data-access.ts          #       Lectores tolerantes str/num/bool/arr (Básico + Intermedio)
│
└── pages/                          # 🧱 Las páginas que alojan cada nivel (el "chrome")
    ├── basico/                     #    basico-page: un único chat (routeBasic → NgComponentOutlet)
    ├── intermedio/                 #    intermedio-page (MatTabGroup) + account-summary/ + chat/
    └── avanzado/                   #    avanzado-page (MatTabGroup) + account-summary/ + chat/ (A2UI)
```

> 🗓️ **Historial determinista y reproducible.** El mes actual y el anterior salen de semillas fijas; los **4 meses previos** los genera `finance-data.ts` a partir del perfil de comercios de cada cuenta usando un **PRNG con semilla** (`mulberry32` + hash `FNV-1a` de `cuenta:mes`). Así el historial es variado pero **idéntico en cada recarga** — la demo se ve igual siempre. Este historial solo alimenta la lista de movimientos: la comparación mes-a-mes y la proyección siguen mirando únicamente el mes actual y el anterior.

Construido con las **mejores prácticas de Angular 22**: componentes _standalone_, **Signals** (`signal`, `computed`, `effect`, `afterRenderEffect`), `inject()`, **Signal Inputs/Outputs** (`input()`, `output()`), `viewChild()`, el nuevo _control flow_ (`@if`, `@for`) y **rutas perezosas** (`loadComponent`). La UI usa **Angular Material 3** (tema azure/blue, tokens `--mat-sys-*`): sidenav, tabs, listas, tabla, chips, slider, progress bar, skeletons con _shimmer_ y animaciones sutiles. El nivel Avanzado suma **`@a2ui/angular/v0_9`** y **`@a2ui/web_core/v0_9`** (el renderer oficial del protocolo A2UI).

---

## ⚙️ Requisitos técnicos para probarlo

> ⚠️ **Importante:** esta demo depende de una API experimental del navegador. Solo funciona en **Chrome de escritorio** (no en Firefox, Safari ni móviles).

### 1. Navegador y hardware

| Requisito             | Detalle                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navegador**         | Google Chrome **138+** (Canary / Dev / Beta / Stable). El global `LanguageModel` ya viene **activo por defecto** en Chrome **148+** (2026). |
| **Sistema operativo** | Windows 10/11, macOS 13+, Linux o ChromeOS en **Chromebook Plus** (no Android/iOS ni Chromebooks normales).                                 |
| **Disco**             | ~22 GB libres (Chrome reserva espacio para el modelo).                                                                                      |
| **GPU / RAM**         | >4 GB de VRAM **o** 16 GB de RAM con 4+ núcleos de CPU.                                                                                     |

> ✅ **No necesitas instalar Gemini Nano por separado.** Basta con Chrome: el modelo (~4 GB) lo **gestiona y descarga el propio navegador** como un componente interno compartido.

### 2. Habilitar la API (flags de Chrome)

> ℹ️ **Novedad 2026:** en Chrome **148+** la Prompt API está **activa por defecto** y el antiguo flag `#prompt-api-for-gemini-nano` **fue eliminado**. Si tu Chrome es reciente, no tienes que activar nada — verifica en la consola con `'LanguageModel' in self` (debe dar `true`).

Solo si usas una versión más antigua o el equipo no pasa el chequeo de hardware, abre `chrome://flags`, pon en **Enabled** y **reinicia**:

- `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement** (fuerza la descarga aunque el hardware no cumpla el mínimo).
- _(opcional, para evitar que el filtro de seguridad bloquee salidas)_ `#text-safety-classifier` → **Disabled**.

### 3. Descargar el modelo (primera vez)

La primera vez, `LanguageModel.availability()` devuelve `"downloadable"`: el modelo aún no está en disco. Chrome **exige un gesto del usuario** (un clic) para iniciar la descarga, por eso la app muestra un **banner con botón "Descargar modelo"** y una **barra de progreso** en el header cuando detecta ese estado. Un solo clic dispara la bajada (~4 GB, varios minutos la primera vez) y el chip de la barra superior pasa a _"Modelo local listo ✓"_ al terminar. Como el header es único, ese estado es visible en los tres niveles.

También puedes verificar/forzar el estado desde `chrome://on-device-internals` (sección _On-device model_), que muestra el estado, la versión y la **ruta exacta** al modelo.

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

Dentro de la app, el **chip de estado** de la barra superior refleja en tiempo real si el modelo está: _listo_ ✓, _descargable_, _descargando… %_ o _no disponible_.

---

## 🚀 Puesta en marcha

```bash
# 1. Instalar dependencias (usa pnpm)
pnpm install

# 2. Arrancar el servidor de desarrollo
pnpm start
```

Abre `http://localhost:4200/` en tu Chrome ya configurado (pasos anteriores). La app redirige a `/basico` por defecto.

### Cómo usar la demo

1. Revisa el **chip de estado** del header:
   - Si dice _"El modelo se puede descargar…"_, aparecerá un **banner con el botón "Descargar modelo"**. Púlsalo una vez y espera a que la barra de progreso llegue al 100% (solo la primera vez).
   - Cuando diga _"Modelo local listo (Gemini Nano) ✓"_, ya puedes usar la demo.
2. Usa el **selector de nivel** del header para moverte entre **Básico**, **Intermedio** y **Avanzado**. El sidebar de cuentas y el estado del modelo se conservan en los tres.
3. En el **sidebar** cambia entre las 3 cuentas ficticias (Débito Principal, Débito Ahorros, Tarjeta de Crédito): el saldo, el hero de gastos hormiga y los movimientos se actualizan.
4. **Empieza en Básico**: pregunta _"¿cuánto he gastado?"_ o _"¿qué es un gasto hormiga?"_ y observa cómo Nano elige entre 3 componentes toy — sin gráficos ni protocolo, el concepto puro.
5. **Sube a Intermedio**: en _"Resumen"_ verás el hero de gastos hormiga con su veredicto de color (verde/ámbar/rojo según tus datos) y el **slider "¿y si...?"**; en _"Asistente IA"_ pulsa un chip o escribe tu pregunta y verás el **skeleton → componente generado → narrativa en streaming**. Prueba el chip **"Resumen de mi mes"**: Nano elige **varias** piezas y se **apila una pantalla completa** (KPIs + reporte + hormiga + consejos).
6. **Termina en Avanzado**: el mismo chat, pero el componente lo materializa el **protocolo A2UI real**; el slider y los filtros hacen _round-trip_ (`updateDataModel`) y el toggle muestra el JSON A2UI estándar.
7. Despliega _"Ver decisión"_ / _"Ver cómo decidió Nano"_ bajo cada respuesta para mostrar a tu audiencia la salida cruda del modelo y el JSON de componente + params.

---

## 🔍 Cómo demostrar que la IA es real (para la charla)

La pregunta inevitable del público es: _"¿cómo sé que no es un `if/else` con respuestas quemadas?"_. Estas son las pruebas, de la más contundente a la más técnica.

### 1. 🚫 No hay llamadas de red (la prueba definitiva)

Como Gemini Nano corre **dentro del navegador**, **no existe ninguna petición HTTP**:

1. Abre **DevTools → pestaña Network**.
2. Envía una pregunta en el chat.
3. Aparece el componente y la narrativa… pero **Network sigue en 0 requests**. No hubo ningún servidor.

> 🎤 _"Si esto fuera una API en la nube, aquí verían la llamada. No hay ninguna: todo ocurrió en la GPU de este equipo."_

### 2. ✈️ Funciona sin internet

**Desconecta el WiFi / activa modo avión** y vuelve a preguntar. Sigue funcionando. Ninguna API en la nube sobrevive a esto.

### 3. 🎲 Improvisación en vivo

Un `if/else` solo responde a frases conocidas. Pide al público una frase **inventada** y escríbela en el chat:

- _"Me acaba de llegar el pago de mi freelance, ¿en qué se me va el dinero en pequeñeces?"_ → `AppAntExpense`.
- _"Solo quiero ver lo que pagué con la billetera móvil"_ → `AppMovementsTable` filtrado por método.

Si enruta bien frases que **nunca se programaron**, hay un modelo razonando de verdad.

### 4. ✍️ El streaming token a token

La narrativa **se escribe en vivo, palabra por palabra** con un cursor parpadeante. Ese efecto no es un truco de CSS: viene de `session.promptStreaming()`, que **cede el texto en _chunks_ conforme el modelo lo genera** en el dispositivo. Un texto quemado aparecería de golpe.

### 5. 🔬 El registro interno de Chrome

Abre `chrome://on-device-internals` → pestaña **"Event Logs"** (o _Model execution_). Envía una pregunta con esa pestaña abierta: verás aparecer **cada sesión e inferencia** que la app dispara (recuerda: son hasta **dos por mensaje** — enrutado + narrativa). Es la traza oficial de las llamadas a Gemini Nano.

### 6. 🛠️ Evidencia dentro de la propia app

La app está **instrumentada** para exponer cada llamada al modelo (ver [`GenUiService`](src/app/services/gen-ui.ts)):

- **⏱️ Badge de tiempo de inferencia** — cada respuesta muestra _"NNN ms · on-device"_. Un `if/else` sería ~0 ms; ver cientos de ms de cómputo real prueba que el modelo pensó. Se mide con `performance.now()` alrededor de `session.prompt()`.
- **📥 Salida cruda + JSON** — al desplegar _"Ver decisión"_ se muestra **el texto tal cual lo devolvió el modelo** (antes del parseo) junto a la decisión ya parseada (componente + params).
- **📋 Logs en la consola del navegador** — cada enrutado imprime un grupo con el _contexto enviado_, la _salida cruda_, el _tiempo de inferencia_ y la _decisión parseada_. Abre **DevTools → Console** durante la charla para mostrarlo en vivo.

---

## 🧱 Notas de build

- **Rutas perezosas por nivel.** Cada nivel se carga con `loadComponent` ([`app.routes.ts`](src/app/app.routes.ts)) y genera su propio _chunk_ (`basico-page`, `intermedio-page`, `avanzado-page`). Así el nivel Básico arranca ligero, sin arrastrar ApexCharts ni las 6 tarjetas del catálogo, que solo se descargan al entrar a Intermedio/Avanzado.
- **ApexCharts se carga de forma perezosa.** `ng-apexcharts` importa dinámicamente `apexcharts/client` y registra `window.ApexCharts` por sí mismo, así que **no** hay script global en `angular.json` (`"scripts": []`). El motor de gráficos (~800 kB) solo se descarga cuando se renderiza el primer componente con gráfico.
- **El renderer A2UI vive en la raíz.** `A2UI_RENDERER_CONFIG` se provee en [`app.config.ts`](src/app/app.config.ts) y `A2uiRendererService` es `providedIn: 'root'`, así que el nivel Avanzado puede cargarse de forma perezosa sin problemas de inyección. Es inocuo para Básico/Intermedio.
- **Presupuestos** (`angular.json`): _initial_ 1 MB warn / 1.5 MB error; _anyComponentStyle_ 6 kB warn / 8 kB error. El build de producción pasa sin advertencias (_bundle_ inicial ~960 kB).

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
