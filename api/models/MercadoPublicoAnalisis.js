const { Schema, model } = require("mongoose");

const mercadoPublicoAnalisisSchema = new Schema(
  {
    modoAnalisis: { type: String, enum: ["proveedores", "clientes"], required: true, index: true },
    filtros: { type: Schema.Types.Mixed, default: {} },
    resumen: { type: Schema.Types.Mixed, default: {} },
    resultado: { type: Schema.Types.Mixed, required: true },
    solicitadoPor: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoAnalisis", mercadoPublicoAnalisisSchema, "mercado_publico_analisis");
