const { Schema, model } = require("mongoose");

const productoObservadoSchema = new Schema(
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

const compradorObservadoSchema = new Schema(
  {
    codigoOrganismo: { type: String, default: "" },
    nombreOrganismo: { type: String, default: "" },
    codigoUnidad: { type: String, default: "" },
    nombreUnidad: { type: String, default: "" },
    region: { type: String, default: "" },
    comuna: { type: String, default: "" },
  },
  { _id: false }
);

const licitacionObservadaSchema = new Schema(
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
    comprador: { type: compradorObservadoSchema, default: () => ({}) },
    productos: { type: [productoObservadoSchema], default: [] },
    guardadoEn: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mercadoPublicoProveedorSchema = new Schema(
  {
    codigoProveedor: { type: String, required: true, unique: true, index: true, trim: true },
    nombreProveedor: { type: String, required: true, trim: true },
    rutProveedor: { type: String, default: "", trim: true },
    origen: { type: String, default: "licitaciones" },
    licitaciones: { type: [licitacionObservadaSchema], default: [] },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = model("MercadoPublicoProveedor", mercadoPublicoProveedorSchema, "mercado_publico_proveedores");
