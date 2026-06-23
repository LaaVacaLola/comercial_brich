const Empresa = require("../models/Empresa");

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
