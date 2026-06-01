const { Schema, model } = require("mongoose");

const mercadoPublicoConfigSchema = new Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      immutable: true,
    },
    ticket: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoConfig", mercadoPublicoConfigSchema);
