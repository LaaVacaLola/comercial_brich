# AGENTS.md — Reglas de trabajo del proyecto

Este proyecto es una aplicación **Node.js con Express, MongoDB/Mongoose** y frontend estático servido desde `web/`. Mantener los cambios simples, localizados y consistentes con la estructura actual.

> Este archivo es de lectura obligatoria antes de cualquier acción. Define **cómo** trabajar en este repositorio, no solo **qué** construir.

---

## 0. Trabajo en curso

Objetivo del trabajo actual:

1. Completar el módulo de **catálogo** (CRUD de productos, foco en *crear* y *editar*).
2. Crear un nuevo modelo **`SolicitudCompra`** que funcione como **cotización** para postular/presentar a clientes.

> ⚠️ **No confundir:** `SolicitudCompra` es una **cotización interna propia** (nuestro modelo, para presentar a clientes). NO es lo mismo que las **"órdenes de compra" de Mercado Público** descritas en la sección de integración. Son entidades distintas y no deben mezclarse.

---

## 1. Reglas de oro (NO negociables)

1. **Investiga antes de tocar.** Nunca escribas código sin haber leído y entendido el código existente relacionado.
2. **Registra cada cambio** en `docs/REGISTRO-CAMBIOS.md` (ver §3).
3. **Planifica por fase.** Antes de cada fase, entrega un plan detallado (ver §2).
4. **Pide aprobación SIEMPRE.** No empieces ninguna fase sin un `APROBADO` explícito del humano. Si surge una duda a mitad de fase que cambia el plan, **detente y pregunta**.
5. **Respeta las convenciones existentes** (§5): CommonJS, estructura `api/`, middlewares base, etc. No agregues dependencias nuevas sin justificar y aprobar.
6. **Scope cerrado.** No modifiques archivos fuera del alcance acordado de la fase actual. Evita refactors masivos.
7. **Sin relleno.** Respuestas directas y técnicas. Código limpio, comentado y listo para producción.

---

## 2. Protocolo de cada fase

Para **cada** fase sigue este ciclo:

```
[1] PLAN      → Presenta: objetivo, archivos a tocar, modelos/endpoints,
                edge cases, criterios de aceptación y plan de pruebas.
[2] ESPERA    → Detente. No escribas código hasta recibir "APROBADO".
[3] EJECUTA   → Implementa SOLO lo aprobado.
[4] REGISTRA  → Actualiza docs/REGISTRO-CAMBIOS.md.
[5] VERIFICA  → Ejecuta/escribe pruebas y reporta resultados.
[6] CIERRE    → Resume lo hecho y propone la siguiente fase. Espera aprobación.
```

**Formato del PLAN que debes entregar antes de cada fase:**

```
## Fase N — <nombre>
- Objetivo:
- Archivos a crear (ruta):
- Archivos a modificar (ruta + función/líneas afectadas):
- Modelos / esquemas Mongoose:
- Rutas / controladores / middlewares:
- Edge cases identificados:
- Criterios de aceptación:
- Plan de pruebas / validaciones:
- Riesgos o dependencias:
```

---

## 3. Registro de cambios (`docs/REGISTRO-CAMBIOS.md`)

Bitácora append-only. Una entrada por cada fase ejecutada:

```
## [YYYY-MM-DD] Fase N — <nombre>
**Archivos creados:** ...
**Archivos modificados:** ... (función / líneas)
**Decisiones técnicas:** ...
**Edge cases cubiertos:** ...
**Pruebas:** <resultado>
**Pendiente / deuda técnica:** ...
```

Si el archivo no existe, créalo en la Fase 0.

---

## 4. Plan por fases

### Fase 0 — Reconocimiento (SOLO LECTURA)
**No se escribe código de producción.**
- Mapear: `server.js`, `package.json` (scripts y dependencias), `api/routes`, `api/controllers`, `api/models`, `api/middlewares`, conexión a Mongo y frontend en `web/`.
- Verificar el estado real del módulo de catálogo: ¿existe modelo `Producto`?, ¿qué rutas/controladores hay?, ¿qué falta para crear y editar?
- Confirmar convenciones efectivas (CommonJS, patrón de validación, formato de respuestas y errores, cómo `web/` consume la API).
- **Entregables:** `docs/ANALISIS-INICIAL.md` (arquitectura actual, qué falta en catálogo, cómo encajan Fases 1 y 2, riesgos) y `docs/REGISTRO-CAMBIOS.md` con su cabecera.
- **Gate:** presentar análisis + PLAN de Fase 1. Esperar `APROBADO`.

