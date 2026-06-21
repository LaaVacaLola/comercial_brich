# Analisis inicial del proyecto

Fecha: 2026-06-21

## Alcance de la Fase 0

Reconocimiento del repositorio sin modificar codigo de produccion. Se revisaron `server.js`, `package.json`, `api/`, `web/`, el modelo y flujo actual de productos, middlewares, conexion a MongoDB y consumo de API desde frontend.

## Arquitectura actual

La aplicacion es Node.js con Express y frontend estatico servido desde `web/`.

- Entrada principal: `server.js`.
- Backend: `api/`.
- Frontend estatico: `web/html`, `web/js`, `web/css`, `web/img`.
- Modelos Mongoose: `api/models`.
- Rutas Express: `api/routes`.
- Controladores: `api/controllers`.
- Middlewares: `api/middlewares`.
- Servicios de integracion: `api/services`.

`server.js` carga variables con `dotenv`, conecta MongoDB mediante `api/db.js`, aplica `helmet` con CSP, `morgan`, `cors`, `express.json()` y sirve `web/` con `express.static`.

Rutas API montadas:

- `/api/auth` -> `api/routes/auth.routes.js`
- `/api/dashboard` -> `api/routes/dashboard.routes.js`
- `/api/usuarios` -> `api/routes/user.routes.js`
- `/api/admin` -> `api/routes/admin.routes.js`
- `/api/productos` -> `api/routes/producto.routes.js`
- `/api/mercado-publico` -> `api/routes/mercadoPublico.routes.js`

Rutas frontend directas:

- `/` -> `web/html/login.html`
- `/cliente/catalogo` -> `web/html/catalogo_cliente.html`

## Dependencias y scripts

Scripts disponibles en `package.json`:

- `npm run dev`: ejecuta `nodemon server.js`.
- `npm start`: ejecuta `node server.js`.
- `npm test`: placeholder que falla intencionalmente con `Error: no test specified`.

Dependencias relevantes:

- Express 5.1.0.
- Mongoose 8.8.2.
- JWT con `jsonwebtoken`.
- Password hashing con `bcryptjs`.
- Seguridad y logs: `helmet`, `cors`, `morgan`.
- Integraciones/scraping: `axios`, `cheerio`.
- Graficos: `chart.js`.

No hay framework de testing configurado.

## Conexion a MongoDB

La conexion esta centralizada en `api/db.js` con Mongoose:

- Usa `mongoose.connect(process.env.MONGO_URI)`.
- Si falla la conexion, registra el error y termina el proceso con `process.exit(1)`.
- Riesgo detectado: actualmente imprime `process.env.MONGO_URI` en consola. Esto puede exponer credenciales si la URI incluye usuario/password.

No se leyo el contenido de `.env`.

## Convenciones efectivas

### Modulos

El backend usa CommonJS:

- `require(...)`
- `module.exports`
- `exports.nombreFuncion = ...`

Excepcion detectada: `web/proxy.js` usa ESM (`import`) y contiene una consulta directa a Mercado Publico. No parece integrado a `server.js`, pero queda como deuda/riesgo por incompatibilidad con el estilo del backend y por seguridad.

### Persistencia

La persistencia usa Mongoose, no el driver nativo de MongoDB. Los modelos usan `Schema` y `model`.

### Autenticacion y autorizacion

- `authMiddleware` valida `Authorization: Bearer <token>` con `JWT_SECRET`.
- `adminMiddleware` permite roles `admin` o `administrador`.
- Las rutas publicas de catalogo son `GET /api/productos` y `GET /api/productos/:id`.
- Las mutaciones de producto requieren `auth` + `adminAuth`.

### Formato de respuestas

No hay un formato unico global.

Patrones observados:

- Exito simple: se devuelve el documento o arreglo directamente.
- Creacion: `201` con el documento creado.
- Errores comunes: `{ error, details }`.
- Algunos auth errors: `{ code, error, message, redirectTo }`.
- Mercado Publico usa con mas consistencia `{ ok: false, error, message, source }`.

Para Fase 1 conviene seguir el patron actual de catalogo (`error`/`details`) salvo que se apruebe una normalizacion mayor, que quedaria fuera de scope.

### Manejo de errores

