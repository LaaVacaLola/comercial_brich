// api/models/Rol.js
const { Schema, model } = require("mongoose");

const rolSchema = new Schema(
  {
    nombreRol: { type: String, required: true, unique: true },
    permisos: { type: Array, default: [] },
    descripcion: { type: String }
  },
  { timestamps: true }
);

// 🔥 Forzar a Mongoose a usar la colección 'roles' (la que sí existe en tu base)
module.exports = model("Rol", rolSchema, "roles");