### Fase 1 — Catálogo: crear y editar productos
- **Modelo:** `api/models/Producto.js` (Mongoose). Campos sugeridos a confirmar: `nombre`, `sku` (único), `descripcion`, `precio` (≥ 0), `unidad`, `categoria`, `activo`, timestamps.
- **Controlador:** `api/controllers` → crear y editar (reutilizar lectura/listado si ya existen; si no, mínimos).
- **Rutas:** `api/routes` → `POST /productos`, `PUT|PATCH /productos/:id`.
- **Validación:** en middleware o controlador antes de persistir (campos requeridos, tipos, `sku` único, `precio` numérico ≥ 0).
- **Frontend (`web/`, JS vanilla):** formulario de crear/editar con validación en cliente y estados (carga, error, éxito).
- **Edge cases:** `sku` duplicado, edición de producto inexistente (404), precio negativo/no numérico.
- **Pruebas:** crear, editar, validación fallida, producto inexistente.
- **Gate:** demo + `APROBADO` para Fase 2.

### Fase 2 — Modelo `SolicitudCompra` (cotización)
- **Modelo:** `api/models/SolicitudCompra.js`.
  - Cabecera: `cliente`, `folio`/correlativo, `fecha`, `estado` (`borrador` → `enviada` → `aceptada` | `rechazada` | `vencida`), `validezDias`, `observaciones`.
  - `items[]`: **snapshot** del producto (`productoId`, `nombre`, `sku`, `precioUnitario`, `cantidad`, `subtotal`). El snapshot es clave: una cotización emitida **no debe mutar** si el catálogo cambia después.
  - Totales: `neto`, impuestos (si aplica), `total`.
- **Controlador/Rutas:** crear cotización, agregar/quitar items, recalcular totales, cambiar estado, obtener/listar (`/api/solicitudes-compra` o prefijo a confirmar).
- **Frontend (`web/`):** vista para armar la cotización seleccionando productos del catálogo, ajustar cantidades y ver totales en vivo.
- **Edge cases:** cotización sin items, producto eliminado del catálogo tras crear el item (cubierto por el snapshot), cantidad ≤ 0, transición de estado inválida, correlativo de folio bajo concurrencia.
- **Pruebas:** creación, cálculo de totales, inmutabilidad del snapshot, transiciones de estado válidas/inválidas.
- **Gate:** demo + `APROBADO` para Fase 3.

### Fase 3 — Pulido e integración (opcional, sujeto a aprobación)
- Exportación/impresión de la cotización (PDF o vista imprimible) para presentar al cliente.
- Mejoras UX, búsqueda/filtros de productos al armar la cotización.
- Refactors y reducción de deuda técnica anotada en el registro.

---

## 5. Reglas generales Node.js

- Usar CommonJS (`require` / `module.exports`), siguiendo el estilo actual de `server.js` y `api/`.
- Mantener las rutas en `api/routes`, los controladores en `api/controllers`, los modelos Mongoose en `api/models` y los middlewares en `api/middlewares`.
- Usar variables de entorno desde `.env` para configuración sensible o dependiente del ambiente.
- No hardcodear secretos, tokens, tickets, URIs de base de datos ni credenciales en el código.
- Conservar los middlewares base del servidor: `helmet`, `cors`, `morgan`, `express.json()` y los manejadores de errores.
- Agregar validaciones de entrada en controladores o middlewares antes de guardar o consultar datos.
- Responder errores con mensajes seguros para el cliente y registrar internamente solo información útil, sin secretos.
- Evitar refactors masivos o cambios fuera del alcance solicitado.
- Preferir funciones pequeñas y nombres claros para rutas, controladores y servicios.
- Mantener compatibilidad con los scripts existentes: `npm run dev` para desarrollo y `npm start` para producción.
- En entregas, indica **solo las líneas/funciones modificadas**, no reescribas archivos completos salvo que sean nuevos.
- Incluye validaciones o casos de prueba cuando corresponda (autoverificación).

