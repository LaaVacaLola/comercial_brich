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

## [2026-06-22] Detener descarga y refresco en tiempo real
**Archivos modificados:** `api/controllers/empresa.controller.js` (nuevo export `cancelarJobDescargaEmpresa`), `api/routes/empresa.routes.js` (`DELETE /ordenes/job`), `api/services/mercadoPublico.service.js` (`iniciarDescargaOrdenesJob` agregada al `module.exports`), `web/html/ordenes_admin.html` (boton "Detener" junto a "Descargar OC"), `web/js/ordenes_admin.js` (`detenerDescarga`, `silentCacheRefresh`, polling diferencial por `ocProcesadas`), `web/css/mercado_publico.css` (`.btn-danger`, `.job-actions`).
**Decisiones tecnicas:** `cancelarJobDescargaEmpresa` busca el job activo del proveedor de la empresa y llama `cancelarJob` del servicio; el worker ya chequeaba `isJobCancelled` en cada iteracion, asi que la detención es limpia (no corta a mitad de una OC). El polling compara `ocProcesadas` entre ticks: si subio, hace un `silentCacheRefresh` que actualiza la tabla sin resetear la paginacion ni el scroll — el usuario ve las OC aparecer de una en una mientras corren. Al completar o detenerse el job se hace una recarga completa final. Se exporto `iniciarDescargaOrdenesJob` en el servicio (faltaba en `module.exports`), lo que causaba el error 500 anterior.
**Edge cases cubiertos:** Job ya cancelado/completo (404 gracioso), detener boton doble click (se deshabilita inmediatamente), silentCacheRefresh falla silenciosamente para no interrumpir el polling.
**Pruebas:** `node -c` OK en todos los archivos modificados.

## [2026-06-22] Descarga y cache de OC personales
**Archivos creados:** Ninguno.
**Archivos modificados:** `api/controllers/empresa.controller.js` (nuevos exports: `iniciarJobDescargaEmpresa`, `getJobDescargaEmpresa`, `getOrdenesEmpresaCache`), `api/routes/empresa.routes.js` (`POST /ordenes/job`, `GET /ordenes/job`, `GET /ordenes/cache`), `web/html/ordenes_admin.html` (select de fuente, panel de job con barra de progreso, boton flotante "Descargar OC"), `web/js/ordenes_admin.js` (modo cache/API, descarga de job, polling cada 3s, auto-recarga al completar), `web/css/mercado_publico.css` (clases `.job-header`, `.job-log-line`, `.status-badge` y variantes de color).
**Decisiones tecnicas:** `POST /api/empresa/ordenes/job` resuelve RUT → codigoProveedor y delega en el sistema de jobs ya existente (`iniciarDescargaOrdenesJob`). El job descarga los ultimos 6 meses (heredado del parametro `rango: "ultimo_ano"` del worker) y guarda cada OC en `MercadoPublicoOrdenCache` con `proveedorCodigo` indexado. `GET /api/empresa/ordenes/cache` consulta ese cache filtrando por `proveedorCodigo` + rango de fechas y estado opcionales. El frontend detecta si hay un job activo al cargar la pagina y arranca polling automaticamente; al completar cambia la fuente a "cache" y recarga la tabla.
**Edge cases cubiertos:** Job ya activo (el servicio devuelve el existente sin duplicar), empresa sin RUT (422), RUT sin codigo en MP (404), error de red a ChileCompra (502), cache vacio muestra hint para descargar, polling se detiene si el job termina en error o cancelado.
**Pruebas:** `node -c` OK en todos los archivos modificados.
**Pendiente / deuda tecnica:** El worker descarga "ultimo_ano" (parametro fijo del servicio); si se necesita rango personalizado habria que exponer ese parametro en `iniciarDescargaOrdenesJob`. El codigo proveedor aun se resuelve en cada peticion a `/ordenes/cache`; se puede cachear en el modelo Empresa.

