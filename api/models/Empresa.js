const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const empresaSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    razonSocial: { type: String, default: "", trim: true },
    rut: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    direccion: { type: String, default: "", trim: true },
    telefono: { type: String, default: "", trim: true },
    nombreContacto: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = model("Empresa", empresaSchema);