---

## 6. Integración Mercado Público / ChileCompra

La integración con Mercado Público debe hacerse desde el backend, no directamente desde el frontend cuando se utilice ticket de acceso.

- Base URL oficial: `https://api.mercadopublico.cl/servicios/v1/publico`
- Guardar el ticket en la variable de entorno `MERCADO_PUBLICO_TICKET`.
- Usar `axios` o `fetch` desde controladores/servicios backend.
- Nunca enviar ni exponer el ticket al navegador, logs públicos o respuestas JSON.
- Respetar el límite oficial de 10.000 solicitudes diarias por ticket.
- Centralizar la construcción de URLs y parámetros para evitar duplicación.
- Manejar timeouts, errores de red, respuestas vacías y errores de formato.
- Usar formato JSON por defecto.
- Las fechas de consulta de la API deben enviarse en formato `ddmmaaaa`.
- Si se agregan rutas locales para esta integración, usar un prefijo claro como `/api/mercado-publico`.

### Endpoints oficiales a considerar

#### Licitaciones

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

Estados documentados para licitaciones: `publicada`, `cerrada`, `desierta`, `adjudicada`, `revocada`, `suspendida`, `todos`, `activas`.

Códigos de estado devueltos por la API: Publicada `5`, Cerrada `6`, Desierta `7`, Adjudicada `8`, Revocada `18`, Suspendida `19`.

#### Órdenes de compra (Mercado Público)

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

Estados documentados: `enviadaproveedor`, `aceptada`, `cancelada`, `recepcionconforme`, `pendienterecepcion`, `recepcionaceptadacialmente`, `recepecionconformeincompleta`, `todos`.

Códigos de estado devueltos por la API: Enviada a proveedor `4`, En proceso `5`, Aceptada `6`, Cancelada `9`, Recepción conforme `12`, Pendiente de recepcionar `13`, Recepcionada parcialmente `14`, Recepción conforme incompleta `15`.

#### Búsqueda de proveedor por RUT

```text
GET https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor?rutempresaproveedor={rut}&ticket={ticket}
```

- El RUT debe incluir puntos, guion y dígito verificador, según documentación oficial.
- Usar este endpoint para obtener el código interno de proveedor antes de consultar por `CodigoProveedor`.

#### Búsqueda de organismos compradores

```text
GET https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarComprador?ticket={ticket}
```

- Usar este endpoint para obtener códigos internos de organismos públicos.
- Usar el código obtenido en consultas con `CodigoOrganismo`.

### Requerimientos con Mercado Público

- Listar licitaciones con filtros básicos y avanzados.
- Visualizar licitación (detalles, adjuntos, fechas, etc.).
- Listar órdenes de compra (Convenio Marco o Postulaciones).
- Visualizar órdenes de compra con todo su detalle.
- Reportes analíticos de proveedores, clientes, a quién le vende, quién compra, cantidades, montos.

---

## 7. Seguridad y manejo de datos

- No guardar tickets reales en archivos versionados.
- No imprimir `MERCADO_PUBLICO_TICKET` en consola.
- Sanitizar parámetros recibidos desde clientes antes de consultar la API externa.
- Validar formato de fecha, código, estado, RUT y códigos numéricos antes de construir la URL.
- Devolver errores controlados si falta configuración (por ejemplo, si `MERCADO_PUBLICO_TICKET` no existe).
- Citar como fuente de datos a la Dirección ChileCompra cuando se publique información obtenida sin modificar desde la API.
- Cuidado con inyección en queries de Mongo: nunca confiar en datos del cliente.

### Fuentes oficiales

- https://www.chilecompra.cl/api/
- https://api.mercadopublico.cl/modules/api.aspx

---

## 8. Qué hacer ante ambigüedad

Si algo no está definido (campos del producto, impuestos, correlativo de folio, reglas de negocio de la cotización): **pregunta antes de asumir**. Una pregunta concreta es preferible a una implementación que haya que rehacer.
