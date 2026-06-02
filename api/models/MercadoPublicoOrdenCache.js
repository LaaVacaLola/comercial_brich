const { Schema, model } = require("mongoose");

const mercadoPublicoOrdenCacheSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, index: true, trim: true },
    proveedorCodigo: { type: String, default: "", index: true },
    proveedorNombre: { type: String, default: "" },
    compradorCodigo: { type: String, default: "", index: true },
    compradorNombre: { type: String, default: "" },
    fecha: { type: Date, default: null, index: true },
    estado: { type: String, default: "" },
    total: { type: Number, default: 0 },
    origenes: {
      type: [
        {
          tipo: { type: String, enum: ["proveedor", "cliente"], required: true },
          codigo: { type: String, required: true },
          nombre: { type: String, default: "" },
        },
      ],
      default: [],
    },
    raw: { type: Schema.Types.Mixed, required: true },
    downloadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoOrdenCache", mercadoPublicoOrdenCacheSchema, "mercado_publico_oc_cache");
