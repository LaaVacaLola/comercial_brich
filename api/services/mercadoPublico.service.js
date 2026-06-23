const axios = require("axios");
const { randomUUID } = require("crypto");
const MercadoPublicoConfig = require("../models/MercadoPublicoConfig");
const MercadoPublicoProveedor = require("../models/MercadoPublicoProveedor");
const MercadoPublicoCliente = require("../models/MercadoPublicoCliente");
const MercadoPublicoOrdenCache = require("../models/MercadoPublicoOrdenCache");
const MercadoPublicoJob = require("../models/MercadoPublicoJob");
const MercadoPublicoAnalisis = require("../models/MercadoPublicoAnalisis");

const BASE_URL = "https://api.mercadopublico.cl/servicios/v1";
const PUBLIC_URL = `${BASE_URL}/publico`;
const EMPRESAS_URL = `${BASE_URL}/Publico/Empresas`;

const LICITACION_ESTADOS = new Set([
  "publicada",
  "cerrada",
  "desierta",
  "adjudicada",
  "revocada",
  "suspendida",
  "todos",
  "activas",
]);

const ORDEN_ESTADOS = new Set([
  "enviadaproveedor",
  "aceptada",
  "cancelada",
  "recepcionconforme",
  "pendienterecepcion",
  "recepcionaceptadacialmente",
  "recepecionconformeincompleta",
  "todos",
]);

const CHILECOMPRA_REQUEST_DELAY_MS = 1200;
const CHILECOMPRA_429_RETRY_DELAY_MS = 8000;
const CHILECOMPRA_MAX_RETRIES = 2;
const OC_DOWNLOAD_MAX_PER_ENTITY = 1000;
const reportJobs = new Map();
const downloadJobQueue = [];
let downloadJobActive = false;
const ocProcessingQueue = [];
let ocProcessingActiveCount = 0;
const OC_PROCESSING_WORKERS = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTicket() {
  const config = await MercadoPublicoConfig.findOne({ key: "default" }).lean();
  const ticket = config?.ticket || process.env.MERCADO_PUBLICO_TICKET;

  if (!ticket) {
    const err = new Error("Falta configurar el ticket de Mercado Publico en ajustes o MERCADO_PUBLICO_TICKET");
    err.status = 500;
    throw err;
  }
  return ticket;
}

function maskTicket(ticket) {
  if (!ticket) return null;
  if (ticket.length <= 8) return "********";
  return `${ticket.slice(0, 4)}...${ticket.slice(-4)}`;
}