## [2026-06-22] Ordenes de compra de la empresa local
**Archivos creados:** Ninguno.
**Archivos modificados:** `api/controllers/empresa.controller.js` (nuevo export `getOrdenesEmpresa`: lee RUT de la empresa guardada, resuelve codigo proveedor via `buscarProveedor`, consulta OC en ChileCompra filtrando por `CodigoProveedor`), `api/routes/empresa.routes.js` (`GET /ordenes`), `web/html/ordenes_admin.html` (reemplazado datos de ejemplo por tabla real con paginacion y modal de detalle), `web/js/ordenes_admin.js` (reescrito completo: consume `/api/empresa/ordenes`, reutiliza helpers `MP` de `mercado_common.js`, modal de detalle con estructura `tender-sheet` igual que `mercado_ordenes.js`).
**Decisiones tecnicas:** El detalle individual de cada OC se obtiene de `/api/mercado-publico/ordenes/:codigo` (ya existente) para no duplicar esa logica. El endpoint `/api/empresa/ordenes` actua como proxy especializado: resuelve el RUT → codigo proveedor → lista OC, todo en backend. La pagina consume `mercado_publico.css` en lugar del CSS propio anterior para mantener consistencia visual.
**Edge cases cubiertos:** Empresa sin RUT configurado (422 con mensaje claro), RUT sin resultado en MP (404), error de red a ChileCompra (502), sin ordenes en el periodo (mensaje de estado).
**Pruebas:** `node -c` OK en todos los archivos modificados.
**Pendiente / deuda tecnica:** El codigo proveedor se resuelve en cada peticion; si la API de ChileCompra es lenta se puede cachear en el modelo Empresa.

## [2026-06-22] Seguridad - .gitignore y proteccion de user.routes.js
**Archivos creados:** `.gitignore` (excluye `node_modules/`, `.env`, `*.log`, archivos de SO y editor).
**Archivos modificados:** `api/routes/user.routes.js` (agregado `router.use(auth, adminAuth)` al inicio; todos los endpoints de gestion de usuarios ahora requieren token valido y rol admin).
**Decisiones tecnicas:** Se aplico el mismo patron de `solicitudCompra.routes.js`. El `.env` ya existia en el indice de git; el `.gitignore` impide que futuros archivos `.env` sean versionados, pero no retira el actual del historial (requiere `git rm --cached .env` y rotacion de secretos).
**Edge cases cubiertos:** Creacion de usuarios admin sin autenticacion, lectura de lista de usuarios sin token.
**Pruebas:** `node -c api/routes/user.routes.js` OK.
**Pendiente / deuda tecnica:** Retirar `.env` del historial de git y rotar `JWT_SECRET`, `MONGO_URI` y `MERCADO_PUBLICO_TICKET`.

## [2026-06-22] Ajustes Empresa - datos basicos de la empresa local
**Archivos creados:** `api/models/Empresa.js`, `api/controllers/empresa.controller.js`, `api/routes/empresa.routes.js`, `web/html/ajustes_empresa.html`, `web/js/ajustes_empresa.js`.
**Archivos modificados:** `server.js` (montaje de `/api/empresa`), `web/js/admin_nav.js` (enlace "Empresa" como primer item del dropdown Ajustes).
**Decisiones tecnicas:** Documento singleton con `key: "default"` (mismo patron que `MercadoPublicoConfig`). Todos los endpoints protegidos con `auth + adminAuth`. El email se valida con regex solo si viene no vacio. Los estilos del formulario van inline en el HTML para no crear un CSS de una sola pagina.
**Edge cases cubiertos:** Empresa sin datos previos (upsert devuelve objeto vacio), email con formato invalido, campos opcionales vacios.
**Pruebas:** `node -c` OK en todos los archivos nuevos y modificados.
**Pendiente / deuda tecnica:** Conectar los datos de empresa a la vista imprimible de cotizaciones (cabecera del documento).

## [2026-06-21] Fase 3 - Pulido e integracion de cotizaciones
**Archivos creados:** Ninguno.
**Archivos modificados:** `web/html/solicitudes_compra.html` (filtro de estado, busqueda de productos, acciones de estado e impresion), `web/js/solicitudes_compra.js` (filtros, cambio de estado completo, generacion de vista imprimible), `web/css/solicitudes_compra.css` (layout de controles, estilos de impresion y media print), `docs/REGISTRO-CAMBIOS.md` (registro de fase).
**Decisiones tecnicas:** Se uso impresion nativa del navegador con un bloque `printArea`, sin agregar dependencias ni generar PDF binario. Las acciones de estado de UI reutilizan `PATCH /api/solicitudes-compra/:id/estado`. La busqueda de productos filtra localmente por SKU, nombre, categoria y region.
**Edge cases cubiertos:** Cotizacion sin seleccionar al imprimir/cambiar estado, cotizacion sin items al enviar controlada por API, transiciones invalidas controladas por API, productos filtrados sin resultados, impresion de cotizacion sin items.
**Pruebas:** `node --check web/js/solicitudes_compra.js`, `node --check api/controllers/solicitudCompra.controller.js`, `node --check api/routes/solicitudCompra.routes.js` ejecutados correctamente. No se ejecuto `npm test` porque el script sigue siendo un placeholder que falla intencionalmente.
**Pendiente / deuda tecnica:** Verificar visualmente la impresion en navegador con datos reales. Si se requiere descarga PDF, evaluar en una fase posterior el uso de `jspdf` ya presente en `web/libs`.

