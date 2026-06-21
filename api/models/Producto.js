const mongoose = require("mongoose");
const { Schema, model } = mongoose;
const ofertaSchema = require("./Oferta");

const productoSchema = new Schema(
  {
    id_padre: { type: String, default: "", trim: true },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: "", trim: true },
    imagen: { type: String, default: "", trim: true },
    region: { type: String, default: "", trim: true },
    precio: { type: Number, required: true, min: 0 },
    unidad: { type: String, default: "", trim: true },
    categoria: { type: String, default: "", trim: true },
    oferta: { type: ofertaSchema, default: null },
    activo: { type: Boolean, default: true },
    estado: { type: String, enum: ["activo", "inactivo"], default: "activo" },
    aprobado: { type: Boolean, default: false },
    fecha_creacion: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model("Producto", productoSchema);
