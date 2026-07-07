const mongoose = require("mongoose");
const Cliente = require("../models/Cliente");

function cleanString(value) {
  return String(value ?? "").trim();
}

function crearError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizarCliente(body = {}, { parcial = false } = {}) {
  const data = {};
  const campos = ["razonSocial", "rut", "email", "direccion", "nombreContacto", "telefono"];

  for (const campo of campos) {
    if (body[campo] !== undefined) data[campo] = cleanString(body[campo]);
  }

  if (data.email !== undefined) data.email = data.email.toLowerCase();
  if (body.activo !== undefined) data.activo = Boolean(body.activo);

  if (!parcial) {
    const faltantes = campos.filter((campo) => !data[campo]);
    if (faltantes.length > 0) {
      throw crearError(`Faltan datos del cliente: ${faltantes.join(", ")}`);
    }
  }

  if (data.email !== undefined && !validarEmail(data.email)) {
    throw crearError("El email del cliente no tiene un formato valido");
  }

  return data;
}

exports.listClientes = async (req, res) => {
  try {
    const filter = {};
    if (req.query.incluirInactivos !== "true") filter.activo = true;
    const clientes = await Cliente.find(filter).sort({ razonSocial: 1 }).lean();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes", details: err.message });
  }
};

exports.createCliente = async (req, res) => {
  try {
    const data = normalizarCliente(req.body);
    const cliente = await Cliente.create(data);
    res.status(201).json(cliente);
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.status || 500;
    res.status(status).json({ error: "Error al crear cliente", details: err.message });
  }
};

exports.updateCliente = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "ID de cliente invalido" });
    }

    const update = normalizarCliente(req.body, { parcial: true });
    const cliente = await Cliente.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(cliente);
  } catch (err) {
    const status = err.code === 11000 ? 409 : err.status || 500;
    res.status(status).json({ error: "Error al actualizar cliente", details: err.message });
  }
};
