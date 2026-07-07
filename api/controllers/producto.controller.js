// api/controllers/producto.controller.js
const mongoose = require("mongoose");
const Producto = require("../models/Producto");

const CAMPOS_PRODUCTO_EDITABLES = [
  "id_padre",
  "nombre",
  "descripcion",
  "imagen",
  "region",
  "precio",
  "unidad",
  "categoria",
  "activo",
  "aprobado",
  "oferta",
];

function cleanNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const err = new Error(`${label} debe ser un numero valido`);
    err.status = 400;
    throw err;
  }
  return number;
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function parseBoolean(value, label) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;

  const err = new Error(`${label} debe ser booleano`);
  err.status = 400;
  throw err;
}

function normalizarPrecio(value) {
  const precio = cleanNumber(value, "El precio");
  if (precio < 0) {
    const err = new Error("El precio no puede ser negativo");
    err.status = 400;
    throw err;
  }
  return precio;
}

function estadoDesdeActivo(activo) {
  return activo ? "activo" : "inactivo";
}

async function generarSkuProducto(fecha = new Date()) {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  const prefix = `SKU-${year}${month}${day}`;
  const ultimo = await Producto.findOne({ sku: new RegExp(`^${prefix}-`) })
    .sort({ sku: -1 })
    .select("sku")
    .lean();
  const ultimoNumero = Number(String(ultimo?.sku || "").split("-").pop());
  const siguiente = Number.isFinite(ultimoNumero) ? ultimoNumero + 1 : 1;
  return `${prefix}-${String(siguiente).padStart(4, "0")}`;
}

async function crearSkuUnico() {
  for (let intento = 0; intento < 5; intento += 1) {
    const sku = await generarSkuProducto();
    const existe = await Producto.exists({ sku });
    if (!existe) return sku;
  }

  const err = new Error("No se pudo generar un SKU unico");
  err.status = 409;
  throw err;
}

function normalizarPayloadProducto(body, { parcial = false } = {}) {
  const data = {};

  if (body.id_padre !== undefined) data.id_padre = cleanString(body.id_padre);
  if (body.nombre !== undefined) data.nombre = cleanString(body.nombre);
  if (body.descripcion !== undefined) data.descripcion = cleanString(body.descripcion);
  if (body.imagen !== undefined) data.imagen = cleanString(body.imagen);
  if (body.region !== undefined) data.region = cleanString(body.region);
  if (body.unidad !== undefined) data.unidad = cleanString(body.unidad);
  if (body.categoria !== undefined) data.categoria = cleanString(body.categoria);
  if (body.precio !== undefined) data.precio = normalizarPrecio(body.precio);
  if (body.aprobado !== undefined) data.aprobado = parseBoolean(body.aprobado, "Aprobado");
  if (body.oferta !== undefined) data.oferta = body.oferta;

  if (body.activo !== undefined) {
    data.activo = parseBoolean(body.activo, "Activo");
    data.estado = estadoDesdeActivo(data.activo);
  } else if (body.estado !== undefined) {
    data.activo = body.estado === "activo";
    data.estado = estadoDesdeActivo(data.activo);
  }

  if (!parcial || data.nombre !== undefined) {
    if (!data.nombre) {
      const err = new Error("El nombre es obligatorio");
      err.status = 400;
      throw err;
    }
  }

  if (!parcial && data.precio === undefined) {
    const err = new Error("El precio es obligatorio");
    err.status = 400;
    throw err;
  }

  return data;
}

function normalizarOferta(oferta, precioProducto) {
  if (oferta === undefined) return undefined;
  if (oferta === null || oferta === "") return null;

  const fechaInicio = oferta.fecha_inicio || oferta.fechaInicio;
  const fechaTermino = oferta.fecha_termino || oferta.fechaTermino;
  const inicio = new Date(fechaInicio);
  const termino = new Date(fechaTermino);

  if (!fechaInicio || Number.isNaN(inicio.getTime())) {
    const err = new Error("La fecha de inicio de la oferta es obligatoria");
    err.status = 400;
    throw err;
  }

  if (!fechaTermino || Number.isNaN(termino.getTime())) {
    const err = new Error("La fecha de termino de la oferta es obligatoria");
    err.status = 400;
    throw err;
  }

  if (inicio > termino) {
    const err = new Error("La fecha de inicio no puede ser mayor que la fecha de termino");
    err.status = 400;
    throw err;
  }

  const precio = cleanNumber(precioProducto, "El precio del producto");
  if (precio <= 0) {
    const err = new Error("El precio del producto debe ser mayor a 0 para crear una oferta");
    err.status = 400;
    throw err;
  }

  const tienePorcentaje = oferta.porcentaje_descuento !== undefined && oferta.porcentaje_descuento !== "";
  const tieneMonto = oferta.monto_descuento !== undefined && oferta.monto_descuento !== "";

  if (!tienePorcentaje && !tieneMonto) {
    const err = new Error("Debes ingresar porcentaje o monto de descuento");
    err.status = 400;
    throw err;
  }

  let porcentaje = tienePorcentaje ? cleanNumber(oferta.porcentaje_descuento, "El porcentaje de descuento") : null;
  let monto = tieneMonto ? cleanNumber(oferta.monto_descuento, "El monto de descuento") : null;

  if (porcentaje !== null && (porcentaje < 0 || porcentaje > 100)) {
    const err = new Error("El porcentaje de descuento debe estar entre 0 y 100");
    err.status = 400;
    throw err;
  }

  if (monto !== null && (monto < 0 || monto > precio)) {
    const err = new Error("El monto de descuento debe estar entre 0 y el precio del producto");
    err.status = 400;
    throw err;
  }

  if (porcentaje === null) {
    porcentaje = (monto / precio) * 100;
  }

  if (monto === null) {
    monto = (precio * porcentaje) / 100;
  }

  return {
    fecha_inicio: inicio,
    fecha_termino: termino,
    porcentaje_descuento: Math.round(porcentaje * 100) / 100,
    monto_descuento: Math.round(monto),
  };
}

