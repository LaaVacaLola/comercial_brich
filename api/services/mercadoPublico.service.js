const axios = require("axios");
const { randomUUID } = require("crypto");
const MercadoPublicoConfig = require("../models/MercadoPublicoConfig");
const MercadoPublicoProveedor = require("../models/MercadoPublicoProveedor");
const MercadoPublicoCliente = require("../models/MercadoPublicoCliente");

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
const reportJobs = new Map();

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
  return resumenProveedorGuardado(proveedor.toObject());
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
  return resumenClienteGuardado(cliente.toObject());
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

function lastYearApiDates() {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 364);
  return datesBetween(
    `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  );
}

async function listarOrdenesPorEntidadUltimoAno(paramsPorDia, maxOrdenes, progress) {
  const ticket = await getTicket();
  const fechas = lastYearApiDates();
  const byCode = new Map();

  for (const fecha of fechas) {
    try {
      const data = await requestChileCompra(`${PUBLIC_URL}/ordenesdecompra.json`, {
        fecha,
        estado: "todos",
        ticket,
        ...paramsPorDia,
      });

      getListado(data).forEach((orden) => {
        const code = orden.Codigo || orden.CodigoOC;
        if (code && byCode.size < maxOrdenes) byCode.set(code, orden);
      });

      if (progress) {
        progress.consultasProcesadas += 1;
        progress.ocEncontradas = Math.max(progress.ocEncontradas, byCode.size);
      }

      if (byCode.size >= maxOrdenes) break;
    } catch (err) {
      if (progress) progress.consultasOmitidas += 1;
      if (err.status === 429) continue;
    }
  }

  return Array.from(byCode.values());
}

async function listarOrdenesProveedorUltimoAno(codigoProveedor, maxOrdenes, progress) {
  return listarOrdenesPorEntidadUltimoAno({ CodigoProveedor: codigoProveedor }, maxOrdenes, progress);
}

async function listarOrdenesClienteUltimoAno(codigoOrganismo, maxOrdenes, progress) {
  return listarOrdenesPorEntidadUltimoAno({ CodigoOrganismo: codigoOrganismo }, maxOrdenes, progress);
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

async function obtenerReportesOrdenesSeleccionadas(query = {}, progress) {
  const modoAnalisis = query.modoAnalisis === "clientes" ? "clientes" : "proveedores";
  const proveedoresSeleccionados = selectedCodesArray(query.proveedoresObservados || query.codigoProveedoresObservados, "codigoProveedor");
  const clientesSeleccionados = selectedCodesFromQuery(query.clientesObservados || query.codigoClientesObservados);
  const maxOrdenes = cleanLimit(query.limiteOrdenes);

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

  const ordenesBase = [];
  if (modoAnalisis === "clientes") {
    for (const codigoOrganismo of Array.from(clientesSeleccionados)) {
      const restantes = maxOrdenes - ordenesBase.length;
      if (restantes <= 0) break;
      const ordenesCliente = await listarOrdenesClienteUltimoAno(codigoOrganismo, restantes, progress);
      ordenesBase.push(...ordenesCliente);
    }
  } else {
    for (const codigoProveedor of proveedoresSeleccionados) {
      const restantes = maxOrdenes - ordenesBase.length;
      if (restantes <= 0) break;
      const ordenesProveedor = await listarOrdenesProveedorUltimoAno(codigoProveedor, restantes, progress);
      ordenesBase.push(...ordenesProveedor);
    }
  }

  const byCode = new Map();
  ordenesBase.forEach((orden) => {
    const code = orden.Codigo || orden.CodigoOC;
    if (code) byCode.set(code, orden);
  });

  const detalles = [];
  const codigosDetalle = Array.from(byCode.keys()).slice(0, maxOrdenes);
  if (progress) {
    progress.totalObjetivo = codigosDetalle.length || maxOrdenes;
    progress.ocEncontradas = codigosDetalle.length;
  }

  for (const codigo of codigosDetalle) {
    const detalle = await obtenerDetalleOrdenSeguro(codigo);
    detalles.push(detalle);
    if (progress) {
      if (detalle.errorDetalle) {
        progress.ocOmitidas += 1;
      } else {
        progress.ocProcesadas += 1;
      }
      progress.porcentaje = Math.min(100, Math.round(((progress.ocProcesadas + progress.ocOmitidas) / Math.max(1, progress.totalObjetivo)) * 100));
    }
  }

  const ordenes = detalles
    .map(resumenOrdenAnalitica)
    .filter((orden) => {
      if (modoAnalisis === "clientes") return true;
      return !clientesSeleccionados || clientesSeleccionados.has(String(orden.comprador.codigoOrganismo));
    });

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

  return {
    modo: "seleccion_observados",
    filtros: {
      modoAnalisis,
      rango: "ultimo_ano",
      limiteOrdenes: maxOrdenes,
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
      totalObjetivo: cleanLimit(query.limiteOrdenes),
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
  obtenerEstadoConfiguracion,
  guardarTicket,
};
