# @fintech-nano/a2ui-catalog — el contrato

El acuerdo entre el **agente** (`apps/agent`) y el **renderer** (`apps/web`): qué piezas existen y
qué campos acepta cada una. Es un documento de catálogo **A2UI v1.0** estándar.

- `finance-catalog.v1.json` — los 7 widgets de finanzas (`AppQuickStats`, `AppSpendingReport`, …).
  - El **navegador** lo carga con `Catalog.fromJson()` y le pone una clase Angular a cada nombre
    (`apps/web/src/app/catalog/avanzado/finance-catalog.ts`). Lo que no esté aquí, no se pinta.
  - El **agente** lo carga con `CatalogConfig.from_path()` del SDK oficial: con él arma el prompt
    del modelo y valida lo que el modelo escribe.
- `examples/` — pantallas compuestas de ejemplo que el SDK le muestra al modelo (y valida contra
  el catálogo al arrancar).

Las piezas de maquetación (Text, Row, Column, Card, Button, Divider, Icon) vienen del catálogo
**básico oficial** de A2UI; ambos lados lo recortan a esas mismas piezas.

Si cambias un widget, cambia este archivo: los dos lados lo leen, así que no hay copias que
sincronizar.
