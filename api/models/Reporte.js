const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const reporteSchema = new Schema(
  {
    tipo: { type: String, required: true },
    datos: { type: Object, required: true },
    generado_por: { type: Schema.Types.ObjectId, ref: "User" },
    fecha: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = model("Reporte", reporteSchema);
