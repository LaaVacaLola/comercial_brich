const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const clienteSchema = new Schema(
  {
    razonSocial: { type: String, required: true, trim: true },
    rut: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    direccion: { type: String, required: true, trim: true },
    nombreContacto: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model("Cliente", clienteSchema);
