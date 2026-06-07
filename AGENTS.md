# Reglas de trabajo del proyecto

Este proyecto es una aplicacion Node.js con Express, MongoDB/Mongoose y frontend estatico servido desde `web/`. Mantener los cambios simples, localizados y consistentes con la estructura actual.

## Reglas generales Node.js

- Usar CommonJS (`require` / `module.exports`), siguiendo el estilo actual de `server.js` y `api/`.
- Mantener las rutas en `api/routes`, los controladores en `api/controllers`, los modelos Mongoose en `api/models` y los middlewares en `api/middlewares`.
- Usar variables de entorno desde `.env` para configuracion sensible o dependiente del ambiente.
- No hardcodear secretos, tokens, tickets, URIs de base de datos ni credenciales en el codigo.
- Conservar los middlewares base del servidor: `helmet`, `cors`, `morgan`, `express.json()` y los manejadores de errores.
- Agregar validaciones de entrada en controladores o middlewares antes de guardar o consultar datos.
- Responder errores con mensajes seguros para el cliente y registrar internamente solo informacion util, sin secretos.
- Evitar refactors masivos o cambios fuera del alcance solicitado.
- Preferir funciones pequenas y nombres claros para rutas, controladores y servicios.
- Mantener compatibilidad con los scripts existentes: `npm run dev` para desarrollo y `npm start` para produccion.

## Integracion Mercado Publico / ChileCompra

La integracion con Mercado Publico debe hacerse desde el backend, no directamente desde el frontend cuando se utilice ticket de acceso.

- Base URL oficial: `https://api.mercadopublico.cl/servicios/v1/publico`
- Guardar el ticket en la variable de entorno `MERCADO_PUBLICO_TICKET`.
- Usar `axios` o `fetch` desde controladores/servicios backend.
- Nunca enviar ni exponer el ticket al navegador, logs publicos o respuestas JSON.
- Respetar el limite oficial de 10.000 solicitudes diarias por ticket.
- Centralizar la construccion de URLs y parametros para evitar duplicacion.
- Manejar timeouts, errores de red, respuestas vacias y errores de formato.
- Usar formato JSON por defecto.
- Las fechas de consulta de la API deben enviarse en formato `ddmmaaaa`.
- Si se agregan rutas locales para esta integracion, usar un prefijo claro como `/api/mercado-publico`.

## Endpoints oficiales a considerar

### Licitaciones

Endpoint:

```text
GET https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json
```

Consultas principales:

```text
?ticket={ticket}
?fecha=ddmmaaaa&ticket={ticket}
?codigo={codigoLicitacion}&ticket={ticket}
?estado={estado}&ticket={ticket}
?fecha=ddmmaaaa&estado={estado}&ticket={ticket}
?fecha=ddmmaaaa&CodigoOrganismo={codigoOrganismo}&ticket={ticket}
?fecha=ddmmaaaa&CodigoProveedor={codigoProveedor}&ticket={ticket}
```

Estados documentados para licitaciones:

- `publicada`
- `cerrada`
- `desierta`
- `adjudicada`
- `revocada`
- `suspendida`
- `todos`
- `activas`

Codigos de estado devueltos por la API:

- Publicada: `5`
- Cerrada: `6`
- Desierta: `7`
- Adjudicada: `8`
- Revocada: `18`
- Suspendida: `19`

### Ordenes de compra

Endpoint:

```text
GET https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json
```

Consultas principales:

```text
?estado=todos&ticket={ticket}
?fecha=ddmmaaaa&ticket={ticket}
?codigo={codigoOrdenCompra}&ticket={ticket}
?fecha=ddmmaaaa&estado={estado}&ticket={ticket}
?fecha=ddmmaaaa&CodigoOrganismo={codigoOrganismo}&ticket={ticket}
?fecha=ddmmaaaa&CodigoProveedor={codigoProveedor}&ticket={ticket}
```

Estados documentados para ordenes de compra:

- `enviadaproveedor`
- `aceptada`
- `cancelada`
- `recepcionconforme`
- `pendienterecepcion`
- `recepcionaceptadacialmente`
- `recepecionconformeincompleta`
- `todos`

Codigos de estado devueltos por la API:

- Enviada a proveedor: `4`
- En proceso: `5`
- Aceptada: `6`
- Cancelada: `9`
- Recepcion conforme: `12`
- Pendiente de recepcionar: `13`
- Recepcionada parcialmente: `14`
- Recepcion conforme incompleta: `15`

### Busqueda de proveedor por RUT

Endpoint:

```text
GET https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor?rutempresaproveedor={rut}&ticket={ticket}
```

Reglas:

- El RUT debe incluir puntos, guion y digito verificador, segun documentacion oficial.
- Usar este endpoint para obtener el codigo interno de proveedor antes de consultar por `CodigoProveedor`.

### Busqueda de organismos compradores

Endpoint:

```text
GET https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarComprador?ticket={ticket}
```

Reglas:

- Usar este endpoint para obtener codigos internos de organismos publicos.
- Usar el codigo obtenido en consultas con `CodigoOrganismo`.

## Seguridad y manejo de datos

- No guardar tickets reales en archivos versionados.
- No imprimir `MERCADO_PUBLICO_TICKET` en consola.
- Sanitizar parametros recibidos desde clientes antes de consultar la API externa.
- Validar formato de fecha, codigo, estado, RUT y codigos numericos antes de construir la URL.
- Devolver errores controlados si falta configuracion, por ejemplo si `MERCADO_PUBLICO_TICKET` no existe.
- Citar como fuente de datos a la Direccion ChileCompra cuando se publique informacion obtenida sin modificar desde la API.

## Fuentes oficiales

- https://www.chilecompra.cl/api/
- https://api.mercadopublico.cl/modules/api.aspx

# Requerimientos con Mercado Público

- Listar Licitaciones con filtros básicos y avanzados.
- Visualizar Liticacion (detalles, adjuntos, fechas, etc).
- Listar ordenes de compra (Convenio Marco o Postulaciones).
- Visualizar Ordenes de compra con todo su detalle.
- Reportes analiticos de proveedores, clientes, aquien le vende, quien compra, cantidades, montos.
