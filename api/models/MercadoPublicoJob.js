const { Schema, model } = require("mongoose");

const mercadoPublicoJobSchema = new Schema(
  {
    tipo: { type: String, required: true, index: true },
    status: { type: String, enum: ["queued", "running", "complete", "error", "cancelled"], default: "queued", index: true },
    entidadTipo: { type: String, enum: ["proveedor", "cliente", "analisis"], default: "analisis", index: true },
    entidadCodigo: { type: String, default: "", index: true },
    entidadNombre: { type: String, default: "" },
    params: { type: Schema.Types.Mixed, default: {} },
    progress: {
      porcentaje: { type: Number, default: 0 },
      totalObjetivo: { type: Number, default: 0 },
      consultasProcesadas: { type: Number, default: 0 },
      consultasOmitidas: { type: Number, default: 0 },
      ocEncontradas: { type: Number, default: 0 },
      ocProcesadas: { type: Number, default: 0 },
      ocOmitidas: { type: Number, default: 0 },
    },
    logs: {
      type: [
        {
          at: { type: Date, default: Date.now },
          message: { type: String, required: true },
        },
      ],
      default: [],
    },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoJob", mercadoPublicoJobSchema, "mercado_publico_jobs");
