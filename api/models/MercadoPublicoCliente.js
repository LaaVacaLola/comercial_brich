const { Schema, model } = require("mongoose");

const productoDemandadoSchema = new Schema(
  {
    codigoProducto: { type: String, default: "" },
    nombreProducto: { type: String, default: "" },
    codigoCategoria: { type: String, default: "" },
    categoria: { type: String, default: "" },
    cantidad: { type: Number, default: 0 },
    unidadMedida: { type: String, default: "" },
  },
  { _id: false }
);

const licitacionClienteSchema = new Schema(
  {
    codigo: { type: String, required: true, trim: true },
    nombre: { type: String, default: "" },
    estado: { type: String, default: "" },
    codigoEstado: { type: Number, default: null },
    tipo: { type: String, default: "" },
    moneda: { type: String, default: "" },
    montoEstimado: { type: Number, default: 0 },
    fechaPublicacion: { type: Date, default: null },
    fechaCierre: { type: Date, default: null },
    productos: { type: [productoDemandadoSchema], default: [] },
    guardadoEn: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mercadoPublicoClienteSchema = new Schema(
  {
    codigoOrganismo: { type: String, required: true, unique: true, index: true, trim: true },
    nombreOrganismo: { type: String, required: true, trim: true },
    rutUnidad: { type: String, default: "", trim: true },
    codigoUnidad: { type: String, default: "", trim: true },
    nombreUnidad: { type: String, default: "", trim: true },
    region: { type: String, default: "", trim: true },
    comuna: { type: String, default: "", trim: true },
    origen: { type: String, default: "licitaciones" },
    licitaciones: { type: [licitacionClienteSchema], default: [] },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoCliente", mercadoPublicoClienteSchema, "mercado_publico_clientes");