## [2026-07-07] Fase 4 - Ajustes catalogo admin: SKU, estado y ofertas
**Archivos creados:** Ninguno.
**Archivos modificados:** `api/controllers/producto.controller.js` (`normalizarSkusProductos`, persistencia de `oferta` en `updateProducto`), `api/routes/producto.routes.js` (`PUT /skus/normalizar`), `web/html/catalogo_admin.html` (columnas de tabla), `web/js/catalogo_admin.js` (normalizacion de SKU al entrar, render de oferta activa, precio con descuento y bandera de inactivo), `web/css/catalogo_admin.css` (estilos de bandera, oferta y precios).
**Decisiones tecnicas:** Se agrego un endpoint admin protegido para generar SKU faltantes al entrar al catalogo, reutilizando el generador existente `SKU-YYYYMMDD-0001`. La tabla ya no muestra columnas `Activo` ni `Aprobado`; el estado inactivo se muestra como bandera roja junto al nombre. La oferta activa se calcula en frontend usando el rango `fecha_inicio`/`fecha_termino` y muestra porcentaje y precio ofertado.
**Edge cases cubiertos:** SKU ausente, nulo o vacio; ruta de normalizacion ubicada antes de `/:id`; oferta vencida o futura no aparece como activa; descuento por monto o porcentaje; precio cero sin division invalida; producto inactivo con `activo` boolean o `estado` legado.
**Pruebas:** `node --check api/controllers/producto.controller.js`, `node --check api/routes/producto.routes.js`, `node --check web/js/catalogo_admin.js` ejecutados correctamente.
**Pendiente / deuda tecnica:** Verificar visualmente en navegador con sesion admin y datos reales de oferta.

## [2026-07-07] Fase 6 - Catalogo cliente como entrada publica y carrito
**Archivos creados:** Ninguno.
**Archivos modificados:** `server.js` (rutas frontend publicas antes de `express.static`: raiz `/` sirve catalogo cliente y `/admin/login` sirve login admin), `web/html/catalogo_cliente.html` (boton Admin junto al carrito), `web/js/catalogo_cliente.js` (carga publica, identificadores `_id`, carrito, cantidades, subtotales, total y exportacion Excel), `web/css/catalogo_cliente.css` (estilos de boton Admin, ofertas, estados y carrito).
**Decisiones tecnicas:** El catalogo cliente queda como puerta de entrada publica. El carrito usa `_id` de Mongo como identificador real y guarda un snapshot de nombre, SKU, precio unitario, precio original y oferta vigente al agregar productos. La exportacion Excel incluye SKU, producto, cantidad, precio unitario, porcentaje de oferta y subtotal.
**Edge cases cubiertos:** Productos sin imagen, productos sin SKU, carrito vacio al exportar, librerias Excel no cargadas, productos con oferta activa, filtros sin region seleccionada, cantidades que llegan a cero.
**Pruebas:** `node --check server.js` y `node --check web/js/catalogo_cliente.js` ejecutados correctamente. Verificacion HTTP local: `/` devuelve el catalogo cliente, `/admin/login` devuelve el login y `/api/productos` devuelve 90 productos.
**Pendiente / deuda tecnica:** Verificar manualmente en navegador la descarga del Excel porque depende de las librerias CDN cargadas en cliente.

## [2026-07-07] Fase 7 - Region seleccionada en catalogo cliente
**Archivos creados:** Ninguno.
**Archivos modificados:** `web/html/catalogo_cliente.html` (indicador de region y boton Cambiar), `web/js/catalogo_cliente.js` (persistencia `localStorage.catalogoRegion`, modal obligatorio inicial, regiones dinamicas desde productos y filtro por region), `web/css/catalogo_cliente.css` (estilos del indicador de region).
**Decisiones tecnicas:** Se usa `localStorage` para mantener la region entre visitas. El selector de region se rellena con las regiones reales de los productos aprobados/activos para evitar diferencias entre opciones estaticas y datos de Mongo. Sin region seleccionada no se muestran productos y se fuerza el modal inicial.
**Edge cases cubiertos:** Primera visita sin region guardada, region guardada que ya no existe en productos, productos con region vacia, seleccion vacia en modal, cambio de region sin recargar.
**Pruebas:** `node --check web/js/catalogo_cliente.js` y `node --check server.js` ejecutados correctamente.
**Pendiente / deuda tecnica:** Verificar manualmente en navegador borrando `localStorage.catalogoRegion` y recargando `/`.
