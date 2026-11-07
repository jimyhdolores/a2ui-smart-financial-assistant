# Asistente Financiero Inteligente — Generative UI con Gemini Nano + A2UI

> **Síganme en mis redes:** [linktr.ee/jimydev](https://linktr.ee/jimydev)

Demo técnica **"¿Y si la IA construyera la pantalla?"** — sobre **creación de interfaces adaptativas con Generative UI mediante la IA integrada de Chrome (Edge AI / Gemini Nano)**, construida con **Angular 22** y **Angular Material 3**.

Es un asistente bancario ficticio pero realista: varias cuentas navegables desde un **sidebar**, un análisis inteligente de **gastos hormiga**, y un **chat en lenguaje natural** donde la IA local interpreta la **intención** del usuario y responde **generando componentes visuales** (no solo texto).

La demo está organizada en **tres niveles de complejidad creciente** — Básico, Intermedio y Avanzado — accesibles desde un selector en el header. Los tres comparten el mismo cerebro (Gemini Nano) y la misma matemática determinista; lo que cambia es **cómo se materializa** la decisión del modelo en pantalla.

El repo es un **monorepo**: el front Angular (`apps/web`), un **agente en Python** (`apps/agent`) y el **contrato A2UI** que comparten (`packages/a2ui-catalog`). En el nivel Avanzado, un interruptor muda el agente del navegador a ese servidor, donde un modelo más grande (**Gemini 4 Argon**) diseña la pantalla y los mensajes A2UI viajan por la red. Ver [El agente en un servidor](#el-agente-en-un-servidor-interruptor-del-nivel-avanzado).

### Índice

**Si vienes de la charla y quieres entender el código, empieza por estas tres:**
["A2UI" significa dos cosas](#lee-esto-primero-a2ui-significa-dos-cosas-distintas) · [Mapa de contratos](#mapa-de-contratos-qué-es-obligatorio-y-qué-me-inventé-yo) · [El protocolo A2UI, en concreto](#el-protocolo-a2ui-en-concreto-nivel-avanzado)

| | |
| --- | --- |
| [¿De qué trata?](#de-qué-trata-el-proyecto) | La idea, el reparto LLM/TypeScript y el flujo de un turno |
| [Los tres niveles](#los-tres-niveles-de-la-demo) | Qué enseña cada uno y en qué se diferencian |
| [Mapa de contratos](#mapa-de-contratos-qué-es-obligatorio-y-qué-me-inventé-yo) | Las tres estructuras JSON del proyecto y cuál es obligatoria |
| [El catálogo generativo](#el-catálogo-generativo) | Los componentes que el modelo puede invocar |
| [El protocolo A2UI](#el-protocolo-a2ui-en-concreto-nivel-avanzado) | Qué viaja, la lista blanca y cuándo aporta de verdad |
| [El agente en un servidor](#el-agente-en-un-servidor-interruptor-del-nivel-avanzado) | El interruptor local/servidor: qué cruza la red y la frontera de confianza |
| [Arquitectura](#arquitectura) | El monorepo y el árbol de carpetas comentado |
| [Requisitos](#requisitos-técnicos-para-probarlo) · [Puesta en marcha](#puesta-en-marcha) | Chrome, flags, descarga del modelo y cómo recorrer la demo |
| [Demostrar que la IA es real](#cómo-demostrar-que-la-ia-es-real-para-la-charla) | Las pruebas en vivo para el público |

---

## ¿De qué trata el proyecto?

Este panel demuestra el patrón **Agent-to-UI (Interfaz Agente-Usuario)**:

> En lugar de que el LLM genere **texto** para el usuario, el LLM decide **qué componente de interfaz renderizar** y con qué intención, devolviendo un JSON con esa decisión. Angular actúa como el _runtime_ que materializa esa decisión en componentes reales y vivos.

En los tres niveles, el agente local ocurre **100% dentro del navegador**, usando el modelo **Gemini Nano** integrado en Chrome. No hay servidor, no hay API key, no hay costo ni latencia de red, y los datos del usuario nunca salen del dispositivo. (La excepción es deliberada y opcional: el interruptor **"En el servidor"** del nivel Avanzado, que existe justamente para mostrar qué cambia cuando el agente vive lejos.)

### Lee esto primero: "A2UI" significa dos cosas distintas

Es **la** fuente de confusión de este proyecto, así que va por delante:

| | El **patrón** Agent-to-UI | El **protocolo** A2UI v1.0 |
| --- | --- | --- |
| Qué es | La idea general: *el modelo elige la UI, no el desarrollador* | Un estándar concreto de [a2ui.org](https://a2ui.org/), con _surfaces_, _data-model_ y _actions_ |
| Quién lo define | Nadie — es un patrón de diseño | El proyecto A2UI (Google + comunidad) |
| Dónde se ve | En los **tres** niveles | **Solo** en el nivel Avanzado |
| En el código | `ui-router.model.ts`, `basico.model.ts` | `a2ui-protocol.ts`, `catalog/avanzado/`, `a2ui-*.service.ts` |

Los niveles Básico e Intermedio implementan **el patrón** con un contrato inventado para esta demo. **No usan el protocolo.** Por eso ningún archivo suyo lleva "a2ui" en el nombre: si ves `a2ui` en una ruta, es nivel Avanzado.

> **Dicho en una frase:** _"Los tres niveles dejan que la IA elija la pantalla. Solo el último lo hace con un estándar abierto en vez de con código mío."_

### La decisión de arquitectura clave: híbrido LLM + matemática local

Gemini Nano tiene una ventana de contexto pequeña y **no es fiable con la aritmética**. Por eso el dinero **nunca** lo calcula el modelo. La app reparte el trabajo así:

| Capa                     | Responsable             | Qué hace                                                                                                                               |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Lenguaje e intención** | Gemini Nano (on-device) | Entiende la pregunta, clasifica la intención, elige el **componente + parámetros** y redacta el **análisis narrado**                   |
| **Dinero**               | TypeScript determinista | Totales por categoría, gastos hormiga, comparación mes-a-mes, proyección de saldo, perfil de crédito, filtros… **todos los números**   |

> **La frase de la charla:** _"LLM para el lenguaje y la intención; matemática local para el dinero — y todo sin salir del navegador."_

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

> **Una frase → una pantalla completa.** El enrutador devuelve **1..N secciones**. Una consulta concreta trae **una** pieza; una de panorama (_"hazme un resumen de mi mes"_) trae **varias** (KPIs + reporte + gastos hormiga + recomendaciones) que se **apilan** para formar la interfaz completa — el título de la charla hecho código. _(Solo en Intermedio y Avanzado; el nivel Básico se mantiene en 1 intención → 1 componente.)_

---

## Los tres niveles de la demo

Cada nivel es una **ruta** propia (`/basico`, `/intermedio`, `/avanzado`) y se carga de forma perezosa (su propio _chunk_). El **header único** — con el sidebar de cuentas y el estado/descarga de Gemini Nano — es común a los tres.

| Nivel          | Ruta          | Qué enseña                                                                                                                                         | Cómo renderiza la decisión del modelo                                                                                  |
| -------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Básico**     | `/basico`     | El pipeline de Generative UI en su forma más desnuda: pregunta → schema → componente. Sin gráficos, sin protocolo. **1 intención → 1 componente.** | `routeBasic()` elige **1** de **3 componentes toy** → `NgComponentOutlet` con un registro mínimo de 3 entradas         |
| **Intermedio** | `/intermedio` | El catálogo rico completo con un **contrato casero**: el mismo patrón, con 7 componentes de verdad y gráficos, y **composición** de varias piezas. | `route()` elige **1..N** de **7 componentes** → `@for` + `NgComponentOutlet` + `INTERMEDIO_REGISTRY` (string → clase)  |
| **Avanzado**   | `/avanzado`   | Los **mismos 7 componentes** pero servidos por el **protocolo A2UI v1.0 real** (surfaces + data-model + actions bidireccionales).                  | `route()` (idéntico a Intermedio) → **una superficie A2UI por sección** → `<a2ui-v09-surface>` vía el renderer oficial |

> **La moraleja Intermedio → Avanzado:** _la decisión del modelo es exactamente la misma_ (ambos usan `route()` y el contrato de [`ui-router.model.ts`](apps/web/src/app/models/ui-router.model.ts)). Lo único que cambia es el **mecanismo de render**: un `NgComponentOutlet` casero frente a un protocolo estándar con _round-trip_ agéntico. Primero enseñas la idea con lo mínimo, luego muestras cómo se ve "en serio".

> **Por qué el contrato del enrutador NO se llama "A2UI".** Es a propósito: [`ui-router.model.ts`](apps/web/src/app/models/ui-router.model.ts) es un contrato **propio** de esta demo (un JSON Schema de tres líneas), y lo usan por igual Intermedio y Avanzado. El protocolo A2UI de verdad vive aparte, en [`a2ui-protocol.ts`](apps/web/src/app/models/a2ui-protocol.ts), y **solo** aparece en Avanzado. Así, al abrir cualquier archivo, el nombre te dice a qué nivel pertenece.

El nivel **Básico** existe para explicar el concepto sin ruido: tres componentes de juguete (un texto, una tarjeta de un dato, una lista) y un enrutador que solo elige entre esos tres.

---

## Mapa de contratos: qué es obligatorio y qué me inventé yo

En el proyecto conviven **tres** estructuras JSON, y confundirlas es fácil porque las tres parecen "el formato". Solo una es obligatoria:

| # | Estructura | ¿Obligatoria? | ¿Quién la impone? | Si se incumple |
| --- | --- | --- | --- | --- |
| 1 | **La decisión del modelo**<br>`{ sections: [ { componentToRender, params } ] }` | **No** — inventada para esta demo | Nadie: es una decisión de diseño | Nada; podría cambiarse mañana |
| 2 | **Chrome cumpliendo esa decisión**<br>`responseConstraint` | Se _intenta_, sin garantía formal | Chrome, restringiendo la generación | `SyntaxError` — por eso el parseo es defensivo |
| 3 | **Los mensajes A2UI**<br>`createSurface`, `updateComponents`… | **Sí, totalmente** | La especificación A2UI v1.0 | `A2uiStateError` / `A2uiValidationError` |

**La diferencia de fondo:** a un LLM solo puedes _pedirle_ y luego validar — se equivoca, envuelve el JSON en markdown, inventa nombres. A tu propio código puedes _exigirle_, y si falla debe reventar ruidosamente, porque eso es un bug, no una alucinación.

> **El malentendido más común:** *"Gemini Nano genera el A2UI"*. **No.** El modelo produce la estructura 1 — un objeto pequeño con nombres de componente. Es TypeScript quien lo traduce después a mensajes A2UI ([`A2uiMessageBuilder`](apps/web/src/app/services/a2ui-message-builder.ts)). Fue una decisión deliberada: meterle a un modelo on-device el schema completo del protocolo le costaría casi toda su ventana de contexto y saldría peor.

### Sobre `responseConstraint` (fila 2)

La [Prompt API de Chrome](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api) restringe la generación a tu JSON Schema, así que la salida es JSON parseable en vez de texto con markdown alrededor. Pero **la especificación no promete cumplimiento garantizado**: si el navegador no logra producir una respuesta conforme lanza `SyntaxError`, y si el schema usa palabras clave no soportadas, `NotSupportedError`.

Por eso [`GenUiService`](apps/web/src/app/services/gen-ui.ts) lleva cinturón y tirantes: `extractJson()` limpia posibles _fences_ de markdown y `parseDecision()` vuelve a comprobar que el nombre esté en `UI_COMPONENTS` aunque el `enum` ya debiera haberlo impedido.

---

## Conceptos que ilustra

| Concepto                                                                                                    | Dónde se ve en el código                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enrutamiento de UI por el LLM** — el modelo elige el componente, no el desarrollador                      | [`GenUiService.route()`](apps/web/src/app/services/gen-ui.ts) (Intermedio/Avanzado) · [`routeBasic()`](apps/web/src/app/services/gen-ui.ts) (Básico)                                                          |
| **Composición de varios componentes** — una consulta de panorama apila 1..N piezas en una pantalla completa | [`GenUiService.route()`](apps/web/src/app/services/gen-ui.ts) → `CompositeDecision.sections` + `@for` en ambos chats                                                                                 |
| **Narrativa en streaming** token a token (`promptStreaming`)                                                | [`GenUiService.answerStreaming()`](apps/web/src/app/services/gen-ui.ts)                                                                                                                              |
| **Matemática determinista del dinero** (nunca el LLM)                                                       | [`FinanceAnalyticsService`](apps/web/src/app/services/finance-analytics.ts)                                                                                                                          |
| **Generative UI casera** — un string del modelo se convierte en un componente vivo                          | `[ngComponentOutlet]` en [`chat.html`](apps/web/src/app/pages/intermedio/chat/chat.html) + [`basico-page.html`](apps/web/src/app/pages/basico/basico-page.html)                                               |
| **Protocolo A2UI v1.0 real** — surfaces, data-model y actions con el renderer oficial                       | [`<a2ui-v09-surface>`](apps/web/src/app/pages/avanzado/chat/chat.html) + [`finance-catalog.ts`](apps/web/src/app/catalog/avanzado/finance-catalog.ts) + [`a2ui-protocol.ts`](apps/web/src/app/models/a2ui-protocol.ts) |
| **Round-trip agéntico** — el componente emite un `action.event` y TypeScript devuelve un `updateDataModel`  | [`FinanceComponent.dispatch()`](apps/web/src/app/catalog/avanzado/finance-component.base.ts) + [`A2uiActionService`](apps/web/src/app/services/a2ui-action.service.ts)                                        |
| **Catálogos de componentes ("bloques de Lego"), uno por nivel**                                             | [`src/app/catalog/`](apps/web/src/app/catalog/) — `BASICO_REGISTRY` · `INTERMEDIO_REGISTRY` · `buildFinanceCatalog()`                                                                                |
| **Contrato tipado + salida estructurada**                                                                   | [`ui-router.model.ts`](apps/web/src/app/models/ui-router.model.ts) + [`basico.model.ts`](apps/web/src/app/models/basico.model.ts) (`responseConstraint` / JSON Schema)                                        |
| **Prompt engineering a la vista** — las tres "personalidades" del mismo modelo, en archivos propios         | [`services/prompts/`](apps/web/src/app/services/prompts/) — enrutador básico · enrutador completo · asesor                                                                                           |
| **Veredicto determinista de gastos hormiga** (sin depender del LLM)                                         | [`antVerdictFallback()`](apps/web/src/app/services/finance-analytics.ts) — umbrales por tipo de cuenta, tendencia mes-a-mes y proyección                                                            |
| **Descarga del modelo bajo gesto del usuario** (en el header único)                                         | [`GenUiService.downloadModel()`](apps/web/src/app/services/gen-ui.ts) + [`app.html`](apps/web/src/app/app.html)                                                                                               |

---

## El catálogo generativo

Los "bloques de Lego" que el LLM puede invocar. Cada uno es _standalone_, recibe su `data` ya calculado y se pinta con tokens del tema (`--mat-sys-*`).

### Intermedio y Avanzado — el catálogo rico (7 componentes)

Ambos niveles comparten el **mismo vocabulario** (la misma decisión del modelo); solo difiere el motor de render. En Intermedio cada componente recibe su `data` como `input()`; en Avanzado extiende [`FinanceComponent`](apps/web/src/app/catalog/avanzado/finance-component.base.ts) y lee sus props del data-model de A2UI.

| Componente           | Para qué intención                                       | Qué muestra                                                                                    |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `AppQuickStats`      | _"hazme un resumen de mi mes"_ (cabecera de un panorama) | **Tira compacta de KPIs**: Disponible · Gasto del mes · Gastos hormiga · Ahorro potencial      |
| `AppSpendingReport`  | _"¿en qué gasto más?"_, resumen del mes                  | KPIs + **dona** de categorías + tendencia semanal + top movimientos                            |
| `AppAntExpense`      | _"¿qué gastos son innecesarios?"_                        | **Hero que cambia de color** por veredicto + comparación mes-a-mes + **simulador "¿y si...?"** |
| `AppMovementsTable`  | _"muéstrame solo mis Yape"_, _"mi compra más grande"_    | **MatTable** filtrada (fecha, comercio, categoría, monto, método)                              |
| `AppRecommendations` | _"¿qué compras reducir?"_                                | Nivel de riesgo + tarjetas de consejo con impacto + alertas                                    |
| `AppSavingsPlan`     | _"¿cómo ahorro más?"_                                    | Meta con progreso **radial** + ahorro potencial + proyección a 3 meses                         |
| `AppCreditAdvisor`   | _"¿me conviene un celular a crédito?"_                   | **Gauge** de capacidad + endeudamiento + cuota estimada + veredicto                            |

> **Composición.** El enrutador devuelve una **lista de secciones** (`{ sections: [...] }`), así que una sola consulta de panorama puede **apilar varias** de estas piezas en una pantalla completa; `AppQuickStats` es la **cabecera** natural de ese panel. En Intermedio se apilan con `@for` + `NgComponentOutlet`; en Avanzado, como **varias superficies A2UI** (una por sección), de modo que cada pieza conserva su propio _round-trip_.

Los gráficos (dona, radial, gauge, barras) usan **ApexCharts** vía `ng-apexcharts`, que se **carga de forma perezosa** solo cuando se renderiza un componente con gráfico (ver [Notas de build](#notas-de-build)).

### Básico — el catálogo toy (3 componentes)

Un vocabulario mínimo para explicar el concepto sin gráficos ni protocolo:

| Componente    | Para qué intención                              | Qué muestra                                                        |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| `StatCard`    | _"¿cuánto he gastado?"_, _"¿cuál es mi saldo?"_ | **Un solo número** clave (saldo, gasto, ingreso o mayor gasto)     |
| `SimpleList`  | _"muéstrame mis últimos movimientos"_           | Una **lista** simple de transacciones recientes                    |
| `PlainAnswer` | _"¿qué es un gasto hormiga?"_, consejos         | Una **respuesta en texto** (streaming) para preguntas conceptuales |

### El hero de gastos hormiga (la pieza estrella)

`AppAntExpense` identifica automáticamente los consumos pequeños y frecuentes (cafeterías, snacks, delivery, micro-pagos por Yape/Plin) y emite un **veredicto que cambia el aspecto de la tarjeta**:

- **`good`** — _"Vas administrando bien tus gastos"_ (borde y tinte verdes).
- **`warning`** — _"Estás aumentando tus gastos pequeños"_ (ámbar).
- **`risk`** — _"Si continúas así podrías quedarte sin dinero antes de finalizar el mes"_ (rojo).

El veredicto lo calcula TypeScript de forma **determinista por umbrales** ([`antVerdictFallback`](apps/web/src/app/services/finance-analytics.ts)): tendencia mes-a-mes, peso relativo del gasto hormiga, proyección de agotamiento y, para tarjetas de crédito, nivel de uso de la línea. La tarjeta se renderiza instantáneamente con el estado correcto, sin depender de la disponibilidad del modelo.

Además incluye el **simulador "¿y si...?"**: un slider que recorta un % de los gastos hormiga y **recalcula en vivo** (TypeScript puro, instantáneo, sin IA) la fecha estimada de agotamiento del saldo. En el nivel Avanzado ese slider viaja como un `action.event` de A2UI y el recálculo vuelve como `updateDataModel` sobre la misma superficie.

---

## El protocolo A2UI, en concreto (nivel Avanzado)

### Qué viaja realmente

Son **cuatro** tipos de mensaje JSON, y un mensaje solo puede llevar uno:

| Mensaje | Qué hace | Dónde se genera |
| --- | --- | --- |
| `createSurface` | Abre un lienzo y declara qué catálogo se usa | [`A2uiMessageBuilder`](apps/web/src/app/services/a2ui-message-builder.ts) |
| `updateComponents` | La **estructura**: qué componente y de dónde saca cada prop | ídem |
| `updateDataModel` | Los **datos** que rellenan esos punteros | ídem (`updateData` / `patch`) |
| `deleteSurface` | Destruye un lienzo | — _no se usa: el chat conserva el historial_ |

Un turno completo son estos tres objetos (protocolo **v1.0**, la versión vigente de la especificación):

```jsonc
[
  { "version": "1.0",
    "createSurface": { "surfaceId": "finance-1-0", "catalogId": "https://…/finance/v1_0" } },

  // La ESTRUCTURA. Fíjate: aquí no viaja ni un número, solo punteros.
  { "version": "1.0",
    "updateComponents": { "surfaceId": "finance-1-0",
      "components": [ { "id": "root", "component": "AppQuickStats",
                        "currency": { "@path": "/data/currency" },
                        "items":    { "@path": "/data/items" } } ] } },

  // Los DATOS, calculados en TypeScript.
  { "version": "1.0",
    "updateDataModel": { "surfaceId": "finance-1-0", "path": "/data",
                         "value": { "currency": "$", "items": [ … ] } } }
]
```

Esa separación estructura/datos es la tesis del proyecto hecha protocolo — *"el LLM decide la intención, TypeScript pone el dinero"* — y permite luego cambiar un solo valor con `patch()` sin reenviar la pantalla entera. Puedes verlo en vivo: en el nivel Avanzado, despliega **"Ver protocolo A2UI"** bajo cualquier respuesta.

> **Qué cambió de v0.9 a v1.0** (lo que se ve en este ejemplo): la versión se escribe `"1.0"`; los punteros llevan arroba (`{"@path": …}`) para que nunca se confundan con un dato normal; y `updateDataModel` siempre trae `value` (mandar `null` borra el dato). v1.0 también permitiría mandar todo en un único `createSurface` con los componentes y los datos dentro: aquí lo dejamos en tres mensajes porque así se ve la separación.

### El catálogo es una lista blanca (aquí está la gracia)

El catálogo tiene dos mitades:

1. **El contrato**, en [`finance-catalog.v1.json`](packages/a2ui-catalog/finance-catalog.v1.json): un documento de catálogo A2UI estándar que dice qué componentes existen y qué campos acepta cada uno (texto, número, sí/no o un valor libre; siempre como dato fijo o como puntero). Vive en un paquete compartido del monorepo: es **el mismo archivo** que lee el agente Python del servidor.
2. **Las caras**, en [`buildFinanceCatalog()`](apps/web/src/app/catalog/avanzado/finance-catalog.ts): `Catalog.fromJson()` lee el contrato y `createComponentImplementation()` le pone a cada nombre **una clase Angular tuya**.

Las caras **viven solo en el cliente y nunca viajan** — son clases, no se pueden serializar. El emisor únicamente manda el string `"AppQuickStats"`. Si mandara `"AppLoQueSea"`, el renderer no lo encuentra y **no pinta nada**.

Ahí está el modelo de seguridad completo: **lo que viaja son datos, nunca código ejecutable**, y el emisor puede _pedir_ pero no _ampliar_ la lista. Por eso podrías aceptar UI de un agente en el que no confías del todo: lo peor que puede hacer es pedir algo que no le diste.

> Con v1.0 los campos dejaron de ser "cualquier cosa": el renderer solo resuelve los punteros de los campos que el contrato declara como dinámicos, y valida el resto. Un valor malformado revienta en la validación en vez de llegar al componente.

### Honestidad: en ESTA demo, A2UI casi no aporta

Conviene decirlo, porque es la primera pregunta que sale:

- El emisor y el receptor son **el mismo código**, en la misma página, escrito por la misma persona.
- Los 7 componentes ya están en el bundle: no se recibe UI de nadie.
- El nivel Avanzado añade superficies, data-model y punteros… para pintar **exactamente lo mismo** que el Intermedio.

A2UI resuelve un problema que aquí no existe: *"¿cómo dejo que un agente que no controlo dibuje en mi pantalla sin darle las llaves?"*. Cobra sentido cuando **el agente vive en un servidor**, cuando **varios clientes distintos** (web, móvil, escritorio) comparten un mismo agente, o cuando la interfaz **le responde de vuelta**.

El nivel Avanzado está aquí para enseñar **qué forma tiene ese problema**, en miniatura y sin riesgo. La moraleja de los tres niveles:

> Lo casero funciona perfecto… hasta que el agente deja de ser tuyo. Ahí necesitas un contrato que ambos lados entiendan sin haber hablado nunca.

Por eso el nivel Avanzado trae un interruptor que **muda el agente a un servidor**: ahí sí aparece el problema real, y A2UI empieza a pagar su precio.

---

## El agente en un servidor (interruptor del nivel Avanzado)

En la pestaña **Asistente IA** del nivel Avanzado hay un interruptor: **"En tu navegador · Gemini Nano"** / **"En el servidor · Gemini"**. Es la otra mitad de la historia: cuando quieres un modelo más grande —uno que razone y diseñe pantallas más ricas—, el agente se muda a un servidor y A2UI viaja por la red.

| | En tu navegador | En el servidor |
| --- | --- | --- |
| Quién decide | Gemini Nano, dentro de Chrome | `gemini-4-argon` por la Gemini API (API key de AI Studio) |
| Qué decide | Qué tarjetas mostrar (de 1 a 4) | La pantalla entera: orden, títulos, explicaciones, botones y tarjetas |
| Quién pone los números | TypeScript, en el navegador | Python, en el servidor (la misma matemática, portada línea a línea) |
| Cómo llega a la pantalla | `processMessages()` en memoria | Por la red, como eventos `a2ui` (`application/a2ui+json`) |
| Quién pinta | El mismo renderer, el mismo catálogo, los mismos componentes | ← lo mismo |

### Qué cambia (y qué no)

Todo se junta en la misma línea: `renderer.processMessages(...)`, la puerta de entrada del renderer. En modo local los mensajes se arman ahí mismo ([`chat.ts`](apps/web/src/app/pages/avanzado/chat/chat.ts)); en modo servidor llegan por la red ([`remote-agent.ts`](apps/web/src/app/services/remote-agent.ts)) y entran **por la misma puerta**, de a un mensaje. Ni el catálogo, ni los componentes, ni el template cambian: el cliente ya estaba listo para recibir de cualquiera.

### Qué viaja por la red

La pregunta sale del navegador con dos datos extra: **qué catálogos sabe pintar** (`a2uiRendererCapabilities`: así negocian los dos lados en A2UI) y qué cuenta está mirando:

```http
POST /api/agent
{ "text": "Hazme un resumen de mi mes",
  "metadata": {
    "a2uiRendererCapabilities": { "1.0": { "supportedCatalogIds": ["…/finance/v1_0", "…/basic/catalog.json"] } },
    "accountId": "debito-principal" } }
```

La respuesta es un stream (`text/event-stream`). Cada evento `a2ui` lleva **un mensaje A2UI v1.0** envuelto igual que en A2A: una "parte de datos" con su tipo en `metadata.mimeType`:

```text
event: thought  {"text": "Revisando las categorías del mes"}                         ← el modelo razonando
event: text     {"kind":"text","text":"Este mes lo que más pesa es la comida…"}    ← la respuesta, en vivo
event: a2ui     {"kind":"data","metadata":{"mimeType":"application/a2ui+json"},"data":{"version":"1.0","createSurface":{…}}}
event: a2ui     {"kind":"data","metadata":{"mimeType":"application/a2ui+json"},"data":{"version":"1.0","updateComponents":{… "data":{"@path":"/kpis"} …}}}
event: a2ui     {"kind":"data","metadata":{"mimeType":"application/a2ui+json"},"data":{"version":"1.0","updateDataModel":{"path":"/kpis","value":{…}}}}
event: done     {"model":"gemini-4-argon","servedModel":"gemini-4-argon","usage":{"total":11933,"thought":…},…}
```

> **¿Por qué el encabezado dice `text/event-stream` y no `application/a2ui+json`?** Porque el encabezado describe el **sobre** (un stream de eventos), y SSE no permite un Content-Type por evento. El tipo de cada mensaje A2UI viaja, como en A2A, en `metadata.mimeType`. En DevTools: **Network → `agent` → pestaña EventStream**, y cada fila `a2ui` empieza con `"mimeType":"application/a2ui+json"`.

> A2UI todavía no estandariza un formato HTTP propio (la guía oficial lo deja "por hacer"; los transportes estables son A2A y AG-UI). Esta demo usa uno mínimo y explícito —POST + _Server-Sent Events_, con las partes y los metadatos al estilo de A2A— para que el protocolo se vea desnudo.

**¿Cómo sé que respondió de verdad `gemini-4-argon`?** El evento `done` trae dos campos distintos: `model` es el que **pedimos** (la configuración), y `servedModel` y `usage` son los que **confirma Google** en su respuesta (evento `interaction.completed`). El chat los muestra en el badge _"gemini-4-argon · confirmado por Google"_, junto con los tokens. Con `GEMINI_THINKING_LEVEL=medium`, Argon decide cuánto pensar y a veces no razona nada extra. Con `high` siempre razona (verás sus pasos mientras piensa y los "tokens de razonamiento" en el badge), a cambio de más espera.

### El reparto: el modelo dibuja, Python pone el dinero

1. **Gemini escribe la estructura** en A2UI: una columna, un título en Markdown, la tira de cifras, una frase que explica el reporte, botones de "siguiente pregunta"… De cada tarjeta de finanzas solo escribe su **intención** (por ejemplo `"filter": {"method": "yape"}`). Nunca escribe cifras.
2. **El SDK oficial de A2UI** (`a2ui-agent-sdk`) arma el prompt a partir del catálogo, separa el texto del bloque A2UI y **valida** que el modelo solo use piezas permitidas. Si se equivoca, se le pide una vez que corrija citando el error; si vuelve a fallar, sale una pantalla de respaldo para que la demo nunca quede en blanco.
3. **Python completa los punteros**: a cada tarjeta le pone `data: {"@path": "/<id>"}` y calcula sus números con la misma matemática del navegador ([`binder.py`](apps/agent/src/finance_agent/binder.py)). Un test compara las dos implementaciones cifra por cifra.

Despliega **"Ver protocolo A2UI"** bajo una respuesta del servidor: arriba ves lo que escribió Gemini (sin un solo número) y abajo lo que llegó por la red (con los datos que puso Python).

### La frontera de confianza

- **La API key nunca llega al navegador**: vive en `apps/agent/.env` y solo la usa el servidor.
- **El navegador decide qué acepta**: registra el catálogo de finanzas y un catálogo básico **recortado** (Text, Row, Column, Card, Button, Divider, Icon; y sin la función de abrir URLs). Lo que no esté ahí, no se pinta.
- **Se valida en los dos lados**: el servidor valida antes de enviar; el navegador valida al recibir y, si algo no encaja, se lo devuelve al agente como un mensaje `error`.
- **Las acciones vuelven al agente**: el simulador de gastos hormiga y los filtros de la tabla viajan como mensajes `action`, y el servidor responde con `updateDataModel` (sin pasar por el modelo). Los botones de seguimiento se convierten en una pregunta nueva del chat.

---

## Arquitectura

El repo es un **monorepo** (pnpm workspaces para JavaScript, `uv` para Python) con tres piezas: el renderer, el agente y el contrato que comparten.

```
a2ui-smart-financial-assistant/
├── apps/
│   ├── web/                          # Angular 22: el RENDERER (los 3 niveles + el chat con interruptor)
│   └── agent/                        # Python: el AGENTE del modo servidor (FastAPI + Gemini + a2ui-agent-sdk)
│       ├── src/finance_agent/
│       │   ├── main.py               #   GET /api/health · POST /api/agent (text/event-stream)
│       │   ├── agent.py              #   Un turno: Gemini → validar → completar punteros → eventos SSE
│       │   ├── catalogs.py           #   Catálogos A2UI con el SDK oficial (básico recortado + finanzas)
│       │   ├── prompts.py            #   Reglas de diseño para el modelo (lo técnico lo genera el SDK)
│       │   ├── binder.py             #   "El agente completa los punteros": data @path + updateDataModel
│       │   ├── actions.py            #   Acciones que vuelven del navegador (filtros, simulador)
│       │   ├── llm.py                #   Gemini por la Interactions API (store=False)
│       │   └── finance/              #   Datos y matemática: port fiel de finance-data.ts y finance-analytics.ts
│       └── tests/                    #   Paridad TS↔Python, binder, acciones y API con un Gemini falso
└── packages/
    └── a2ui-catalog/                 # EL CONTRATO compartido: lo leen el navegador y el agente
        ├── finance-catalog.v1.json   #   Catálogo A2UI v1.0 de los 7 widgets
        └── examples/                 #   Pantallas de ejemplo que el SDK le muestra al modelo
```

Dentro del front, la app separa **lo que el modelo puede generar** (`catalog/`, segmentado por nivel) de **las páginas que lo alojan** (`pages/`). Así, mirando el árbol se entiende de un vistazo qué componentes usa cada nivel.

```
apps/web/src/app/
├── app.ts / app.html / app.scss   # SHELL único: sidebar de cuentas + header (selector de nivel +
│                                   # estado/descarga de Gemini Nano) + <router-outlet/>
├── app.routes.ts                   # 3 rutas lazy (loadComponent) + redirect '' → 'basico'
├── app.config.ts                   # Providers raíz, incl. provideA2UI (nivel Avanzado)
│
├── models/
│   ├── finance.model.ts            # Dominio: Account, Transaction, Category, PaymentMethod, AntVerdict + metadatos
│   ├── basico.model.ts             # [Básico] Contrato del enrutador: BasicoComponent + BASICO_ROUTER_SCHEMA
│   ├── ui-router.model.ts          # [Intermedio/Avanzado] Contrato del enrutador (casero): UiComponent + UI_ROUTER_SCHEMA
│   └── a2ui-protocol.ts            # [Avanzado] Protocolo A2UI v1.0 REAL: catalog id, campos por componente, actions, surface ids
│
├── services/
│   ├── gen-ui.ts                   # GenUiService: detección/descarga + route() + routeBasic() + answerStreaming()
│   ├── prompts/                    # Los 3 system prompts, uno por archivo (fuera del servicio, para leerlos a gusto)
│   │   ├── router-basico.prompt.ts     #   [Básico] BASICO_ROUTER_PROMPT
│   │   ├── router-completo.prompt.ts   #   [Intermedio/Avanzado] UI_ROUTER_PROMPT
│   │   └── asesor.prompt.ts            #   [Los tres] ASESOR_PROMPT (narrativa en streaming)
│   ├── finance-data.ts             # Dataset ficticio (3 cuentas, 6 meses de historial determinista) + signals
│   ├── finance-analytics.ts        # Matemática DETERMINISTA: categorías, hormiga, mes-a-mes, proyección, crédito, filtros
│   ├── a2ui-message-builder.ts     # [Avanzado] Traduce la decisión del modelo a los 3 mensajes A2UI
│   ├── a2ui-action.service.ts      # [Avanzado] Handler global de actions A2UI: recalcula en TS o la reenvía al servidor
│   ├── agent-mode.ts               # [Avanzado] El interruptor: ¿el agente vive en el navegador o en el servidor?
│   └── remote-agent.ts             # [Avanzado] Cliente del agente remoto: POST + SSE → processMessages, uno a uno
│
├── catalog/                        # Los "bloques de Lego" que el LLM puede invocar, por nivel
│   ├── basico/                     #    [Básico] 3 componentes toy + basico-catalog.ts → BASICO_REGISTRY
│   │   ├── plain-answer/           #       PlainAnswer (respuesta en texto)
│   │   ├── stat-card/              #       StatCard (un dato)
│   │   └── simple-list/            #       SimpleList (lista simple)
│   ├── intermedio/                 #    [Intermedio] 7 componentes caseros (input data) + intermedio-catalog.ts → INTERMEDIO_REGISTRY
│   │   ├── quick-stats/  spending-report/  ant-expense/  movements-table/
│   │   └── recommendations/  savings-plan/  credit-advisor/
│   ├── avanzado/                   #    [Avanzado] los 7 vía protocolo A2UI (extends FinanceComponent)
│   │   ├── quick-stats/  spending-report/  ant-expense/  movements-table/
│   │   ├── recommendations/  savings-plan/ credit-advisor/
│   │   ├── finance-catalog.ts      #       buildFinanceCatalog(): contrato compartido + clases Angular
│   │   │                           #       buildLayoutCatalog(): catálogo básico recortado (modo servidor)
│   │   └── finance-component.base.ts  #    FinanceComponent: base con lectores tolerantes + dispatch()
│   └── shared/                     #    Utilidades transversales (Básico/Intermedio ↔ Avanzado)
│       ├── chart-theme.ts          #       Tema y fábricas de gráficos ApexCharts (Intermedio + Avanzado)
│       └── data-access.ts          #       Lectores tolerantes str/num/bool/arr (Básico + Intermedio)
│
└── pages/                          # Las páginas que alojan cada nivel (el "chrome")
    ├── basico/                     #    basico-page: un único chat (routeBasic → NgComponentOutlet)
    ├── intermedio/                 #    intermedio-page (MatTabGroup) + account-summary/ + chat/
    └── avanzado/                   #    avanzado-page (MatTabGroup) + account-summary/ + chat/ (A2UI)
```

> **Historial determinista y reproducible.** El mes actual y el anterior salen de semillas fijas; los **4 meses previos** los genera `finance-data.ts` a partir del perfil de comercios de cada cuenta usando un **PRNG con semilla** (`mulberry32` + hash `FNV-1a` de `cuenta:mes`). Así el historial es variado pero **idéntico en cada recarga** — la demo se ve igual siempre. Este historial solo alimenta la lista de movimientos: la comparación mes-a-mes y la proyección siguen mirando únicamente el mes actual y el anterior.

Construido con las **mejores prácticas de Angular 22**: componentes _standalone_, **Signals** (`signal`, `computed`, `effect`, `afterRenderEffect`), `inject()`, **Signal Inputs/Outputs** (`input()`, `output()`), `viewChild()`, el nuevo _control flow_ (`@if`, `@for`) y **rutas perezosas** (`loadComponent`). La UI usa **Angular Material 3** (tema azure/blue, tokens `--mat-sys-*`): sidenav, tabs, listas, tabla, chips, slider, progress bar, skeletons con _shimmer_ y animaciones sutiles. El nivel Avanzado suma **`@a2ui/angular`** y **`@a2ui/web_core`** (el renderer oficial del protocolo A2UI, v1.0).

---

## Requisitos técnicos para probarlo

> **Importante:** esta demo depende de una API experimental del navegador. Solo funciona en **Chrome de escritorio** (no en Firefox, Safari ni móviles).

### 1. Navegador y hardware

| Requisito             | Detalle                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navegador**         | Google Chrome **138+** (Canary / Dev / Beta / Stable). El global `LanguageModel` ya viene **activo por defecto** en Chrome **148+** (2026). |
| **Sistema operativo** | Windows 10/11, macOS 13+, Linux o ChromeOS en **Chromebook Plus** (no Android/iOS ni Chromebooks normales).                                 |
| **Disco**             | ~22 GB libres (Chrome reserva espacio para el modelo).                                                                                      |
| **GPU / RAM**         | >4 GB de VRAM **o** 16 GB de RAM con 4+ núcleos de CPU.                                                                                     |

> **No necesitas instalar Gemini Nano por separado.** Basta con Chrome: el modelo (~4 GB) lo **gestiona y descarga el propio navegador** como un componente interno compartido.

### 2. Habilitar la API (flags de Chrome)

> **Novedad 2026:** en Chrome **148+** la Prompt API está **activa por defecto** y el antiguo flag `#prompt-api-for-gemini-nano` **fue eliminado**. Si tu Chrome es reciente, no tienes que activar nada — verifica en la consola con `'LanguageModel' in self` (debe dar `true`).

Solo si usas una versión más antigua o el equipo no pasa el chequeo de hardware, abre `chrome://flags`, pon en **Enabled** y **reinicia**:

- `#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement** (fuerza la descarga aunque el hardware no cumpla el mínimo).
- _(opcional, para evitar que el filtro de seguridad bloquee salidas)_ `#text-safety-classifier` → **Disabled**.

### 3. Descargar el modelo (primera vez)

La primera vez, `LanguageModel.availability()` devuelve `"downloadable"`: el modelo aún no está en disco. Chrome **exige un gesto del usuario** (un clic) para iniciar la descarga, por eso la app muestra un **banner con botón "Descargar modelo"** y una **barra de progreso** en el header cuando detecta ese estado. Un solo clic dispara la bajada (~4 GB, varios minutos la primera vez) y el chip de la barra superior pasa a _"Modelo local listo"_ al terminar. Como el header es único, ese estado es visible en los tres niveles.

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

Dentro de la app, el **chip de estado** de la barra superior refleja en tiempo real si el modelo está: _listo_, _descargable_, _descargando… %_ o _no disponible_.

---

## Puesta en marcha

```bash
# 1. Instalar dependencias del front (pnpm workspaces)
pnpm install

# 2a. Solo el front: los tres niveles con Gemini Nano
pnpm start

# 2b. Front + agente en el servidor (para el interruptor del nivel Avanzado)
cp apps/agent/.env.example apps/agent/.env    # y pon tu GEMINI_API_KEY (ver abajo)
pnpm dev
```

Abre `http://localhost:4200/` en tu Chrome ya configurado (pasos anteriores). La app redirige a `/basico` por defecto. Con `pnpm dev`, el agente queda en `http://127.0.0.1:8787` (un puerto poco común, para no chocar con otros servicios en el 8000) y el front le habla a través de `/api` (el proxy de desarrollo de Angular, [`proxy.conf.json`](apps/web/proxy.conf.json)).

### Para el modo servidor: Python y la API key de Gemini

- **Python**: el agente usa [`uv`](https://docs.astral.sh/uv/) (0.12 o más nuevo). La primera vez, `uv` descarga Python 3.13 e instala las dependencias solo; no hace falta crear entornos a mano.
- **API key**: créala en [Google AI Studio](https://aistudio.google.com/) → _Get API key_, y **restríngela a "Gemini API"**. Ponla en `apps/agent/.env` como `GEMINI_API_KEY=…`. Ese archivo no se versiona y la key nunca llega al navegador.
- **Modelo**: por defecto `gemini-4-argon` (el modelo de razonamiento grande), que **requiere facturación activa**: en un proyecto del nivel gratuito Google responde _"limit: 0 … on Free Tier"_ y el chat lo explica. Para probar gratis, `GEMINI_MODEL=gemini-3.6-flash` o `gemini-3.8-flash` (tienen nivel gratuito, con pocos pedidos por día). Con `gemini-3.6-flash` cada turno tarda unos 15 s. Si las respuestas tardan, baja el razonamiento con `GEMINI_THINKING_LEVEL=low`.
- **Saturación**: a veces Google responde _503 "high demand"_ en los modelos gratuitos. El agente reintenta una vez y, si sigue, el chat lo dice. Para la charla conviene llevar la facturación activa o probar antes con el modelo que vayas a usar.
- **Privacidad**: el agente llama a Gemini con `store=False`, así que Google no guarda la conversación. Ten en cuenta que en el nivel gratuito Google puede usar el contenido para mejorar sus productos. Aquí da igual porque los datos son ficticios; con datos reales, no.
- Sin key, el modo servidor muestra el aviso en el chat, y las acciones (filtros, simulador) siguen funcionando porque no usan el modelo.

### Cómo usar la demo

1. Revisa el **chip de estado** del header:
   - Si dice _"El modelo se puede descargar…"_, aparecerá un **banner con el botón "Descargar modelo"**. Púlsalo una vez y espera a que la barra de progreso llegue al 100% (solo la primera vez).
   - Cuando diga _"Modelo local listo (Gemini Nano)"_, ya puedes usar la demo.
2. Usa el **selector de nivel** del header para moverte entre **Básico**, **Intermedio** y **Avanzado**. El sidebar de cuentas y el estado del modelo se conservan en los tres.
3. En el **sidebar** cambia entre las 3 cuentas ficticias (Débito Principal, Débito Ahorros, Tarjeta de Crédito): el saldo, el hero de gastos hormiga y los movimientos se actualizan.
4. **Empieza en Básico**: pregunta _"¿cuánto he gastado?"_ o _"¿qué es un gasto hormiga?"_ y observa cómo Nano elige entre 3 componentes toy — sin gráficos ni protocolo, el concepto puro.
5. **Sube a Intermedio**: en _"Resumen"_ verás el hero de gastos hormiga con su veredicto de color (verde/ámbar/rojo según tus datos) y el **slider "¿y si...?"**; en _"Asistente IA"_ pulsa un chip o escribe tu pregunta y verás el **skeleton → componente generado → narrativa en streaming**. Prueba el chip **"Resumen de mi mes"**: Nano elige **varias** piezas y se **apila una pantalla completa** (KPIs + reporte + hormiga + consejos).
6. **Termina en Avanzado**: el mismo chat y **la misma decisión del modelo**, pero el componente lo materializa el **protocolo A2UI real**; el slider y los filtros hacen _round-trip_ (`updateDataModel`).
7. Despliega el toggle bajo cada respuesta para enseñar a tu audiencia la salida cruda del modelo:
   - En **Básico** e **Intermedio** se llama _"Ver cómo decidió Nano"_ → texto crudo + decisión parseada (componente + params).
   - En **Avanzado** se llama _"Ver protocolo A2UI"_ → lo mismo, **más** el stream `createSurface / updateComponents / updateDataModel`. Es la comparación más didáctica de la demo: misma decisión arriba, protocolo abajo.
8. **Cierra con el interruptor** (Avanzado → _Asistente IA_ → **"En el servidor"**, con `pnpm dev` corriendo): repite _"Resumen de mi mes"_. Ahora el modelo grande **diseña** la pantalla (títulos, explicaciones, botones de seguimiento) con el mismo catálogo; mueve el simulador o pulsa un filtro y verás la acción viajar al servidor en **DevTools → Network**.

---

## Cómo demostrar que la IA es real (para la charla)

La pregunta inevitable del público es: _"¿cómo sé que no es un `if/else` con respuestas quemadas?"_. Estas son las pruebas, de la más contundente a la más técnica.

### 1. No hay llamadas de red (la prueba definitiva)

Como Gemini Nano corre **dentro del navegador**, **no existe ninguna petición HTTP**:

1. Abre **DevTools → pestaña Network**.
2. Envía una pregunta en el chat.
3. Aparece el componente y la narrativa… pero **Network sigue en 0 requests**. No hubo ningún servidor.

> _"Si esto fuera una API en la nube, aquí verían la llamada. No hay ninguna: todo ocurrió en la GPU de este equipo."_

Y el contraste para el final: cambia el interruptor a **"En el servidor"** y repite la pregunta. Ahora sí aparece `POST /api/agent`, con respuesta `text/event-stream`: ese es el protocolo cruzando la red.

### 2. Funciona sin internet

**Desconecta el WiFi / activa modo avión** y vuelve a preguntar. Sigue funcionando. Ninguna API en la nube sobrevive a esto.

### 3. Improvisación en vivo

Un `if/else` solo responde a frases conocidas. Pide al público una frase **inventada** y escríbela en el chat:

- _"Me acaba de llegar el pago de mi freelance, ¿en qué se me va el dinero en pequeñeces?"_ → `AppAntExpense`.
- _"Solo quiero ver lo que pagué con la billetera móvil"_ → `AppMovementsTable` filtrado por método.

Si enruta bien frases que **nunca se programaron**, hay un modelo razonando de verdad.

### 4. El streaming token a token

La narrativa **se escribe en vivo, palabra por palabra** con un cursor parpadeante. Ese efecto no es un truco de CSS: viene de `session.promptStreaming()`, que **cede el texto en _chunks_ conforme el modelo lo genera** en el dispositivo. Un texto quemado aparecería de golpe.

### 5. El registro interno de Chrome

Abre `chrome://on-device-internals` → pestaña **"Event Logs"** (o _Model execution_). Envía una pregunta con esa pestaña abierta: verás aparecer **cada sesión e inferencia** que la app dispara (recuerda: son hasta **dos por mensaje** — enrutado + narrativa). Es la traza oficial de las llamadas a Gemini Nano.

### 6. Evidencia dentro de la propia app

La app está **instrumentada** para exponer cada llamada al modelo (ver [`GenUiService`](apps/web/src/app/services/gen-ui.ts)):

- **Badge de tiempo de inferencia** — cada respuesta muestra _"NNN ms · on-device"_. Un `if/else` sería ~0 ms; ver cientos de ms de cómputo real prueba que el modelo pensó. Se mide con `performance.now()` alrededor de `session.prompt()`.
- **Salida cruda + JSON** — al desplegar el toggle (_"Ver cómo decidió Nano"_, o _"Ver protocolo A2UI"_ en Avanzado) se muestra **el texto tal cual lo devolvió el modelo** (antes del parseo) junto a la decisión ya parseada (componente + params).
- **Logs en la consola del navegador** — cada enrutado imprime un grupo con el _contexto enviado_, la _salida cruda_, el _tiempo de inferencia_ y la _decisión parseada_. Abre **DevTools → Console** durante la charla para mostrarlo en vivo.

---

## Notas de build

- **Rutas perezosas por nivel.** Cada nivel se carga con `loadComponent` ([`app.routes.ts`](apps/web/src/app/app.routes.ts)) y genera su propio _chunk_ (`basico-page`, `intermedio-page`, `avanzado-page`). Así el nivel Básico arranca ligero, sin arrastrar ApexCharts ni las 7 tarjetas del catálogo, que solo se descargan al entrar a Intermedio/Avanzado.
- **ApexCharts se carga de forma perezosa.** `ng-apexcharts` importa dinámicamente `apexcharts/client` y registra `window.ApexCharts` por sí mismo, así que **no** hay script global en `angular.json` (`"scripts": []`). El motor de gráficos (~800 kB) solo se descarga cuando se renderiza el primer componente con gráfico.
- **El renderer A2UI vive en la raíz.** `provideA2UI(...)` se usa en [`app.config.ts`](apps/web/src/app/app.config.ts) y `A2uiRendererService` es `providedIn: 'root'`, así que el nivel Avanzado puede cargarse de forma perezosa sin problemas de inyección. Es inocuo para Básico/Intermedio.
- **Protocolo A2UI v1.0** con `@a2ui/angular` 0.14 y `@a2ui/web_core` 0.15. Todo se importa desde la raíz de los paquetes (no hay `/v1_0`); el selector `<a2ui-v09-surface>` conserva su nombre histórico aunque ya renderiza v1.0.
- **Componentes universales.** `provideA2UI` monta cada widget como _web component_ (`<a2ui-ng-appquickstats>`, …), el modo recomendado en v1.0. Como el gráfico se crea antes de que el navegador mida su contenedor, los gráficos circulares (plan de ahorro y asesor de crédito) llevan ancho fijo en [`chart-theme.ts`](apps/web/src/app/catalog/shared/chart-theme.ts).
- **Avisos de dependencias pares, esperados:** `@a2ui/angular` 0.14 declara Angular `^21.2.5` (funciona con 22), `@a2ui/markdown-it` 0.2.2 pide `@a2ui/web_core ^0.14` (solo usa sus tipos) y `ng-apexcharts` pide ApexCharts 5. La app ya no depende de `zod`: las librerías A2UI traen su propia copia.
- **Presupuestos** (`angular.json`): _initial_ 1 MB warn / 1.5 MB error; _anyComponentStyle_ 6 kB warn / 8 kB error. El _bundle_ inicial ronda hoy los **1,34 MB** (~286 kB transferidos) porque el catálogo básico de A2UI (sus web components) se registra en la raíz; el build emite la advertencia del presupuesto de 1 MB (y la de los ~6,5 kB de estilos del chat) pero se completa correctamente. El Markdown de los `Text` se carga de forma perezosa (`provideMarkdownRenderer()` sin argumentos). `validate-color` (una dependencia CommonJS de `web_core`) está en `allowedCommonJsDependencies`.
- **Monorepo.** `pnpm-workspace.yaml` agrupa `apps/web` y `packages/*`; el front importa el contrato como `@fintech-nano/a2ui-catalog/finance-catalog.v1.json`. El agente Python no es un paquete de pnpm: lo maneja `uv` (`apps/agent/pyproject.toml`) y los scripts de la raíz lo llaman con `uv run --directory apps/agent …`.

---

## Comandos disponibles

Desde la raíz del monorepo:

```bash
pnpm start                 # Solo el front (ng serve) en http://localhost:4200/
pnpm dev                   # Front + agente Python a la vez (el agente en http://127.0.0.1:8787)
pnpm dev:agent             # Solo el agente (fastapi dev, recarga en caliente)
pnpm build                 # Build de producción del front en apps/web/dist/
pnpm test:agent            # Tests del agente: paridad con el front, binder, acciones y API
pnpm --filter web watch    # Build incremental del front en modo desarrollo
```

---

## Referencias

### Protocolo A2UI (nivel Avanzado)

- [a2ui.org — sitio del proyecto](https://a2ui.org/) · [¿Qué es A2UI?](https://a2ui.org/introduction/what-is-a2ui/) · [Especificación v1.0](https://a2ui.org/specification/v1.0-a2ui/)
- [Guía de evolución v0.9 → v1.0](https://github.com/a2ui-project/a2ui/blob/main/specification/v1_0/docs/evolution_guide.md) — qué cambió y por qué (`"1.0"`, `@path`/`@call`, `createSurface` con todo dentro, catálogos mezclables por componente)
- [Guía de desarrollo de agentes](https://a2ui.org/guides/agent-development/) — el enfoque que recomienda el proyecto es **prompt + validación posterior**, no salida forzada; advierte expresamente que los modelos envuelven el JSON en _fences_ de markdown y cometen otros errores. (La v0.8 era _"Structured Output first"_; la v0.9 marcó un giro a _"Prompt-First"_.)
- [`a2ui-project/a2ui` en GitHub](https://github.com/a2ui-project/a2ui)
- [SDK de agente en Python (`a2ui-agent-sdk`)](https://github.com/a2ui-project/a2ui/blob/main/python/a2ui_agent/agent_development.md) — catálogos, prompt generado, parser en streaming y validación (lo que usa `apps/agent`)
- [Transportes de A2UI](https://a2ui.org/concepts/transports/) — A2A y AG-UI estables; HTTP/SSE aún sin estandarizar

### Agente en el servidor (modo servidor)

- [Gemini API — Interactions API](https://aistudio.google.com/docs/interactions-overview) · [Modelos](https://aistudio.google.com/docs/models) · [API keys](https://aistudio.google.com/docs/api-key)
- [FastAPI — Server-Sent Events](https://fastapi.tiangolo.com/tutorial/server-sent-events/) · [uv](https://docs.astral.sh/uv/)

### Prompt API de Chrome (los tres niveles)

- [Prompt API — Guía oficial de Chrome (GoogleChrome/modern-web-guidance)](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/guides/built-in-ai/language-model.md)
- [Structured output para la Prompt API](https://developer.chrome.com/docs/ai/structured-output-for-prompt-api) — el `responseConstraint` que usan los enrutadores
- [Explainer de la especificación (webmachinelearning/prompt-api)](https://github.com/webmachinelearning/prompt-api) — define los modos de fallo: `SyntaxError` si no logra cumplir el schema, `NotSupportedError` si usa keywords no soportadas
- [JSON Schema Tester](https://googlechrome.github.io/samples/json-schema-tester/) — para comprobar si un schema funciona con la Prompt API (Chrome no publica la lista de keywords soportadas)
- [Build a sentiment classifier with Chrome's Prompt API in Angular (dev.to)](https://dev.to/railsstudent/build-a-sentiment-classifier-with-chromes-prompt-api-in-angular-43ek)
- [Chrome Gemini Nano / Prompt API — requisitos (May 2026)](https://www.computeleap.com/blog/chrome-gemini-nano-prompt-api-window-ai-may-2026/)
- [Dónde guarda Chrome el modelo: el archivo `weights.bin` de Gemini Nano (Android Authority)](https://www.androidauthority.com/google-chrome-weights-bin-ai-model-download-explained-3664043/)
- [ng-apexcharts (wrapper Angular de ApexCharts)](https://apexcharts.com/docs/angular-charts/)
- [Documentación de Angular](https://angular.dev)
