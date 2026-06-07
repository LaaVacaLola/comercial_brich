const { Schema } = require("mongoose");

const ofertaSchema = new Schema(
  {
    fecha_inicio: { type: Date, required: true },
    fecha_termino: { type: Date, required: true },
    porcentaje_descuento: { type: Number, required: true, min: 0, max: 100 },
    monto_descuento: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

module.exports = ofertaSchema;
