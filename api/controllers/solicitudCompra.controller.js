const mongoose = require("mongoose");
const SolicitudCompra = require("../models/SolicitudCompra");
const Producto = require("../models/Producto");

const IVA_TASA = 0.19;
const ESTADOS_VALIDOS = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];
const TRANSICIONES = {
  borrador: ["enviada", "vencida"],
  enviada: ["aceptada", "rechazada", "vencida"],
  aceptada: [],
  rechazada: [],
  vencida: [],
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function crearError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizarNumero(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw crearError(`${label} debe ser un numero valido`);
  return number;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizarCliente(cliente = {}) {
  const data = {
    razonSocial: cleanString(cliente.razonSocial),
    rut: cleanString(cliente.rut),
    email: cleanString(cliente.email).toLowerCase(),
    direccion: cleanString(cliente.direccion),
    nombreContacto: cleanString(cliente.nombreContacto),
    telefono: cleanString(cliente.telefono),
  };

  const faltantes = Object.entries(data)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (faltantes.length > 0) {
    throw crearError(`Faltan datos del cliente: ${faltantes.join(", ")}`);
  }

  if (!validarEmail(data.email)) {
    throw crearError("El email del cliente no tiene un formato valido");
  }

  return data;
}

function normalizarValidezDias(value) {
  if (value === undefined || value === null || value === "") return 15;
  const validezDias = normalizarNumero(value, "La validez en dias");
  if (!Number.isInteger(validezDias) || validezDias < 1) {
    throw crearError("La validez en dias debe ser un entero mayor a 0");
  }
  return validezDias;
}

function recalcularTotales(solicitud) {
  solicitud.items.forEach((item) => {
    item.subtotal = Math.round(Number(item.precioUnitario || 0) * Number(item.cantidad || 0));
  });

  solicitud.neto = solicitud.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  solicitud.ivaTasa = IVA_TASA;
  solicitud.iva = Math.round(solicitud.neto * IVA_TASA);
  solicitud.total = solicitud.neto + solicitud.iva;
}

async function generarFolio(anio = new Date().getFullYear()) {
  const ultimo = await SolicitudCompra.findOne({ anioFolio: anio })
    .sort({ correlativo: -1 })
    .select("correlativo")
    .lean();
  const correlativo = Number(ultimo?.correlativo || 0) + 1;
  const folio = `SOL-${anio}-${String(correlativo).padStart(4, "0")}`;
  return { folio, anioFolio: anio, correlativo };
}

async function crearSolicitudConFolio(data) {
  for (let intento = 0; intento < 5; intento += 1) {
    const folioData = await generarFolio();
    try {
      return await SolicitudCompra.create({ ...data, ...folioData });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  throw crearError("No se pudo generar un folio unico", 409);
}

function validarEstado(estado) {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw crearError("Estado de solicitud invalido");
  }
}

function validarTransicion(estadoActual, estadoNuevo) {
  validarEstado(estadoNuevo);
  if (estadoActual === estadoNuevo) return;
  if (!TRANSICIONES[estadoActual]?.includes(estadoNuevo)) {
    throw crearError(`Transicion de estado invalida: ${estadoActual} -> ${estadoNuevo}`);
  }
}

function validarPuedeEditar(solicitud) {
  if (["aceptada", "rechazada", "vencida"].includes(solicitud.estado)) {
    throw crearError("No se puede modificar una solicitud cerrada", 409);
  }
}

async function obtenerSolicitudEditable(id) {
  if (!isValidObjectId(id)) throw crearError("ID de solicitud invalido");
  const solicitud = await SolicitudCompra.findById(id);
  if (!solicitud) throw crearError("Solicitud de compra no encontrada", 404);
  return solicitud;
}

async function construirItemSnapshot(productoId, cantidadValue) {
  if (!isValidObjectId(productoId)) throw crearError("ID de producto invalido");

  const cantidad = normalizarNumero(cantidadValue, "La cantidad");
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw crearError("La cantidad debe ser un entero mayor a 0");
  }

  const producto = await Producto.findById(productoId);
  if (!producto) throw crearError("Producto no encontrado", 404);

  const precioUnitario = normalizarNumero(producto.precio, "El precio del producto");
  if (precioUnitario < 0) throw crearError("El precio del producto no puede ser negativo");

  return {
    productoId: producto._id,
    nombre: producto.nombre,
    sku: producto.sku || `SIN-SKU-${String(producto._id).slice(-6).toUpperCase()}`,
    precioUnitario,
    cantidad,
    subtotal: Math.round(precioUnitario * cantidad),
  };
}

exports.listSolicitudesCompra = async (_req, res) => {
  try {
    const solicitudes = await SolicitudCompra.find()
      .sort({ createdAt: -1 })
      .select("-items");
    res.json(solicitudes);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener solicitudes de compra", details: err.message });
  }
};

exports.getSolicitudCompraById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de solicitud invalido" });
    }

    const solicitud = await SolicitudCompra.findById(req.params.id);
    if (!solicitud) return res.status(404).json({ error: "Solicitud de compra no encontrada" });

    res.json(solicitud);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener solicitud de compra", details: err.message });
  }
};

