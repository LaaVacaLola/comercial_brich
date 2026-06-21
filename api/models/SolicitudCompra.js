const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const clienteSchema = new Schema(
  {
    razonSocial: { type: String, required: true, trim: true },
    rut: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    direccion: { type: String, required: true, trim: true },
    nombreContacto: { type: String, required: true, trim: true },
    telefono: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const solicitudItemSchema = new Schema(
  {
    productoId: { type: Schema.Types.ObjectId, ref: "Producto", required: true },
    nombre: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    precioUnitario: { type: Number, required: true, min: 0 },
    cantidad: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

const solicitudCompraSchema = new Schema(
  {
    folio: { type: String, required: true, unique: true, trim: true },
    anioFolio: { type: Number, required: true, index: true },
    correlativo: { type: Number, required: true, min: 1 },
    cliente: { type: clienteSchema, required: true },
    fecha: { type: Date, default: Date.now },
    estado: {
      type: String,
      enum: ["borrador", "enviada", "aceptada", "rechazada", "vencida"],
      default: "borrador",
    },
    validezDias: { type: Number, default: 15, min: 1 },
    observaciones: { type: String, default: "", trim: true },
    items: { type: [solicitudItemSchema], default: [] },
    neto: { type: Number, default: 0, min: 0 },
    ivaTasa: { type: Number, default: 0.19 },
    iva: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

solicitudCompraSchema.index({ anioFolio: 1, correlativo: 1 }, { unique: true });

module.exports = model("SolicitudCompra", solicitudCompraSchema);