- Hay middleware 404 y 500 global en `server.js`.
- Los controladores normalmente capturan errores con `try/catch` y responden ellos mismos.
- Algunos errores de validacion se construyen con `err.status`, especialmente en normalizacion de ofertas.
- No hay middleware centralizado de errores de dominio.

### Validacion

La validacion esta principalmente en controladores y parcialmente en esquemas Mongoose.

Ejemplos:

- Usuarios: valida campos requeridos, rol existente, email duplicado.
- Productos: valida nombre/precio minimo en creacion y normaliza oferta en actualizacion.
- Mercado Publico: centraliza validaciones en servicio/controlador.

No hay libreria de validacion declarativa tipo Joi/Zod/express-validator.

## Estado real del modulo catalogo

### Modelo existente

Existe `api/models/Producto.js`.

Campos actuales:

- `id_padre`: `String`, default `""`.
- `nombre`: `String`, requerido.
- `imagen`: `String`, default `""`.
- `region`: `String`, default `""`.
- `precio`: `Number`, requerido.
- `oferta`: subdocumento `Oferta`, default `null`.
- `estado`: enum `activo`/`inactivo`, default `activo`.
- `aprobado`: `Boolean`, default `false`.
- `fecha_creacion`: `Date`, default `Date.now`.
- `timestamps: true`.

No existen actualmente:

- `sku`.
- `descripcion`.
- `unidad`.
- `categoria`.
- `activo` booleano como tal; se usa `estado`.
- Indice unico de SKU.

El modelo referencia `api/models/Oferta.js` como subdocumento sin `_id`.

### Controlador existente

Existe `api/controllers/producto.controller.js` con:

- `getProductos`
- `getProductoById`
- `createProducto`
- `normalizarPreciosProductos`
- `updateProducto`
- `deleteProducto`

Observaciones:

- `createProducto` solo exige `nombre` y `precio`.
- `createProducto` recibe `id_hijo`, pero el esquema `Producto` no define ese campo.
- La validacion `if (!nombre || !precio)` rechaza precio `0`, aunque el frontend actual intenta crear productos con `precio: 0`.
- No hay control de duplicados.
- No hay SKU.
- `updateProducto` permite actualizar cualquier campo recibido en `req.body`, con validacion especial solo para `oferta`.
- `updateProducto` usa `runValidators: true`, pero eso solo cubre restricciones del esquema actual.

### Rutas existentes

Existe `api/routes/producto.routes.js`:

- `GET /api/productos` publico.
- `GET /api/productos/:id` publico.
- `POST /api/productos` protegido por admin.
- `PUT /api/productos/precios/normalizar` protegido por admin.
- `PUT /api/productos/:id` protegido por admin.
- `DELETE /api/productos/:id` protegido por admin.

No existe `PATCH /api/productos/:id`.

### Frontend admin

Existe:

- `web/html/catalogo_admin.html`
- `web/js/catalogo_admin.js`
- `web/css/catalogo_admin.css`

Estado actual:

- Lista productos.
- Permite editar precio y estado por fila.
- Permite crear oferta.
- Permite normalizar precios.
- Tiene boton "Agregar Producto", pero no hay formulario de alta real.
- El alta actual toma el nombre desde un `select` armado con los productos existentes; por lo tanto no permite crear un producto nuevo desde cero.
- El alta manda `precio: 0`, lo que choca con la validacion backend actual de `createProducto`.
- No hay edicion de nombre, SKU, descripcion, unidad, categoria, imagen ni region desde formulario completo.

### Frontend cliente

Existe:

- `web/html/catalogo_cliente.html`
- `web/js/catalogo_cliente.js`
- `web/css/catalogo_cliente.css`

Consume `GET /api/productos`, filtra en cliente por `aprobado === true` y `estado === "activo"`, y usa carrito local/exportacion.

Riesgos detectados:

- Usa `p.id` para carrito/modal, pero los documentos Mongoose expuestos normalmente traen `_id`; Mongoose puede incluir virtual `id`, pero conviene verificar antes de tocar este flujo.
- Hay una llamada a `/oportunidades`, pero `server.js` no monta esa ruta. Parece depender de `web/proxy.js`, que no esta integrado al servidor principal.

### Importador de productos

Existe `importProductos.js`, que:

- Scrapea productos desde Odoo con `axios` y `cheerio`.
- Hace upsert de `Producto` por `id_padre`.
- Pobla `nombre`, `imagen`, `precio`, `estado`, `aprobado`, `region`.

