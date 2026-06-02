const axios = require("axios");
const MercadoPublicoConfig = require("../models/MercadoPublicoConfig");

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

  const maxDays = 31;
  const dates = [];
  const cursor = new Date(start);

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
  return ["fecha", "fechaDesde", "fechaHasta", "codigo", "estado", "CodigoOrganismo", "codigoOrganismo", "CodigoProveedor", "codigoProveedor"]
    .some((key) => query[key] !== undefined && String(query[key]).trim() !== "");
}

async function requestChileCompra(url, params) {
  try {
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
  let listado = fulfilled.flatMap(getListado);

  if (!listado.length && estado === "todos") {
    results = await fetchRange(false);
    fulfilled = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    listado = fulfilled.flatMap(getListado);
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

  return requestChileCompra(`${PUBLIC_URL}/licitaciones.json`, await buildParams(query, LICITACION_ESTADOS));
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
  obtenerEstadoConfiguracion,
  guardarTicket,
};