function precioAEntero(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  let text = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    text = text.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma > -1) {
    const parts = text.split(",");
    text = parts[parts.length - 1].length === 3
      ? text.replaceAll(",", "")
      : text.replace(",", ".");
  } else if (lastDot > -1) {
    const parts = text.split(".");
    text = parts[parts.length - 1].length === 3
      ? text.replaceAll(".", "")
      : text;
  }

  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number) : null;
}

exports.getProductos = async (req, res) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos", details: err.message });
  }
};

exports.getProductoById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de producto invalido" });
    }

    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto", details: err.message });
  }
};

exports.createProducto = async (req, res) => {
  try {
    const data = normalizarPayloadProducto(req.body);
    data.sku = await crearSkuUnico();

    if (data.activo === undefined) {
      data.activo = true;
      data.estado = "activo";
    }

    if (data.aprobado === undefined) data.aprobado = false;

    const nuevo = new Producto(data);
    await nuevo.save();

    res.status(201).json(nuevo);
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.status || 500;
    res.status(status).json({ error: "Error al crear producto", details: err.message });
  }
};

exports.normalizarPreciosProductos = async (_req, res) => {
  try {
    const productos = await Producto.collection.find({}).toArray();
    let actualizados = 0;
    let omitidos = 0;
    const errores = [];

    for (const producto of productos) {
      const precioNormalizado = precioAEntero(producto.precio);

      if (precioNormalizado === null) {
        omitidos += 1;
        errores.push({
          id: String(producto._id),
          nombre: producto.nombre || "",
          precio: producto.precio,
        });
        continue;
      }

      const activo = typeof producto.activo === "boolean"
        ? producto.activo
        : producto.estado !== "inactivo";
      const update = {
        precio: precioNormalizado,
        activo,
        estado: estadoDesdeActivo(activo),
      };

      if (producto.precio !== precioNormalizado || producto.activo !== activo || producto.estado !== update.estado) {
        await Producto.collection.updateOne(
          { _id: producto._id },
          { $set: update }
        );
        actualizados += 1;
      }
    }

    res.json({
      ok: true,
      message: "Precios normalizados correctamente",
      total: productos.length,
      actualizados,
      sinCambios: productos.length - actualizados - omitidos,
      omitidos,
      errores,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al normalizar precios", details: err.message });
  }
};

exports.normalizarSkusProductos = async (_req, res) => {
  try {
    const productos = await Producto.find({
      $or: [
        { sku: { $exists: false } },
        { sku: null },
        { sku: "" },
      ],
    }).select("_id sku nombre").lean();

    let actualizados = 0;

    for (const producto of productos) {
      const sku = await crearSkuUnico();
      const result = await Producto.updateOne(
        {
          _id: producto._id,
          $or: [
            { sku: { $exists: false } },
            { sku: null },
            { sku: "" },
          ],
        },
        { $set: { sku } }
      );

      if (result.modifiedCount > 0) actualizados += 1;
    }

    res.json({
      ok: true,
      message: "SKU normalizados correctamente",
      total: productos.length,
      actualizados,
      sinCambios: productos.length - actualizados,
    });
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.status || 500;
    res.status(status).json({ error: "Error al normalizar SKU", details: err.message });
  }
};

exports.updateProducto = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de producto invalido" });
    }

    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const payloadPermitido = {};
    for (const campo of CAMPOS_PRODUCTO_EDITABLES) {
      if (req.body[campo] !== undefined) payloadPermitido[campo] = req.body[campo];
    }

    const update = normalizarPayloadProducto(payloadPermitido, { parcial: true });
    const precioFinal = update.precio !== undefined ? update.precio : producto.precio;
    const ofertaNormalizada = normalizarOferta(update.oferta, precioFinal);

    if (ofertaNormalizada !== undefined) {
      update.oferta = ofertaNormalizada;
    }

    if (!producto.sku) {
      update.sku = await crearSkuUnico();
    }

    const updated = await Producto.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.status || 500;
    res.status(status).json({ error: "Error al actualizar producto", details: err.message });
  }
};

exports.deleteProducto = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de producto invalido" });
    }

    const deleted = await Producto.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto", details: err.message });
  }
};
