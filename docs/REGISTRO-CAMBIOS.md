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

## [2026-06-21] Fase 2 - Modelo SolicitudCompra / cotizacion
**Archivos creados:** `api/models/SolicitudCompra.js`, `api/controllers/solicitudCompra.controller.js`, `api/routes/solicitudCompra.routes.js`, `web/html/solicitudes_compra.html`, `web/js/solicitudes_compra.js`, `web/css/solicitudes_compra.css`.
**Archivos modificados:** `server.js` (montaje de `/api/solicitudes-compra`), `web/js/admin_nav.js` (enlace admin a Cotizaciones), `docs/REGISTRO-CAMBIOS.md` (registro de fase).
**Decisiones tecnicas:** `SolicitudCompra` queda separada de Mercado Publico. El folio se genera como `SOL-YYYY-XXXX` con correlativo anual. Los productos se agregan como snapshot (`productoId`, `nombre`, `sku`, `precioUnitario`, `cantidad`, `subtotal`). Los precios de productos se tratan como netos y se calcula IVA 19% con redondeo a entero. Cliente estructurado con razon social, RUT, email, direccion, contacto y telefono.
**Edge cases cubiertos:** Cliente incompleto, email invalido, producto inexistente, producto sin SKU, cantidad no entera o menor/igual a cero, solicitud inexistente, ID invalido, cotizacion enviada sin items, transiciones de estado invalidas, colision de folio mediante indice unico y reintento.
**Pruebas:** `node --check api/models/SolicitudCompra.js`, `node --check api/controllers/solicitudCompra.controller.js`, `node --check api/routes/solicitudCompra.routes.js`, `node --check server.js`, `node --check web/js/solicitudes_compra.js`, `node --check web/js/admin_nav.js` ejecutados correctamente. No se ejecuto `npm test` porque el script sigue siendo un placeholder que falla intencionalmente.
**Pendiente / deuda tecnica:** Verificar manualmente flujo completo con Mongo y sesion admin. La pantalla permite crear, editar, agregar/quitar items y marcar enviada; aceptar/rechazar/vencer queda disponible por API y puede exponerse en UI en Fase 3. No se agrego acceso rapido al dashboard por problemas de codificacion existentes en ese archivo; el menu admin si incluye Cotizaciones.

## [2026-06-21] Fase 3 - Pulido e integracion de cotizaciones
**Archivos creados:** Ninguno.
**Archivos modificados:** `web/html/solicitudes_compra.html` (filtro de estado, busqueda de productos, acciones de estado e impresion), `web/js/solicitudes_compra.js` (filtros, cambio de estado completo, generacion de vista imprimible), `web/css/solicitudes_compra.css` (layout de controles, estilos de impresion y media print), `docs/REGISTRO-CAMBIOS.md` (registro de fase).
**Decisiones tecnicas:** Se uso impresion nativa del navegador con un bloque `printArea`, sin agregar dependencias ni generar PDF binario. Las acciones de estado de UI reutilizan `PATCH /api/solicitudes-compra/:id/estado`. La busqueda de productos filtra localmente por SKU, nombre, categoria y region.
**Edge cases cubiertos:** Cotizacion sin seleccionar al imprimir/cambiar estado, cotizacion sin items al enviar controlada por API, transiciones invalidas controladas por API, productos filtrados sin resultados, impresion de cotizacion sin items.
**Pruebas:** `node --check web/js/solicitudes_compra.js`, `node --check api/controllers/solicitudCompra.controller.js`, `node --check api/routes/solicitudCompra.routes.js` ejecutados correctamente. No se ejecuto `npm test` porque el script sigue siendo un placeholder que falla intencionalmente.
**Pendiente / deuda tecnica:** Verificar visualmente la impresion en navegador con datos reales. Si se requiere descarga PDF, evaluar en una fase posterior el uso de `jspdf` ya presente en `web/libs`.
