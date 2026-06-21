# Registro de cambios

Bitacora append-only del trabajo por fases.

## [2026-06-21] Fase 0 - Reconocimiento
**Archivos creados:** `docs/ANALISIS-INICIAL.md`, `docs/REGISTRO-CAMBIOS.md`.
**Archivos modificados:** Ningun archivo de codigo de produccion.
**Decisiones tecnicas:** Se documento la arquitectura actual sin modificar backend/frontend. Se confirma uso principal de CommonJS, Express y Mongoose. Se identifica que `Producto` ya existe, pero el CRUD admin esta incompleto para alta/edicion completa.
**Edge cases cubiertos:** No aplica implementacion funcional en Fase 0. Se identificaron riesgos: SKU inexistente, falta de control de duplicados, `precio: 0` rechazado por backend actual, updates con campos arbitrarios, posible exposicion de `MONGO_URI` en logs y ticket hardcodeado en `web/proxy.js`.
**Pruebas:** Reconocimiento por lectura de archivos; no se ejecutaron pruebas automatizadas porque `npm test` es un placeholder que falla intencionalmente.
**Pendiente / deuda tecnica:** Definir campos de producto, regla de precio cero, estrategia de SKU para datos existentes, mantener o migrar `estado`/`activo`, y resolver riesgos de secretos/logs en fases aprobadas.

## [2026-06-21] Fase 1 - Catalogo: crear y editar productos
**Archivos creados:** Ninguno.
**Archivos modificados:** `api/models/Producto.js` (esquema de producto con `sku`, campos de catalogo y `activo` boolean), `api/controllers/producto.controller.js` (`createProducto`, `updateProducto`, validaciones, generacion de SKU, normalizacion de precio/activo), `api/routes/producto.routes.js` (`PATCH /:id`), `web/html/catalogo_admin.html` (formulario/modal de producto), `web/js/catalogo_admin.js` (crear/editar/listar productos y estados UI), `web/js/catalogo_cliente.js` (compatibilidad con `activo` boolean), `web/css/catalogo_admin.css` (estilos de formulario y estados).
**Decisiones tecnicas:** El SKU se genera en backend con formato `SKU-YYYYMMDD-0001` usando secuencia diaria basada en el ultimo SKU existente. `precio` acepta `0` y rechaza valores negativos/no numericos. Se migro el control operativo a `activo: Boolean` y se mantiene `estado` sincronizado como campo legado para compatibilidad con productos existentes y vistas actuales.
**Edge cases cubiertos:** Precio `0`, precio negativo/no numerico, nombre vacio, ID Mongo invalido, producto inexistente, productos antiguos sin SKU al editar, colision de SKU por indice unico, compatibilidad con `estado` antiguo.
**Pruebas:** `node --check api/controllers/producto.controller.js`, `node --check api/models/Producto.js`, `node --check api/routes/producto.routes.js`, `node --check web/js/catalogo_admin.js`, `node --check web/js/catalogo_cliente.js` ejecutados correctamente. No se ejecuto `npm test` porque el script sigue siendo un placeholder que falla intencionalmente.
**Pendiente / deuda tecnica:** Verificar manualmente en navegador con sesion admin y Mongo activo. En una fase posterior conviene migrar/backfillear SKU para todos los productos antiguos y retirar gradualmente el campo legado `estado` cuando ya no sea usado.
