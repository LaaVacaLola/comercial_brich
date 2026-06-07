// api/controllers/producto.controller.js
const Producto = require("../models/Producto");

function cleanNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const err = new Error(`${label} debe ser un numero valido`);
    err.status = 400;
    throw err;
  }
  return number;
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

// ==============================
// GET: Listar todos los productos
// ==============================
exports.getProductos = async (req, res) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos", details: err.message });
  }
};

// ==============================
// GET: Obtener un producto por ID
// ==============================
exports.getProductoById = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto)
      return res.status(404).json({ error: "Producto no encontrado" });

    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto", details: err.message });
  }
};

// ==============================
// POST: Crear producto (solo admin)
// ==============================
exports.createProducto = async (req, res) => {
  try {
    const { id_padre, id_hijo, nombre, region, precio } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const nuevo = new Producto({
      id_padre,
      id_hijo,
      nombre,
      region,
      precio,
      estado: "activo",
      aprobado: false,
    });

    await nuevo.save();

    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ error: "Error al crear producto", details: err.message });
  }
};

// ==============================
// PUT: Normalizar precios a enteros
// ==============================
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

      if (producto.precio !== precioNormalizado) {
        await Producto.collection.updateOne(
          { _id: producto._id },
          { $set: { precio: precioNormalizado } }
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

// ==============================
// PUT: Actualizar producto
// ==============================
exports.updateProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto)
      return res.status(404).json({ error: "Producto no encontrado" });

    const update = { ...req.body };
    const precioFinal = update.precio !== undefined ? update.precio : producto.precio;
    const ofertaNormalizada = normalizarOferta(update.oferta, precioFinal);

    if (ofertaNormalizada !== undefined) {
      update.oferta = ofertaNormalizada;
    }

    const updated = await Producto.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: "Error al actualizar producto", details: err.message });
  }
};

// ==============================
// DELETE: Eliminar producto
// ==============================
exports.deleteProducto = async (req, res) => {
  try {
    const deleted = await Producto.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ error: "Producto no encontrado" });

    res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto", details: err.message });
  }
};
