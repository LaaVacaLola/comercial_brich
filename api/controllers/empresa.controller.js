const Empresa = require("../models/Empresa");
const mercadoPublico = require("../services/mercadoPublico.service");

function cleanString(value) {
  return String(value ?? "").trim();
}

function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.getEmpresa = async (_req, res) => {
  try {
    const empresa = await Empresa.findOne({ key: "default" }).lean();
    res.json(empresa || {});
  } catch (err) {
    res.status(500).json({ error: "Error al obtener datos de empresa", details: err.message });
  }
};

exports.getOrdenesEmpresa = async (req, res) => {
  try {
    const empresa = await Empresa.findOne({ key: "default" }).lean();
    const rut = empresa?.rut?.trim();

    if (!rut) {
      return res.status(422).json({
        error: "La empresa no tiene RUT configurado. Guarda el RUT en Ajustes > Empresa.",
      });
    }

    // Buscar codigo de proveedor por RUT
    let codigoProveedor;
    try {
      const proveedorData = await mercadoPublico.buscarProveedor(rut);
      codigoProveedor = extraerCodigoProveedor(proveedorData);
    } catch (err) {
      return res.status(502).json({
        error: `No se pudo obtener el codigo de proveedor para RUT ${rut}: ${err.message}`,
      });
    }

    if (!codigoProveedor) {
      return res.status(404).json({
        error: `No se encontro un codigo de proveedor para el RUT ${rut} en Mercado Publico.`,
      });
    }

    // Consultar OC filtrando por CodigoProveedor, pasando los query params del cliente
    const query = { ...req.query, CodigoProveedor: codigoProveedor };
    const data = await mercadoPublico.listarOrdenes(query);

    res.json({ ...data, codigoProveedor, rut });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: "Error al obtener ordenes de la empresa", details: err.message });
  }
};

function extraerCodigoProveedor(data) {
  const objects = [];
  collectObjects(data, objects, new Set());

  const codeKeys = ["CodigoEmpresa", "CodigoProveedor", "Codigo", "codigoEmpresa", "codigoProveedor", "codigo"];
  const rutKeys = ["RutEmpresa", "RUTEmpresa", "RutProveedor", "RutSucursal", "Rut", "rut"];

  const hasCodigo = (obj) => codeKeys.some((k) => obj?.[k] && String(obj[k]).trim());
  const hasRut = (obj) => rutKeys.some((k) => obj?.[k] && String(obj[k]).trim());

  const candidate = objects.find((obj) => hasCodigo(obj) && hasRut(obj)) || objects.find(hasCodigo);
  if (!candidate) return null;

  for (const key of codeKeys) {
    if (candidate[key] && String(candidate[key]).trim()) return String(candidate[key]).trim();
  }
  return null;
}

function collectObjects(value, bucket, seen) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Array.isArray(value)) bucket.push(value);
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") collectObjects(child, bucket, seen);
  });
}

exports.saveEmpresa = async (req, res) => {
  try {
    const razonSocial = cleanString(req.body.razonSocial);
    const rut = cleanString(req.body.rut);
    const email = cleanString(req.body.email).toLowerCase();
    const direccion = cleanString(req.body.direccion);
    const telefono = cleanString(req.body.telefono);
    const nombreContacto = cleanString(req.body.nombreContacto);

    if (email && !validarEmail(email)) {
      return res.status(400).json({ error: "El email no tiene un formato valido" });
    }

    const data = {
      razonSocial,
      rut,
      email,
      direccion,
      telefono,
      nombreContacto,
      updatedBy: req.user?.email || req.user?.uid || null,
    };

    const empresa = await Empresa.findOneAndUpdate(
      { key: "default" },
      { $set: data, $setOnInsert: { key: "default" } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json({ ok: true, message: "Datos de empresa guardados correctamente.", empresa });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar datos de empresa", details: err.message });
  }
};