function toApiDate(value) {
  if (!value) return undefined;
  if (/^\d{8}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}${month}${year}`;
  }
  const err = new Error("La fecha debe usar formato YYYY-MM-DD o ddmmaaaa");
  err.status = 400;
  throw err;
}

function cleanCode(value, label) {
  if (!value) return undefined;
  const clean = String(value).trim();
  if (!/^[A-Za-z0-9_.-]{1,60}$/.test(clean)) {
    const err = new Error(`${label} tiene un formato invalido`);
    err.status = 400;
    throw err;
  }
  return clean;
}

function cleanRut(value) {
  if (!value) {
    const err = new Error("El RUT del proveedor es obligatorio");
    err.status = 400;
    throw err;
  }
  const clean = String(value).trim();
  if (!/^[0-9.]{7,12}-[0-9Kk]$/.test(clean)) {
    const err = new Error("El RUT debe incluir puntos, guion y digito verificador");
    err.status = 400;
    throw err;
  }
  return clean;
}

function cleanOptionalRut(value) {
  if (!value) return "";
  const clean = String(value).trim();
  if (!/^[0-9.]{7,12}-[0-9Kk]$/.test(clean)) return clean.slice(0, 30);
  return clean;
}

function cleanText(value, max = 500) {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, max);
}

function cleanSearchText(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase().slice(0, 120);
}

function cleanNumber(value) {
  const number = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function cleanDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanEstado(value, allowed, label) {
  if (!value) return undefined;
  const clean = String(value).trim().toLowerCase();
  if (!allowed.has(clean)) {
    const err = new Error(`${label} no es valido`);
    err.status = 400;
    throw err;
  }
  return clean;
}

async function buildParams(query, allowedEstados) {
  const params = {
    ticket: await getTicket(),
  };

  const fecha = toApiDate(query.fecha);
  const codigo = cleanCode(query.codigo, "codigo");
  const estado = cleanEstado(query.estado, allowedEstados, "estado");
  const codigoOrganismo = cleanCode(query.CodigoOrganismo || query.codigoOrganismo, "CodigoOrganismo");
  const codigoProveedor = cleanCode(query.CodigoProveedor || query.codigoProveedor, "CodigoProveedor");

  if (fecha) params.fecha = fecha;
  if (codigo) params.codigo = codigo;
  if (estado) params.estado = estado;
  if (codigoOrganismo) params.CodigoOrganismo = codigoOrganismo;
  if (codigoProveedor) params.CodigoProveedor = codigoProveedor;

  return params;
}

function formatApiDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return formatApiDate(date);
  });
}

function datesBetween(fechaDesde, fechaHasta) {
  const from = fechaDesde ? toApiDate(fechaDesde) : undefined;
  const to = fechaHasta ? toApiDate(fechaHasta) : undefined;

  if (!from && !to) return null;

  const parse = (value) => {
    const day = Number(value.slice(0, 2));
    const month = Number(value.slice(2, 4)) - 1;
    const year = Number(value.slice(4, 8));
    return new Date(year, month, day);
  };

  const start = parse(from || to);
  const end = parse(to || from);

  if (start > end) {
    const err = new Error("fechaDesde no puede ser mayor que fechaHasta");
    err.status = 400;
    throw err;
  }

  const dates = [];
  const cursor = new Date(start);
  const maxDays = 365;

  while (cursor <= end) {
    if (dates.length >= maxDays) {
      const err = new Error(`El rango de fechas no puede superar ${maxDays} dias`);
      err.status = 400;
      throw err;
    }

    dates.push(formatApiDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function hasAnyQuery(query = {}) {
  return ["fecha", "fechaDesde", "fechaHasta", "codigo", "estado", "CodigoOrganismo", "codigoOrganismo", "CodigoProveedor", "codigoProveedor", "texto"]
    .some((key) => query[key] !== undefined && String(query[key]).trim() !== "");
}

function matchesSearchText(item, searchText) {
  if (!searchText) return true;
  const haystack = [
    item?.Nombre,
    item?.NombreLicitacion,
    item?.Descripcion,
    item?.CodigoExterno,
    item?.Codigo,
    item?.Comprador?.NombreOrganismo,
    item?.Comprador?.NombreUnidad,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(searchText);
}

function filterBySearchText(listado, query = {}) {
  const searchText = cleanSearchText(query.texto || query.busqueda || query.q);
  if (!searchText) return listado;
  return listado.filter((item) => matchesSearchText(item, searchText));
}

async function requestChileCompra(url, params, attempt = 0) {
  try {
    await sleep(CHILECOMPRA_REQUEST_DELAY_MS);
    const response = await axios.get(url, {
      params,
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });

    return response.data;
  } catch (err) {
    const status = err.response?.status || err.status || 502;
    if (status === 429 && attempt < CHILECOMPRA_MAX_RETRIES) {
      await sleep(CHILECOMPRA_429_RETRY_DELAY_MS * (attempt + 1));
      return requestChileCompra(url, params, attempt + 1);
    }

    const message = status === 500
      ? "Error consultando Mercado Publico"
      : "No fue posible obtener datos desde Mercado Publico";
    const safeError = new Error(message);
    safeError.status = status;
    throw safeError;
  }
}

async function requestLicitacionesUltimaSemana() {
  const ticket = await getTicket();
  const results = await Promise.allSettled(
    lastSevenDays().map((fecha) =>
      requestChileCompra(`${PUBLIC_URL}/licitaciones.json`, {
        fecha,
        ticket,
      })
    )
  );

  const fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (!fulfilled.length) {
    const firstError = results.find((result) => result.status === "rejected")?.reason;
    throw firstError || new Error("No fue posible obtener licitaciones de la ultima semana");
  }

  const listado = fulfilled.flatMap(getListado);

  return {
    Cantidad: listado.length,
    Listado: listado,
    filtrosAplicados: {
      rango: "ultimos_7_dias",
      fechas: lastSevenDays(),
    },
  };
}

async function requestLicitacionesPorFechas(query) {
  const fechas = datesBetween(query.fechaDesde, query.fechaHasta);
  if (!fechas) return null;

  const ticket = await getTicket();
  const estado = cleanEstado(query.estado, LICITACION_ESTADOS, "estado");
  const codigoOrganismo = cleanCode(query.CodigoOrganismo || query.codigoOrganismo, "CodigoOrganismo");
  const codigoProveedor = cleanCode(query.CodigoProveedor || query.codigoProveedor, "CodigoProveedor");

  const fetchRange = async (includeEstado) => Promise.allSettled(
    fechas.map((fecha) => {
      const params = { fecha, ticket };
      if (includeEstado && estado) params.estado = estado;
      if (codigoOrganismo) params.CodigoOrganismo = codigoOrganismo;
      if (codigoProveedor) params.CodigoProveedor = codigoProveedor;
      return requestChileCompra(`${PUBLIC_URL}/licitaciones.json`, params);
    })
  );

  let results = await fetchRange(true);
  let fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  let listado = filterBySearchText(fulfilled.flatMap(getListado), query);

  if (!listado.length && estado === "todos") {
    results = await fetchRange(false);
    fulfilled = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    listado = filterBySearchText(fulfilled.flatMap(getListado), query);
  }

  if (!fulfilled.length) {
    const firstError = results.find((result) => result.status === "rejected")?.reason;
    throw firstError || new Error("No fue posible obtener licitaciones para el rango de fechas");
  }

  const byCode = new Map();
  listado.forEach((item) => {
    const code = item.CodigoExterno || item.Codigo || JSON.stringify(item);
    byCode.set(code, item);
  });

  return {
    Cantidad: byCode.size,
    Listado: Array.from(byCode.values()),
    filtrosAplicados: {
      rango: "fecha_desde_hasta",
      fechas,
      estado: estado || null,
      codigoOrganismo: codigoOrganismo || null,
      codigoProveedor: codigoProveedor || null,
    },
  };
}

function getListado(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.Listado)) return data.Listado;
  if (Array.isArray(data?.listado)) return data.listado;
  return [];
}

async function listarLicitaciones(query = {}) {
  if (query.codigo) {
    return requestChileCompra(`${PUBLIC_URL}/licitaciones.json`, await buildParams(query, LICITACION_ESTADOS));
  }

  const byRange = await requestLicitacionesPorFechas(query);
  if (byRange) return byRange;

  if (!hasAnyQuery(query)) {
    return requestLicitacionesUltimaSemana();
  }

  const data = await requestChileCompra(`${PUBLIC_URL}/licitaciones.json`, await buildParams(query, LICITACION_ESTADOS));
  const listado = filterBySearchText(getListado(data), query);

  if (listado.length !== getListado(data).length) {
    return {
      ...data,
      Cantidad: listado.length,
      Listado: listado,
      filtrosAplicados: {
        ...(data.filtrosAplicados || {}),
        texto: cleanSearchText(query.texto || query.busqueda || query.q),
      },
    };
  }

  return data;
}

async function obtenerLicitacion(codigo) {
  return listarLicitaciones({ codigo });
}

async function listarOrdenes(query = {}) {
  const byRange = await requestOrdenesPorFechas(query);
  if (byRange) return byRange;

  return requestChileCompra(`${PUBLIC_URL}/ordenesdecompra.json`, await buildParams(query, ORDEN_ESTADOS));
}

async function obtenerOrden(codigo) {
  return listarOrdenes({ codigo });
}

async function buscarProveedor(rut) {
  return requestChileCompra(`${EMPRESAS_URL}/BuscarProveedor`, {
    rutempresaproveedor: cleanRut(rut),
    ticket: await getTicket(),
  });
}

async function buscarCompradores() {
  return requestChileCompra(`${EMPRESAS_URL}/BuscarComprador`, {
    ticket: await getTicket(),
  });
}

function normalizeProveedorPayload(payload = {}) {
  const proveedor = payload.proveedor || {};
  const licitacion = payload.licitacion || {};
  const comprador = licitacion.comprador || {};
  const productos = Array.isArray(licitacion.productos) ? licitacion.productos : [];

  const codigoProveedor = cleanCode(
    proveedor.codigoProveedor || proveedor.codigo || proveedor.CodigoProveedor || proveedor.Codigo,
    "codigoProveedor"
  );
  const nombreProveedor = cleanText(
    proveedor.nombreProveedor || proveedor.nombre || proveedor.NombreProveedor || proveedor.Nombre,
    220
  );
  const codigoLicitacion = cleanCode(
    licitacion.codigo || licitacion.CodigoExterno || licitacion.Codigo,
    "codigoLicitacion"
  );

  if (!codigoProveedor) {
    const err = new Error("El codigo del proveedor es obligatorio");
    err.status = 400;
    throw err;
  }

  if (!nombreProveedor) {
    const err = new Error("El nombre del proveedor es obligatorio");
    err.status = 400;
    throw err;
  }

  if (!codigoLicitacion) {
    const err = new Error("El codigo de licitacion es obligatorio");
    err.status = 400;
    throw err;
  }

  return {
    codigoProveedor,
    nombreProveedor,
    rutProveedor: cleanOptionalRut(proveedor.rutProveedor || proveedor.rut || proveedor.RutProveedor || proveedor.RutSucursal),
    licitacion: {
      codigo: codigoLicitacion,
      nombre: cleanText(licitacion.nombre || licitacion.Nombre, 500),
      estado: cleanText(licitacion.estado || licitacion.Estado, 80),
      codigoEstado: cleanNumber(licitacion.codigoEstado || licitacion.CodigoEstado) || null,
      tipo: cleanText(licitacion.tipo || licitacion.Tipo, 30),
      moneda: cleanText(licitacion.moneda || licitacion.Moneda, 20),
      montoEstimado: cleanNumber(licitacion.montoEstimado || licitacion.MontoEstimado),
      fechaPublicacion: cleanDateValue(licitacion.fechaPublicacion),
      fechaCierre: cleanDateValue(licitacion.fechaCierre),
      comprador: {
        codigoOrganismo: cleanText(comprador.codigoOrganismo || comprador.CodigoOrganismo, 40),
        nombreOrganismo: cleanText(comprador.nombreOrganismo || comprador.NombreOrganismo, 220),
        codigoUnidad: cleanText(comprador.codigoUnidad || comprador.CodigoUnidad, 40),
        nombreUnidad: cleanText(comprador.nombreUnidad || comprador.NombreUnidad, 220),
        region: cleanText(comprador.region || comprador.RegionUnidad, 120),
        comuna: cleanText(comprador.comuna || comprador.ComunaUnidad, 120),
      },
      productos: productos.slice(0, 80).map((producto) => ({
        codigoProducto: cleanText(producto.codigoProducto || producto.CodigoProducto, 40),
        nombreProducto: cleanText(producto.nombreProducto || producto.NombreProducto || producto.Producto, 220),
        codigoCategoria: cleanText(producto.codigoCategoria || producto.CodigoCategoria, 40),
        categoria: cleanText(producto.categoria || producto.Categoria, 300),
        cantidad: cleanNumber(producto.cantidad || producto.Cantidad),
        unidadMedida: cleanText(producto.unidadMedida || producto.UnidadMedida || producto.Unidad, 80),
      })),
      guardadoEn: new Date(),
    },
  };
}

async function guardarProveedorObservado(payload, updatedBy) {
  const data = normalizeProveedorPayload(payload);
  let proveedor = await MercadoPublicoProveedor.findOne({ codigoProveedor: data.codigoProveedor });

  if (!proveedor) {
    proveedor = new MercadoPublicoProveedor({
      codigoProveedor: data.codigoProveedor,
      nombreProveedor: data.nombreProveedor,
      rutProveedor: data.rutProveedor,
      origen: "licitaciones",
      licitaciones: [data.licitacion],
      updatedBy: updatedBy || null,
    });
  } else {
    proveedor.nombreProveedor = data.nombreProveedor || proveedor.nombreProveedor;
    proveedor.rutProveedor = data.rutProveedor || proveedor.rutProveedor;
    proveedor.updatedBy = updatedBy || proveedor.updatedBy;

    const index = proveedor.licitaciones.findIndex((item) => item.codigo === data.licitacion.codigo);
    if (index >= 0) {
      proveedor.licitaciones[index] = data.licitacion;
    } else {
      proveedor.licitaciones.push(data.licitacion);
    }
  }

  await proveedor.save();
  const resumen = resumenProveedorGuardado(proveedor.toObject());
  resumen.descargaJob = await iniciarDescargaOrdenesJob({
    entidadTipo: "proveedor",
    entidadCodigo: resumen.codigoProveedor,
    entidadNombre: resumen.nombreProveedor,
  });
  return resumen;
}

function resumenProveedorGuardado(proveedor) {
  const licitaciones = Array.isArray(proveedor.licitaciones) ? proveedor.licitaciones : [];
  const montoEstimadoTotal = licitaciones.reduce((total, item) => total + cleanNumber(item.montoEstimado), 0);

  return {
    id: proveedor._id,
    codigoProveedor: proveedor.codigoProveedor,
    nombreProveedor: proveedor.nombreProveedor,
    rutProveedor: proveedor.rutProveedor,
    origen: proveedor.origen,
    totalLicitaciones: licitaciones.length,
    montoEstimadoTotal,
    licitaciones,
    updatedAt: proveedor.updatedAt,
  };
}

async function listarProveedoresGuardados() {
  const proveedores = await MercadoPublicoProveedor.find({})
    .sort({ updatedAt: -1 })
    .lean();

  return {
    Cantidad: proveedores.length,
    Listado: proveedores.map(resumenProveedorGuardado),
  };
}

async function obtenerAnaliticaProveedoresGuardados() {
  const proveedores = await MercadoPublicoProveedor.find({}).lean();
  const productos = new Map();
  const compradores = new Map();
  let totalLicitaciones = 0;
  let montoEstimadoTotal = 0;

  proveedores.forEach((proveedor) => {
    (proveedor.licitaciones || []).forEach((licitacion) => {
      const monto = cleanNumber(licitacion.montoEstimado);
      totalLicitaciones += 1;
      montoEstimadoTotal += monto;

      const comprador = licitacion.comprador || {};
      const compradorNombre = comprador.nombreOrganismo || "Sin informacion";
      addToMap(compradores, compradorNombre, monto || 1);

      (licitacion.productos || []).forEach((producto) => {
        const nombreProducto = producto.nombreProducto || producto.categoria || "Sin informacion";
        addToMap(productos, nombreProducto, cleanNumber(producto.cantidad) || 1);
      });
    });
  });

  return {
    totalProveedores: proveedores.length,
    totalLicitaciones,
    montoEstimadoTotal,
    topProductos: topFromMap(productos, 10),
    topCompradores: topFromMap(compradores, 10),
    proveedores: proveedores.map(resumenProveedorGuardado),
  };
}

function normalizeClientePayload(payload = {}) {
  const cliente = payload.cliente || payload.comprador || {};
  const licitacion = payload.licitacion || {};
  const productos = Array.isArray(licitacion.productos) ? licitacion.productos : [];

  const codigoOrganismo = cleanCode(
    cliente.codigoOrganismo || cliente.CodigoOrganismo,
    "codigoOrganismo"
  );
  const nombreOrganismo = cleanText(
    cliente.nombreOrganismo || cliente.NombreOrganismo,
    220
  );
  const codigoLicitacion = cleanCode(
    licitacion.codigo || licitacion.CodigoExterno || licitacion.Codigo,
    "codigoLicitacion"
  );

  if (!codigoOrganismo) {
    const err = new Error("El codigo del organismo comprador es obligatorio");
    err.status = 400;
    throw err;
  }

  if (!nombreOrganismo) {
    const err = new Error("El nombre del organismo comprador es obligatorio");
    err.status = 400;
    throw err;
  }

  if (!codigoLicitacion) {
    const err = new Error("El codigo de licitacion es obligatorio");
    err.status = 400;
    throw err;
  }

  return {
    codigoOrganismo,
    nombreOrganismo,
    rutUnidad: cleanOptionalRut(cliente.rutUnidad || cliente.RutUnidad),
    codigoUnidad: cleanText(cliente.codigoUnidad || cliente.CodigoUnidad, 40),
    nombreUnidad: cleanText(cliente.nombreUnidad || cliente.NombreUnidad, 220),
    region: cleanText(cliente.region || cliente.RegionUnidad, 120),
    comuna: cleanText(cliente.comuna || cliente.ComunaUnidad, 120),
    licitacion: {
      codigo: codigoLicitacion,
      nombre: cleanText(licitacion.nombre || licitacion.Nombre, 500),
      estado: cleanText(licitacion.estado || licitacion.Estado, 80),
      codigoEstado: cleanNumber(licitacion.codigoEstado || licitacion.CodigoEstado) || null,
      tipo: cleanText(licitacion.tipo || licitacion.Tipo, 30),
      moneda: cleanText(licitacion.moneda || licitacion.Moneda, 20),
      montoEstimado: cleanNumber(licitacion.montoEstimado || licitacion.MontoEstimado),
      fechaPublicacion: cleanDateValue(licitacion.fechaPublicacion),
      fechaCierre: cleanDateValue(licitacion.fechaCierre),
      productos: productos.slice(0, 80).map((producto) => ({
        codigoProducto: cleanText(producto.codigoProducto || producto.CodigoProducto, 40),
        nombreProducto: cleanText(producto.nombreProducto || producto.NombreProducto || producto.Producto, 220),
        codigoCategoria: cleanText(producto.codigoCategoria || producto.CodigoCategoria, 40),
        categoria: cleanText(producto.categoria || producto.Categoria, 300),
        cantidad: cleanNumber(producto.cantidad || producto.Cantidad),
        unidadMedida: cleanText(producto.unidadMedida || producto.UnidadMedida || producto.Unidad, 80),
      })),
      guardadoEn: new Date(),
    },
  };
}

async function guardarClienteObservado(payload, updatedBy) {
  const data = normalizeClientePayload(payload);
  let cliente = await MercadoPublicoCliente.findOne({ codigoOrganismo: data.codigoOrganismo });

  if (!cliente) {
    cliente = new MercadoPublicoCliente({
      codigoOrganismo: data.codigoOrganismo,
      nombreOrganismo: data.nombreOrganismo,
      rutUnidad: data.rutUnidad,
      codigoUnidad: data.codigoUnidad,
      nombreUnidad: data.nombreUnidad,
      region: data.region,
      comuna: data.comuna,
      origen: "licitaciones",
      licitaciones: [data.licitacion],
      updatedBy: updatedBy || null,
    });
  } else {
    cliente.nombreOrganismo = data.nombreOrganismo || cliente.nombreOrganismo;
    cliente.rutUnidad = data.rutUnidad || cliente.rutUnidad;
    cliente.codigoUnidad = data.codigoUnidad || cliente.codigoUnidad;
    cliente.nombreUnidad = data.nombreUnidad || cliente.nombreUnidad;
    cliente.region = data.region || cliente.region;
    cliente.comuna = data.comuna || cliente.comuna;
    cliente.updatedBy = updatedBy || cliente.updatedBy;

    const index = cliente.licitaciones.findIndex((item) => item.codigo === data.licitacion.codigo);
    if (index >= 0) {
      cliente.licitaciones[index] = data.licitacion;
    } else {
      cliente.licitaciones.push(data.licitacion);
    }
  }

  await cliente.save();
  const resumen = resumenClienteGuardado(cliente.toObject());
  resumen.descargaJob = await iniciarDescargaOrdenesJob({
    entidadTipo: "cliente",
    entidadCodigo: resumen.codigoOrganismo,
    entidadNombre: resumen.nombreOrganismo,
  });
  return resumen;
}

function resumenClienteGuardado(cliente) {
  const licitaciones = Array.isArray(cliente.licitaciones) ? cliente.licitaciones : [];
  const montoEstimadoTotal = licitaciones.reduce((total, item) => total + cleanNumber(item.montoEstimado), 0);

  return {
    id: cliente._id,
    codigoOrganismo: cliente.codigoOrganismo,
    nombreOrganismo: cliente.nombreOrganismo,
    rutUnidad: cliente.rutUnidad,
    codigoUnidad: cliente.codigoUnidad,
    nombreUnidad: cliente.nombreUnidad,
    region: cliente.region,
    comuna: cliente.comuna,
    origen: cliente.origen,
    totalLicitaciones: licitaciones.length,
    montoEstimadoTotal,
    licitaciones,
    updatedAt: cliente.updatedAt,
  };
}

async function listarClientesGuardados() {
  const clientes = await MercadoPublicoCliente.find({})
    .sort({ updatedAt: -1 })
    .lean();

  return {
    Cantidad: clientes.length,
    Listado: clientes.map(resumenClienteGuardado),
  };
}

function selectedCodesFromQuery(value) {
  if (!value) return null;
  const codes = String(value)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  return codes.length ? new Set(codes) : null;
}

function selectedCodesArray(value, label) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((code) => cleanCode(code.trim(), label))
    .filter(Boolean);
}

function cleanLimit(value) {
  const limit = Number(value || 100);
  const allowed = new Set([50, 100, 250, 500, 1000]);
  return allowed.has(limit) ? limit : 100;
}

function cleanPeriodoAnalisis(value) {
  const clean = String(value || "mes_actual").trim().toLowerCase();
  const allowed = new Set(["mes_actual", "ultimos_3_meses", "ultimos_6_meses", "ultimo_ano"]);
  return allowed.has(clean) ? clean : "mes_actual";
}

function rangoPeriodoAnalisis(value) {
  const periodo = cleanPeriodoAnalisis(value);
  const now = new Date();
  const desde = new Date(now);

  if (periodo === "mes_actual") {
    desde.setDate(1);
  } else if (periodo === "ultimos_3_meses") {
    desde.setMonth(desde.getMonth() - 3);
  } else if (periodo === "ultimos_6_meses") {
    desde.setMonth(desde.getMonth() - 6);
  } else {
    desde.setFullYear(desde.getFullYear() - 1);
  }

  desde.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);

  const labels = {
    mes_actual: "Mes actual",
    ultimos_3_meses: "Ultimos 3 meses",
    ultimos_6_meses: "Ultimos 6 meses",
    ultimo_ano: "Ultimo ano",
  };

  return {
    periodo,
    label: labels[periodo],
    fechaDesde: desde,
    fechaHasta: now,
  };
}

function lastYearApiDates() {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 364);
  return datesBetween(
    `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  );
}