Esto explica el origen historico del catalogo: productos importados y luego administrados, no creados manualmente desde un CRUD completo.

## Que falta para crear y editar productos correctamente

Para cumplir Fase 1 falta definir e implementar:

- Campos definitivos del producto.
- Estrategia de compatibilidad con datos existentes (`id_padre`, `imagen`, `region`, `estado`, `aprobado`, `oferta`).
- SKU unico si se confirma como obligatorio.
- Validaciones backend para:
  - nombre requerido.
  - precio numerico y no negativo.
  - SKU requerido/unico si se aprueba.
  - campos string recortados.
  - estado permitido o mapeo con `activo`.
  - ObjectId invalido en obtener/editar/eliminar.
- Control de duplicados con respuesta 409.
- Restringir updates a campos permitidos.
- Formulario admin real para crear/editar.
- Estados UX: cargando, error, exito.
- Manejo de errores de API en frontend mostrando mensajes utiles.
- Pruebas manuales o automatizadas; actualmente no hay runner de pruebas.

## Encaje de Fase 1

Fase 1 debe ser incremental sobre el modulo existente:

- Reutilizar `api/models/Producto.js`.
- Reutilizar `api/controllers/producto.controller.js`.
- Reutilizar `api/routes/producto.routes.js`.
- Reutilizar `web/html/catalogo_admin.html`, `web/js/catalogo_admin.js` y `web/css/catalogo_admin.css`.
- Mantener `GET /api/productos` compatible con catalogo cliente e importador.
- Evitar romper datos importados por `id_padre`.
- Mantener `estado`/`aprobado` salvo que se apruebe migrar a `activo` booleano.

La opcion mas conservadora es ampliar el modelo actual con los campos aprobados (`sku`, `descripcion`, `unidad`, `categoria`) y conservar campos existentes.

## Encaje de Fase 2

`SolicitudCompra` debe ser una entidad nueva e independiente de Mercado Publico.

Encaje recomendado:

- Nuevo modelo `api/models/SolicitudCompra.js`.
- Nuevo controlador `api/controllers/solicitudCompra.controller.js`.
- Nueva ruta `api/routes/solicitudCompra.routes.js`.
- Montaje en `server.js` bajo `/api/solicitudes-compra`.
- Frontend nuevo o vista dedicada en `web/html` y `web/js`.

Debe referenciar productos solo para construir snapshots de items:

- `productoId`
- `nombre`
- `sku`
- `precioUnitario`
- `cantidad`
- `subtotal`

La cotizacion no debe depender dinamicamente del producto despues de emitida.

Decisiones pendientes antes de Fase 2:

- Impuestos: si aplica IVA, tasa y redondeo.
- Folio/correlativo: formato, prefijo, reinicio anual o secuencia global.
- Datos del cliente: texto libre, referencia a modelo futuro o ambos.
- Reglas de transicion de estado.

## Riesgos y deuda tecnica detectada

- `api/db.js` imprime `MONGO_URI`; puede filtrar secretos en logs.
- `web/proxy.js` contiene un ticket hardcodeado de Mercado Publico y usa ESM fuera del estilo del backend.
- `package.json` no declara `node-fetch`, pero `server.js` intenta requerirlo si no existe `global.fetch`. En Node moderno no se activa, pero es una dependencia implícita riesgosa.
- No hay pruebas automatizadas.
- Respuestas API no tienen contrato uniforme.
- `createProducto` backend rechaza `precio: 0`, mientras la UI actual intenta crear con `precio: 0`.
- `createProducto` recibe `id_hijo`, pero el esquema no lo define.
- `updateProducto` acepta campos arbitrarios del body.
- No hay control de SKU ni duplicados en productos.
- `docs/` no existia antes de esta fase.

## Ambiguedades a resolver antes o durante Fase 1

- Confirmar si `sku` sera obligatorio y unico para todos los productos, incluidos productos ya importados.
- Confirmar si `precio` puede ser `0` o debe ser estrictamente mayor a `0`.
- Confirmar si se mantiene `estado: "activo" | "inactivo"` o se migra/agrega `activo: Boolean`.
- Confirmar campos definitivos de producto: `descripcion`, `unidad`, `categoria`, `imagen`, `region`, `id_padre`.
- Confirmar si `aprobado` seguira existiendo como flujo separado de visibilidad cliente.