exports.createSolicitudCompra = async (req, res) => {
  try {
    const cliente = normalizarCliente(req.body.cliente);
    const validezDias = normalizarValidezDias(req.body.validezDias);
    const observaciones = cleanString(req.body.observaciones);
    const items = [];

    for (const item of req.body.items || []) {
      items.push(await construirItemSnapshot(item.productoId, item.cantidad));
    }

    const data = {
      cliente,
      validezDias,
      observaciones,
      items,
      estado: "borrador",
      ivaTasa: IVA_TASA,
    };
    recalcularTotales(data);

    const solicitud = await crearSolicitudConFolio(data);
    res.status(201).json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al crear solicitud de compra", details: err.message });
  }
};

exports.updateSolicitudCompra = async (req, res) => {
  try {
    const solicitud = await obtenerSolicitudEditable(req.params.id);
    validarPuedeEditar(solicitud);

    if (req.body.cliente !== undefined) solicitud.cliente = normalizarCliente(req.body.cliente);
    if (req.body.validezDias !== undefined) solicitud.validezDias = normalizarValidezDias(req.body.validezDias);
    if (req.body.observaciones !== undefined) solicitud.observaciones = cleanString(req.body.observaciones);

    recalcularTotales(solicitud);
    await solicitud.save();
    res.json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al actualizar solicitud de compra", details: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const solicitud = await obtenerSolicitudEditable(req.params.id);
    validarPuedeEditar(solicitud);

    const item = await construirItemSnapshot(req.body.productoId, req.body.cantidad);
    solicitud.items.push(item);
    recalcularTotales(solicitud);
    await solicitud.save();
    res.status(201).json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al agregar item", details: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const solicitud = await obtenerSolicitudEditable(req.params.id);
    validarPuedeEditar(solicitud);

    const item = solicitud.items.id(req.params.itemId);
    if (!item) throw crearError("Item no encontrado", 404);

    const cantidad = normalizarNumero(req.body.cantidad, "La cantidad");
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw crearError("La cantidad debe ser un entero mayor a 0");
    }

    item.cantidad = cantidad;
    recalcularTotales(solicitud);
    await solicitud.save();
    res.json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al actualizar item", details: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const solicitud = await obtenerSolicitudEditable(req.params.id);
    validarPuedeEditar(solicitud);

    const item = solicitud.items.id(req.params.itemId);
    if (!item) throw crearError("Item no encontrado", 404);

    item.deleteOne();
    recalcularTotales(solicitud);
    await solicitud.save();
    res.json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al eliminar item", details: err.message });
  }
};

exports.changeEstado = async (req, res) => {
  try {
    const solicitud = await obtenerSolicitudEditable(req.params.id);
    const estado = cleanString(req.body.estado);

    validarTransicion(solicitud.estado, estado);
    if (estado === "enviada" && solicitud.items.length === 0) {
      throw crearError("No se puede enviar una solicitud sin items");
    }

    solicitud.estado = estado;
    recalcularTotales(solicitud);
    await solicitud.save();
    res.json(solicitud);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al cambiar estado", details: err.message });
  }
};
