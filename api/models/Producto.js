const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const productoSchema = new Schema(
  {
    id_padre: { type: String, default: "" },
    nombre: { type: String, required: true },
    imagen: { type: String, default: "" },  // ✅ NUEVO
    region: { type: String, default: "" },
    precio: { type: Number, required: true },
    estado: { type: String, enum: ["activo", "inactivo"], default: "activo" },
    aprobado: { type: Boolean, default: false },
    fecha_creacion: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = model("Producto", productoSchema);