function lastYearApiDatesDescending(fromDate) {
  const today = new Date();
  const cutoff = new Date();
  cutoff.setDate(today.getDate() - 364);
  const start = fromDate ? new Date(fromDate) : today;
  if (Number.isNaN(start.getTime()) || start > today) start.setTime(today.getTime());

  const fechas = [];
  const cursor = new Date(start);
  while (cursor >= cutoff) {
    fechas.push(formatApiDate(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return fechas;
}

async function fechaContinuacionCache(entidadTipo, entidadCodigo) {
  const oldest = await MercadoPublicoOrdenCache.findOne({
    origenes: {
      $elemMatch: {
        tipo: entidadTipo,
        codigo: entidadCodigo,
      },
    },
    fecha: { $ne: null },
  })
    .sort({ fecha: 1 })
    .lean();

  if (!oldest?.fecha) return null;

  const next = new Date(oldest.fecha);
  next.setDate(next.getDate() - 1);
  return next;
}

async function listarOrdenesPorEntidadUltimoAno(paramsPorDia, maxOrdenes, progress, cursorDate, cancelJobId, onOrdenesEncontradas) {
  const ticket = await getTicket();
  const fechas = lastYearApiDatesDescending(cursorDate);
  const byCode = new Map();

  for (const fecha of fechas) {
    if (cancelJobId && await isJobCancelled(cancelJobId)) break;

    try {
      if (cancelJobId) await appendJobLog(cancelJobId, `Consultando OC fecha ${fecha}`);
      const data = await requestChileCompra(`${PUBLIC_URL}/ordenesdecompra.json`, {
        fecha,
        estado: "todos",
        ticket,
        ...paramsPorDia,
      });

      const listado = getListado(data);
      if (cancelJobId) await appendJobLog(cancelJobId, `Fecha ${fecha}: ${listado.length} OC recibidas`);

      const nuevas = [];
      listado.forEach((orden) => {
        const code = orden.Codigo || orden.CodigoOC;
        if (code && byCode.size < maxOrdenes && !byCode.has(code)) {
          byCode.set(code, orden);
          nuevas.push(orden);
        }
      });

      if (progress) {
        progress.consultasProcesadas += 1;
        progress.ocEncontradas = Math.max(progress.ocEncontradas, byCode.size);
      }

      if (nuevas.length && onOrdenesEncontradas) {
        if (cancelJobId) await appendJobLog(cancelJobId, `Fecha ${fecha}: pausando busqueda para procesar ${nuevas.length} OC`);
        await onOrdenesEncontradas(nuevas, fecha);
        if (cancelJobId) await appendJobLog(cancelJobId, `Fecha ${fecha}: procesamiento terminado, continua busqueda`);
      }

      if (byCode.size >= maxOrdenes) break;
    } catch (err) {
      if (progress) progress.consultasOmitidas += 1;
      if (cancelJobId) await appendJobLog(cancelJobId, `Fecha ${fecha} omitida: ${err.message}`);
      if (err.status === 429) continue;
    }
  }

  return Array.from(byCode.values());
}

async function listarOrdenesProveedorUltimoAno(codigoProveedor, maxOrdenes, progress, cursorDate, cancelJobId) {
  return listarOrdenesPorEntidadUltimoAno({ CodigoProveedor: codigoProveedor }, maxOrdenes, progress, cursorDate, cancelJobId);
}

async function listarOrdenesClienteUltimoAno(codigoOrganismo, maxOrdenes, progress, cursorDate, cancelJobId) {
  return listarOrdenesPorEntidadUltimoAno({ CodigoOrganismo: codigoOrganismo }, maxOrdenes, progress, cursorDate, cancelJobId);
}

async function obtenerDetalleOrdenSeguro(codigo) {
  try {
    const data = await obtenerOrden(codigo);
    return getListado(data)[0] || data;
  } catch (err) {
    return { Codigo: codigo, errorDetalle: err.message };
  }
}

function fechaOrdenDetalle(orden) {
  const raw = orden?.Fechas?.FechaEnvio || orden?.Fechas?.FechaCreacion || orden?.FechaEnvio || orden?.FechaCreacion;
  if (!raw) return "Sin informacion";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(raw);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function resumenOrdenAnalitica(orden) {
  const total = cleanNumber(orden.Total || orden.TotalNeto || orden.MontoTotal);
  const comprador = orden.Comprador || {};
  const proveedor = orden.Proveedor || {};

  return {
    codigo: orden.Codigo || orden.CodigoOC || "",
    nombre: orden.Nombre || "",
    estado: estadoOrdenTexto(orden),
    fecha: fechaOrdenDetalle(orden),
    total,
    comprador: {
      codigoOrganismo: comprador.CodigoOrganismo || "",
      nombreOrganismo: comprador.NombreOrganismo || "Sin informacion",
      region: comprador.RegionUnidad || "",
      comuna: comprador.ComunaUnidad || "",
    },
    proveedor: {
      codigo: proveedor.Codigo || "",
      nombre: proveedor.Nombre || "Sin informacion",
      rut: proveedor.RutSucursal || "",
    },
    items: Array.isArray(orden?.Items?.Listado) ? orden.Items.Listado : [],
    errorDetalle: orden.errorDetalle || null,
  };
}

function publicPersistentJob(job) {
  return {
    id: String(job._id),
    tipo: job.tipo,
    status: job.status,
    entidadTipo: job.entidadTipo,
    entidadCodigo: job.entidadCodigo,
    entidadNombre: job.entidadNombre,
    progress: job.progress,
    logs: (job.logs || []).slice(-60),
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function appendJobLog(jobId, message) {
  const log = {
    at: new Date(),
    message: String(message || "").slice(0, 500),
  };
  console.log(`[MercadoPublicoJob ${jobId}] ${log.message}`);
  await MercadoPublicoJob.findByIdAndUpdate(jobId, {
    $push: {
      logs: {
        $each: [log],
        $slice: -60,
      },
    },
  });
}

function ordenCacheFromRaw(raw, origen) {
  const resumen = resumenOrdenAnalitica(raw);
  return {
    codigo: resumen.codigo,
    proveedorCodigo: resumen.proveedor.codigo || "",
    proveedorNombre: resumen.proveedor.nombre || "",
    compradorCodigo: resumen.comprador.codigoOrganismo || "",
    compradorNombre: resumen.comprador.nombreOrganismo || "",
    fecha: cleanDateValue(
      raw?.Fechas?.FechaEnvio ||
      raw?.Fechas?.FechaCreacion ||
      raw?.FechaEnvio ||
      raw?.FechaCreacion ||
      raw?.Fecha
    ),
    estado: resumen.estado,
    total: resumen.total,
    origenes: [origen],
    raw,
    downloadedAt: new Date(),
  };
}

async function guardarOrdenCache(raw, origen) {
  const data = ordenCacheFromRaw(raw, origen);
  if (!data.codigo) {
    return {
      ok: false,
      reason: "El detalle recibido no trae Codigo/CodigoOC",
    };
  }

  const current = await MercadoPublicoOrdenCache.findOne({ codigo: data.codigo }).lean();
  const origenes = current?.origenes || [];
  const exists = origenes.some((item) => item.tipo === origen.tipo && item.codigo === origen.codigo);
  if (!exists) origenes.push(origen);

  const saved = await MercadoPublicoOrdenCache.findOneAndUpdate(
    { codigo: data.codigo },
    {
      $set: {
        ...data,
        origenes,
      },
    },
    { upsert: true, new: true }
  ).lean();

  return {
    ok: Boolean(saved),
    codigo: saved?.codigo || data.codigo,
    proveedorNombre: saved?.proveedorNombre || data.proveedorNombre,
    compradorNombre: saved?.compradorNombre || data.compradorNombre,
    total: saved?.total || data.total,
    fecha: saved?.fecha || data.fecha,
    origenes: saved?.origenes || origenes,
  };
}

async function isJobCancelled(jobId) {
  const job = await MercadoPublicoJob.findById(jobId).select("status").lean();
  return !job || job.status === "cancelled";
}

async function updatePersistentJob(jobId, patch) {
  await MercadoPublicoJob.findByIdAndUpdate(jobId, {
    $set: {
      ...patch,
    },
  });
}

async function crearProcesamientoOrdenJob({ codigo, origen, parentJobId }) {
  const existing = await MercadoPublicoJob.findOne({
    tipo: "procesar_oc",
    entidadCodigo: codigo,
    status: { $in: ["queued", "running"] },
  }).lean();

  if (existing) return existing;

  const job = await MercadoPublicoJob.create({
    tipo: "procesar_oc",
    status: "queued",
    entidadTipo: "analisis",
    entidadCodigo: codigo,
    entidadNombre: codigo,
    params: {
      codigo,
      origen,
      parentJobId,
    },
    progress: {
      porcentaje: 0,
      totalObjetivo: 1,
      consultasProcesadas: 0,
      consultasOmitidas: 0,
      ocEncontradas: 1,
      ocProcesadas: 0,
      ocOmitidas: 0,
    },
  });

  if (parentJobId) await appendJobLog(parentJobId, `OC ${codigo}: job de procesamiento creado`);
  enqueueProcesamientoOrdenJob(String(job._id));
  return job.toObject();
}

function enqueueProcesamientoOrdenJob(jobId) {
  if (!ocProcessingQueue.includes(jobId)) ocProcessingQueue.push(jobId);
  runProcesamientoOrdenQueue().catch(() => {});
}

async function runProcesamientoOrdenQueue() {
  while (ocProcessingActiveCount < OC_PROCESSING_WORKERS && ocProcessingQueue.length) {
    const jobId = ocProcessingQueue.shift();
    ocProcessingActiveCount += 1;

    ejecutarProcesamientoOrdenJob(jobId)
      .catch(() => {})
      .finally(() => {
        ocProcessingActiveCount -= 1;
        runProcesamientoOrdenQueue().catch(() => {});
      });
  }
}

async function ejecutarProcesamientoOrdenJob(jobId) {
  const job = await MercadoPublicoJob.findById(jobId);
  if (!job || job.status === "cancelled" || job.status === "complete") return;

  const parentJobId = job.params?.parentJobId;
  if (parentJobId && await isJobCancelled(parentJobId)) {
    job.status = "cancelled";
    await job.save();
    return;
  }

  job.status = "running";
  await job.save();
  await appendJobLog(jobId, `Worker OC procesando detalle ${job.params?.codigo || job.entidadCodigo}`);

  try {
    const codigo = job.params?.codigo || job.entidadCodigo;
    const detalle = await obtenerDetalleOrdenSeguro(codigo);

    if (detalle.errorDetalle) {
      job.progress.ocOmitidas = 1;
      await appendJobLog(jobId, `OC ${codigo} omitida: ${detalle.errorDetalle}`);
    } else {
      const saved = await guardarOrdenCache(detalle, job.params?.origen || {
        tipo: "proveedor",
        codigo: "",
        nombre: "",
      });
      if (saved.ok) {
        job.progress.ocProcesadas = 1;
        await appendJobLog(jobId, `OC ${codigo} guardada en cache MongoDB (${saved.proveedorNombre || "sin proveedor"} / ${saved.compradorNombre || "sin comprador"})`);
      } else {
        job.progress.ocOmitidas = 1;
        await appendJobLog(jobId, `OC ${codigo} no fue guardada: ${saved.reason || "datos insuficientes"}`);
      }
    }

    job.progress.consultasProcesadas = 1;
    job.progress.porcentaje = 100;
    job.status = "complete";
    job.result = {
      codigo,
      ocProcesadas: job.progress.ocProcesadas,
      ocOmitidas: job.progress.ocOmitidas,
    };
    await job.save();
  } catch (err) {
    job.status = "error";
    job.error = err.message || "No fue posible procesar OC";
    job.progress.consultasOmitidas += 1;
    await job.save();
  }
}

async function iniciarDescargaOrdenesJob({ entidadTipo, entidadCodigo, entidadNombre }) {
  const existing = await MercadoPublicoJob.findOne({
    tipo: "descarga_oc",
    entidadTipo,
    entidadCodigo,
    status: { $in: ["queued", "running"] },
  }).lean();

  if (existing) return publicPersistentJob(existing);

  const job = await MercadoPublicoJob.create({
    tipo: "descarga_oc",
    status: "queued",
    entidadTipo,
    entidadCodigo,
    entidadNombre,
    params: {
      rango: "ultimo_ano",
      maxOrdenes: OC_DOWNLOAD_MAX_PER_ENTITY,
    },
    progress: {
      porcentaje: 0,
      totalObjetivo: OC_DOWNLOAD_MAX_PER_ENTITY,
      consultasProcesadas: 0,
      consultasOmitidas: 0,
      ocEncontradas: 0,
      ocProcesadas: 0,
      ocOmitidas: 0,
    },
  });

  await appendJobLog(String(job._id), `Job creado para ${entidadTipo} ${entidadCodigo} - ${entidadNombre}`);
  enqueueDescargaOrdenesJob(String(job._id));
  return publicPersistentJob(job);
}

function enqueueDescargaOrdenesJob(jobId) {
  if (!downloadJobQueue.includes(jobId)) downloadJobQueue.push(jobId);
  appendJobLog(jobId, `Job agregado a cola principal. Pendientes en cola: ${downloadJobQueue.length}`).catch(() => {});
  runDescargaOrdenesQueue().catch(() => {});
}

async function runDescargaOrdenesQueue() {
  if (downloadJobActive) return;
  downloadJobActive = true;

  try {
    while (downloadJobQueue.length) {
      const jobId = downloadJobQueue.shift();
      await ejecutarDescargaOrdenesJob(jobId);
    }
  } finally {
    downloadJobActive = false;
  }
}

async function ejecutarDescargaOrdenesJob(jobId) {
  const job = await MercadoPublicoJob.findById(jobId);
  if (!job || ["complete", "cancelled", "error"].includes(job.status)) return;

  job.status = "running";
  await job.save();
  await appendJobLog(jobId, `Worker principal inicio descarga ${job.entidadTipo} ${job.entidadCodigo} - ${job.entidadNombre}`);

  const progress = job.progress;
  const params = job.entidadTipo === "cliente"
    ? { CodigoOrganismo: job.entidadCodigo }
    : { CodigoProveedor: job.entidadCodigo };

  try {
    const cursorDate = await fechaContinuacionCache(job.entidadTipo, job.entidadCodigo);
    await appendJobLog(jobId, cursorDate
      ? `Continuando desde ${cursorDate.toISOString().slice(0, 10)} hacia atras`
      : "Sin cache previo: comenzando desde la OC mas nueva hacia atras");
    const procesarOrdenesDeFecha = async (ordenesFecha, fecha) => {
      const codigosFecha = ordenesFecha
        .map((orden) => orden.Codigo || orden.CodigoOC)
        .filter(Boolean);

      for (const codigo of codigosFecha) {
        if (await isJobCancelled(jobId)) {
          await updatePersistentJob(jobId, { status: "cancelled", progress });
          return;
        }

        await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: descargando detalle antes de seguir buscando`);
        const detalle = await obtenerDetalleOrdenSeguro(codigo);
        await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: respuesta de detalle recibida`);
        const resumenDetalle = resumenOrdenAnalitica(detalle);
        await appendJobLog(
          jobId,
          `Fecha ${fecha} / OC ${codigo}: detalle normalizado codigo=${resumenDetalle.codigo || "sin codigo"}, proveedor=${resumenDetalle.proveedor.nombre || "sin proveedor"}, cliente=${resumenDetalle.comprador.nombreOrganismo || "sin cliente"}`
        );

        if (detalle.errorDetalle) {
          progress.ocOmitidas += 1;
          await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: omitida (${detalle.errorDetalle})`);
        } else {
          const saved = await guardarOrdenCache(detalle, {
            tipo: job.entidadTipo,
            codigo: job.entidadCodigo,
            nombre: job.entidadNombre,
          });

          if (saved.ok) {
            progress.ocProcesadas += 1;
            await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: cache MongoDB OK (${saved.proveedorNombre || "sin proveedor"} / ${saved.compradorNombre || "sin comprador"} / total ${saved.total || 0}). Total procesadas: ${progress.ocProcesadas}`);
          } else {
            progress.ocOmitidas += 1;
            await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: omitida (${saved.reason || "datos insuficientes"})`);
          }
        }

        progress.totalObjetivo = Math.max(progress.totalObjetivo || 0, progress.ocEncontradas || 0);
        progress.porcentaje = Math.min(100, Math.round(((progress.ocProcesadas + progress.ocOmitidas) / Math.max(1, progress.totalObjetivo)) * 100));
        await updatePersistentJob(jobId, { progress });
        await appendJobLog(jobId, `Fecha ${fecha} / OC ${codigo}: progreso ${progress.porcentaje}% (${progress.ocProcesadas} procesadas, ${progress.ocOmitidas} omitidas)`);
      }
    };

    const ordenesBase = await listarOrdenesPorEntidadUltimoAno(
      params,
      OC_DOWNLOAD_MAX_PER_ENTITY,
      progress,
      cursorDate,
      jobId,
      procesarOrdenesDeFecha
    );
    if (await isJobCancelled(jobId)) {
      await updatePersistentJob(jobId, { status: "cancelled", progress });
      return;
    }
    await updatePersistentJob(jobId, { progress });

    const codigos = ordenesBase
      .map((orden) => orden.Codigo || orden.CodigoOC)
      .filter(Boolean)
      .slice(0, OC_DOWNLOAD_MAX_PER_ENTITY);

    progress.totalObjetivo = codigos.length || OC_DOWNLOAD_MAX_PER_ENTITY;
    progress.ocEncontradas = codigos.length;
    await updatePersistentJob(jobId, { progress });
    await appendJobLog(jobId, `${codigos.length} OC encontradas en total. Todas las OC encontradas fueron procesadas durante la busqueda por fecha.`);

    await updatePersistentJob(jobId, {
      status: "complete",
      progress: { ...progress, porcentaje: 100 },
      result: {
        ocEncontradas: progress.ocEncontradas,
        ocProcesadas: progress.ocProcesadas,
        ocOmitidas: progress.ocOmitidas,
      },
    });
    await appendJobLog(jobId, "Descarga finalizada. OC procesadas y cacheadas en el mismo job.");
  } catch (err) {
    await updatePersistentJob(jobId, {
      status: "error",
      error: err.message || "No fue posible descargar OC",
      progress,
    });
    await appendJobLog(jobId, `Error descarga: ${err.message || "sin detalle"}`);
  }
}

async function listarDescargaOrdenesJobs() {
  const jobs = await MercadoPublicoJob.find({ tipo: "descarga_oc" })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  return {
    Cantidad: jobs.length,
    Listado: jobs.map(publicPersistentJob),
  };
}

async function cancelarJob(id) {
  const job = await MercadoPublicoJob.findByIdAndUpdate(
    id,
    {
      $set: {
        status: "cancelled",
        error: "Cancelado por usuario",
      },
    },
    { new: true }
  ).lean();

  if (!job) {
    const err = new Error("Job no encontrado");
    err.status = 404;
    throw err;
  }

  return publicPersistentJob(job);
}

async function sincronizarEntidadesGuardadas() {
  const proveedores = await MercadoPublicoProveedor.find({}).lean();
  const clientes = await MercadoPublicoCliente.find({}).lean();
  const jobs = [];
  console.log(`[MercadoPublicoJob] Sincronizando ${proveedores.length} proveedores y ${clientes.length} clientes guardados`);

  for (const proveedor of proveedores) {
    const job = await iniciarDescargaOrdenesJob({
      entidadTipo: "proveedor",
      entidadCodigo: proveedor.codigoProveedor,
      entidadNombre: proveedor.nombreProveedor,
    });
    await appendJobLog(job.id, "Sincronizacion masiva: proveedor incluido");
    jobs.push(job);
  }

  for (const cliente of clientes) {
    const job = await iniciarDescargaOrdenesJob({
      entidadTipo: "cliente",
      entidadCodigo: cliente.codigoOrganismo,
      entidadNombre: cliente.nombreOrganismo,
    });
    await appendJobLog(job.id, "Sincronizacion masiva: cliente incluido");
    jobs.push(job);
  }

  return {
    Cantidad: jobs.length,
    Listado: jobs,
  };
}

async function listarOrdenesCacheResumen() {
  const total = await MercadoPublicoOrdenCache.countDocuments({});
  const latest = await MercadoPublicoOrdenCache.findOne({ fecha: { $ne: null } })
    .sort({ fecha: -1 })
    .lean();
  const oldest = await MercadoPublicoOrdenCache.findOne({ fecha: { $ne: null } })
    .sort({ fecha: 1 })
    .lean();
  const latestDownload = await MercadoPublicoOrdenCache.findOne({})
    .sort({ downloadedAt: -1, updatedAt: -1 })
    .select("downloadedAt updatedAt codigo")
    .lean();
  const ordenes = await MercadoPublicoOrdenCache.find({})
    .sort({ downloadedAt: -1, updatedAt: -1 })
    .limit(100)
    .select("codigo proveedorNombre compradorNombre fecha estado total origenes downloadedAt updatedAt")
    .lean();

  return {
    total,
    ultimaFecha: latest?.fecha || null,
    primeraFecha: oldest?.fecha || null,
    ultimaDescarga: latestDownload?.downloadedAt || latestDownload?.updatedAt || null,
    ultimaDescargaCodigo: latestDownload?.codigo || null,
    Cantidad: ordenes.length,
    Listado: ordenes.map((orden) => ({
      codigo: orden.codigo,
      proveedorNombre: orden.proveedorNombre,
      compradorNombre: orden.compradorNombre,
      fecha: orden.fecha,
      estado: orden.estado,
      total: orden.total,
      origenes: orden.origenes,
      downloadedAt: orden.downloadedAt,
      updatedAt: orden.updatedAt,
    })),
  };
}

async function reanudarJobsPendientes() {
  try {
    const pendientes = await MercadoPublicoJob.find({
      tipo: "descarga_oc",
      status: { $in: ["queued", "running"] },
    })
      .sort({ createdAt: 1 })
      .lean();

    pendientes.forEach((job) => {
      enqueueDescargaOrdenesJob(String(job._id));
    });

    if (pendientes.length) {
      console.log(`[MercadoPublicoJob] ${pendientes.length} jobs pendientes reanudados`);
    }
  } catch (err) {
    console.error("[MercadoPublicoJob] No fue posible reanudar jobs pendientes:", err.message);
  }
}

async function listarAnalisisGuardados() {
  const analisis = await MercadoPublicoAnalisis.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return {
    Cantidad: analisis.length,
    Listado: analisis.map((item) => ({
      id: item._id,
      modoAnalisis: item.modoAnalisis,
      filtros: item.filtros,
      resumen: item.resumen,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

async function obtenerReportesOrdenesSeleccionadas(query = {}, progress) {
  const modoAnalisis = query.modoAnalisis === "clientes" ? "clientes" : "proveedores";
  const proveedoresSeleccionados = selectedCodesArray(query.proveedoresObservados || query.codigoProveedoresObservados, "codigoProveedor");
  const clientesSeleccionados = selectedCodesFromQuery(query.clientesObservados || query.codigoClientesObservados);
  const periodoAnalisis = rangoPeriodoAnalisis(query.periodoAnalisis);

  const proveedoresGuardados = await obtenerAnaliticaProveedoresGuardados();
  const clientesGuardados = await obtenerAnaliticaClientesGuardados(query);

  if (modoAnalisis === "proveedores" && !proveedoresSeleccionados.length) {
    return {
      modo: "seleccion_observados",
      resumen: {
        totalOrdenes: 0,
        montoTotal: 0,
        promedioOrden: 0,
      },
      topProductosComprados: [],
      topClientesCompradores: [],
      topProveedores: [],
      porEstado: [],
      porFecha: [],
      ordenes: [],
      proveedoresGuardados,
      clientesGuardados,
      fuente: "Direccion ChileCompra - API Mercado Publico",
      message: "Selecciona al menos un proveedor observado para generar analitica de OC.",
    };
  }

  if (modoAnalisis === "clientes" && (!clientesSeleccionados || !clientesSeleccionados.size)) {
    return {
      modo: "seleccion_observados",
      resumen: {
        totalOrdenes: 0,
        montoTotal: 0,
        promedioOrden: 0,
      },
      topProductosComprados: [],
      topClientesCompradores: [],
      topProveedores: [],
      porEstado: [],
      porFecha: [],
      ordenes: [],
      proveedoresGuardados,
      clientesGuardados,
      fuente: "Direccion ChileCompra - API Mercado Publico",
      message: "Selecciona al menos un cliente observado para generar analitica de OC.",
    };
  }

  const filter = modoAnalisis === "clientes"
    ? { compradorCodigo: { $in: Array.from(clientesSeleccionados) } }
    : { proveedorCodigo: { $in: proveedoresSeleccionados } };

  if (modoAnalisis === "proveedores" && clientesSeleccionados) {
    filter.compradorCodigo = { $in: Array.from(clientesSeleccionados) };
  }

  filter.fecha = {
    $gte: periodoAnalisis.fechaDesde,
    $lte: periodoAnalisis.fechaHasta,
  };

  const cached = await MercadoPublicoOrdenCache.find(filter)
    .sort({ fecha: -1, updatedAt: -1 })
    .lean();
  const cachedAnalizables = cached.filter((item) => esOrdenAnalizable(item.raw));

  if (progress) {
    progress.totalObjetivo = cachedAnalizables.length;
    progress.ocEncontradas = cached.length;
    progress.ocProcesadas = cachedAnalizables.length;
    progress.ocOmitidas = cached.length - cachedAnalizables.length;
    progress.porcentaje = 100;
  }

  const ordenes = cachedAnalizables.map((item) => resumenOrdenAnalitica(item.raw));

  const productos = new Map();
  const clientes = new Map();
  const proveedores = new Map();
  const estados = new Map();
  const fechas = new Map();
  let montoTotal = 0;

  ordenes.forEach((orden) => {
    montoTotal += orden.total;
    addToMap(clientes, orden.comprador.nombreOrganismo, orden.total || 1);
    addToMap(proveedores, orden.proveedor.nombre, orden.total || 1);
    addToMap(estados, orden.estado, orden.total || 1);
    addToMap(fechas, orden.fecha, orden.total || 1);

    orden.items.forEach((item) => {
      const nombre = item.Producto || item.NombreProducto || item.Categoria || "Sin informacion";
      const cantidad = cleanNumber(item.Cantidad) || 1;
      const montoItem = cleanNumber(item.Total) || cleanNumber(item.PrecioNeto) * cantidad || cantidad;
      const current = productos.get(nombre) || { nombre, cantidad: 0, monto: 0 };
      current.cantidad += cantidad;
      current.monto += montoItem;
      productos.set(nombre, current);
    });
  });

  const result = {
    modo: "seleccion_observados",
    filtros: {
      modoAnalisis,
      fuente: "oc_cache",
      periodoAnalisis: periodoAnalisis.periodo,
      periodoLabel: periodoAnalisis.label,
      fechaDesde: periodoAnalisis.fechaDesde,
      fechaHasta: periodoAnalisis.fechaHasta,
      estadosIncluidos: ["En proceso", "Aceptada", "Recepcion conforme", "Pendiente recepcion"],
      proveedoresObservados: proveedoresSeleccionados,
      clientesObservados: clientesSeleccionados ? Array.from(clientesSeleccionados) : [],
    },
    resumen: {
      totalOrdenes: ordenes.length,
      montoTotal,
      promedioOrden: ordenes.length ? Math.round(montoTotal / ordenes.length) : 0,
    },
    topProductosComprados: topFromMap(productos, 12),
    topClientesCompradores: topFromMap(clientes, 12),
    topProveedores: topFromMap(proveedores, 12),
    porEstado: topFromMap(estados, 12),
    porFecha: topFromMap(fechas, 12),
    ordenes,
    proveedoresGuardados,
    clientesGuardados,
    fuente: "Direccion ChileCompra - API Mercado Publico",
  };

  return result;
}

async function guardarAnalisisGenerado(payload = {}, solicitadoPor) {
  const resultado = payload.resultado || payload;
  const modoAnalisis = resultado?.filtros?.modoAnalisis === "clientes" ? "clientes" : "proveedores";

  if (!resultado?.resumen || !resultado?.filtros) {
    const err = new Error("No hay un analisis valido para guardar");
    err.status = 400;
    throw err;
  }

  const saved = await MercadoPublicoAnalisis.create({
    modoAnalisis,
    filtros: resultado.filtros,
    resumen: resultado.resumen,
    resultado,
    solicitadoPor: solicitadoPor || payload.solicitadoPor || null,
  });

  return {
    ok: true,
    message: "Analisis guardado correctamente.",
    id: saved._id,
    createdAt: saved.createdAt,
  };
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    error: job.error || null,
    progress: job.progress,
    result: job.status === "complete" ? job.result : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function iniciarReporteJob(query = {}) {
  const id = randomUUID();
  const job = {
    id,
    status: "running",
    progress: {
      porcentaje: 0,
      totalObjetivo: 0,
      consultasProcesadas: 0,
      consultasOmitidas: 0,
      ocEncontradas: 0,
      ocProcesadas: 0,
      ocOmitidas: 0,
    },
    result: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  reportJobs.set(id, job);

  obtenerReportesOrdenesSeleccionadas(query, job.progress)
    .then((result) => {
      job.status = "complete";
      job.result = result;
      job.progress.porcentaje = 100;
      job.updatedAt = new Date();
    })
    .catch((err) => {
      job.status = "error";
      job.error = err.message || "No fue posible generar analitica";
      job.updatedAt = new Date();
    });

  return publicJob(job);
}

function obtenerReporteJob(id) {
  const job = reportJobs.get(id);
  if (!job) {
    const err = new Error("Trabajo de analitica no encontrado");
    err.status = 404;
    throw err;
  }
  return publicJob(job);
}

async function obtenerAnaliticaClientesGuardados(query = {}) {
  const selected = selectedCodesFromQuery(query.clientesObservados || query.codigoClientesObservados);
  const filter = selected ? { codigoOrganismo: { $in: Array.from(selected) } } : {};
  const clientes = await MercadoPublicoCliente.find(filter).lean();
  const productos = new Map();
  const regiones = new Map();
  const estados = new Map();
  let totalLicitaciones = 0;
  let montoEstimadoTotal = 0;

  clientes.forEach((cliente) => {
    (cliente.licitaciones || []).forEach((licitacion) => {
      const monto = cleanNumber(licitacion.montoEstimado);
      totalLicitaciones += 1;
      montoEstimadoTotal += monto;
      addToMap(regiones, cliente.region || "Sin informacion", monto || 1);
      addToMap(estados, licitacion.estado || "Sin informacion", monto || 1);

      (licitacion.productos || []).forEach((producto) => {
        const nombreProducto = producto.nombreProducto || producto.categoria || "Sin informacion";
        addToMap(productos, nombreProducto, cleanNumber(producto.cantidad) || 1);
      });
    });
  });

  return {
    totalClientes: clientes.length,
    totalLicitaciones,
    montoEstimadoTotal,
    topProductos: topFromMap(productos, 10),
    topRegiones: topFromMap(regiones, 10),
    porEstado: topFromMap(estados, 12),
    clientes: clientes.map(resumenClienteGuardado),
    filtroAplicado: selected ? Array.from(selected) : [],
  };
}

async function requestOrdenesPorFechas(query) {
  const fechas = datesBetween(query.fechaDesde, query.fechaHasta);
  if (!fechas) return null;

  const ticket = await getTicket();
  const estado = cleanEstado(query.estado, ORDEN_ESTADOS, "estado");
  const codigoOrganismo = cleanCode(query.CodigoOrganismo || query.codigoOrganismo, "CodigoOrganismo");
  const codigoProveedor = cleanCode(query.CodigoProveedor || query.codigoProveedor, "CodigoProveedor");

  const results = await Promise.allSettled(
    fechas.map((fecha) => {
      const params = { fecha, ticket };
      if (estado) params.estado = estado;
      if (codigoOrganismo) params.CodigoOrganismo = codigoOrganismo;
      if (codigoProveedor) params.CodigoProveedor = codigoProveedor;
      return requestChileCompra(`${PUBLIC_URL}/ordenesdecompra.json`, params);
    })
  );

  const fulfilled = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (!fulfilled.length) {
    const firstError = results.find((result) => result.status === "rejected")?.reason;
    throw firstError || new Error("No fue posible obtener ordenes para el rango de fechas");
  }

  const byCode = new Map();
  fulfilled.flatMap(getListado).forEach((item) => {
    const code = item.Codigo || item.CodigoOC || JSON.stringify(item);
    byCode.set(code, item);
  });

  return {
    Cantidad: byCode.size,
    Listado: Array.from(byCode.values()),
    filtrosAplicados: {
      rango: "fecha_desde_hasta",
      fechas,
      estado: estado || null,
      codigoOrganismo: codigoOrganismo || null,
      codigoProveedor: codigoProveedor || null,
    },
  };
}

async function obtenerEstadoConfiguracion() {
  const config = await MercadoPublicoConfig.findOne({ key: "default" }).lean();
  const envTicket = process.env.MERCADO_PUBLICO_TICKET || "";
  const ticket = config?.ticket || envTicket;

  return {
    ticketConfigurado: Boolean(ticket),
    ticketLargo: ticket.length,
    ticketEnmascarado: maskTicket(ticket),
    ticketFuente: config?.ticket ? "mongodb" : envTicket ? "env" : "sin_configurar",
    actualizadoEn: config?.updatedAt || null,
    actualizadoPor: config?.updatedBy || null,
    baseUrl: PUBLIC_URL,
    empresasUrl: EMPRESAS_URL,
    nota: "El ticket no se expone por seguridad.",
  };
}

async function guardarTicket(ticket, updatedBy) {
  const clean = String(ticket || "").trim();

  if (!clean) {
    const err = new Error("El ticket de Mercado Publico es obligatorio");
    err.status = 400;
    throw err;
  }

  if (!/^[A-Za-z0-9_.:-]{6,180}$/.test(clean)) {
    const err = new Error("El ticket tiene un formato invalido");
    err.status = 400;
    throw err;
  }

  try {
    const config = await MercadoPublicoConfig.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          ticket: clean,
          updatedBy: updatedBy || null,
        },
        $setOnInsert: {
          key: "default",
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return {
      ticketConfigurado: true,
      ticketLargo: config.ticket.length,
      ticketEnmascarado: maskTicket(config.ticket),
      ticketFuente: "mongodb",
      actualizadoEn: config.updatedAt,
      actualizadoPor: config.updatedBy,
    };
  } catch (err) {
    const dbError = new Error(`No se pudo guardar el ticket en MongoDB: ${err.message}`);
    dbError.status = 500;
    throw dbError;
  }
}

function pickNumber(value) {
  const number = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function firstText(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item[key] !== null && String(item[key]).trim()) {
      return String(item[key]).trim();
    }
  }
  return "Sin informacion";
}

function addToMap(map, key, amount) {
  const current = map.get(key) || { nombre: key, cantidad: 0, monto: 0 };
  current.cantidad += 1;
  current.monto += amount;
  map.set(key, current);
}

function estadoOrdenTexto(item) {
  const estado = firstText(item, ["Estado", "EstadoOrdenCompra", "estado"]);
  if (estado !== "Sin informacion") return estado;

  const codigoEstado = Number(item?.CodigoEstado || 0);
  const estados = {
    4: "Enviada a proveedor",
    5: "En proceso",
    6: "Aceptada",
    9: "Cancelada",
    12: "Recepcion conforme",
    13: "Pendiente recepcion",
    14: "Recepcionada parcialmente",
    15: "Recepcion conforme incompleta",
  };

  return estados[codigoEstado] || `Estado ${codigoEstado || "Sin informacion"}`;
}

function esOrdenAnalizable(item = {}) {
  const codigoEstado = Number(item?.CodigoEstado || item?.codigoEstado || 0);
  const estadosPermitidos = new Set([5, 6, 12, 13]);
  if (estadosPermitidos.has(codigoEstado)) return true;

  const estado = estadoOrdenTexto(item)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (estado.includes("cancelada")) return false;
  return (
    estado.includes("en proceso") ||
    estado.includes("aceptada") ||
    estado.includes("recepcion conforme") ||
    estado.includes("pendiente recepcion")
  );
}

function fechaOrdenTexto(item) {
  const raw = firstText(item, ["FechaEnvio", "FechaCreacion", "Fecha", "fecha"]);
  if (raw === "Sin informacion") return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function topFromMap(map, limit = 8) {
  return Array.from(map.values())
    .sort((a, b) => b.monto - a.monto || b.cantidad - a.cantidad)
    .slice(0, limit);
}

async function obtenerReportes(query = {}) {
  if (query.modoAnalisis || query.proveedoresObservados || query.codigoProveedoresObservados || query.clientesObservados || query.codigoClientesObservados) {
    return obtenerReportesOrdenesSeleccionadas(query);
  }

  const data = await listarOrdenes(query);
  const ordenes = getListado(data);
  const proveedores = new Map();
  const compradores = new Map();
  const estados = new Map();
  const fechas = new Map();

  let montoTotal = 0;

  ordenes.forEach((orden) => {
    const amount = pickNumber(orden.Total || orden.MontoTotal || orden.total || orden.montoTotal);
    montoTotal += amount;

    addToMap(proveedores, firstText(orden, ["NombreProveedor", "Proveedor.Nombre", "Proveedor.NombreProveedor", "Proveedor", "nombreProveedor"]), amount);
    addToMap(compradores, firstText(orden, ["Comprador.NombreOrganismo", "NombreOrganismo", "Organismo", "NombreComprador", "UnidadCompra"]), amount);
    addToMap(estados, estadoOrdenTexto(orden), amount || 1);
    addToMap(fechas, fechaOrdenTexto(orden), amount || 1);
  });

  return {
    filtros: {
      fecha: query.fecha || null,
      estado: query.estado || null,
      codigoOrganismo: query.CodigoOrganismo || query.codigoOrganismo || null,
      codigoProveedor: query.CodigoProveedor || query.codigoProveedor || null,
    },
    resumen: {
      totalOrdenes: ordenes.length,
      montoTotal,
      promedioOrden: ordenes.length ? Math.round(montoTotal / ordenes.length) : 0,
    },
    topProveedores: topFromMap(proveedores),
    topCompradores: topFromMap(compradores),
    porEstado: topFromMap(estados, 12),
    porFecha: topFromMap(fechas, 12),
    proveedoresGuardados: await obtenerAnaliticaProveedoresGuardados(),
    clientesGuardados: await obtenerAnaliticaClientesGuardados(query),
    fuente: "Direccion ChileCompra - API Mercado Publico",
  };
}

module.exports = {
  listarLicitaciones,
  obtenerLicitacion,
  listarOrdenes,
  obtenerOrden,
  obtenerReportes,
  buscarProveedor,
  buscarCompradores,
  guardarProveedorObservado,
  listarProveedoresGuardados,
  guardarClienteObservado,
  listarClientesGuardados,
  iniciarReporteJob,
  obtenerReporteJob,
  listarDescargaOrdenesJobs,
  cancelarJob,
  sincronizarEntidadesGuardadas,
  listarOrdenesCacheResumen,
  listarAnalisisGuardados,
  guardarAnalisisGenerado,
  obtenerEstadoConfiguracion,
  guardarTicket,
  iniciarDescargaOrdenesJob,
};

setTimeout(() => {
  reanudarJobsPendientes().catch(() => {});
}, 1000);
