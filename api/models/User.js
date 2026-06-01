const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    nombre: { type: String, required: true },
    apellido: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    // ESTE ES EL CAMPO NUEVO Y CORRECTO
    rol_id: { type: Schema.Types.ObjectId, ref: "Rol", required: true }
  },
  { timestamps: true }
);

module.exports = model("User", userSchema);
