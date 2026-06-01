// api/controllers/producto.controller.js
const Producto = require("../models/Producto");

// ==============================
// GET: Listar todos los productos
// ==============================
exports.getProductos = async (req, res) => {
  try {
    const productos = await Producto.find().sort({ createdAt: -1 });
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener productos", details: err.message });
  }
};

// ==============================
// GET: Obtener un producto por ID
// ==============================
exports.getProductoById = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto)
      return res.status(404).json({ error: "Producto no encontrado" });

    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto", details: err.message });
  }
};

// ==============================
// POST: Crear producto (solo admin)
// ==============================
exports.createProducto = async (req, res) => {
  try {
    const { id_padre, id_hijo, nombre, region, precio } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    const nuevo = new Producto({
      id_padre,
      id_hijo,
      nombre,
      region,
      precio,
      estado: "activo",
      aprobado: false,
    });

    await nuevo.save();

    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ error: "Error al crear producto", details: err.message });
  }
};

// ==============================
// PUT: Actualizar producto
// ==============================
exports.updateProducto = async (req, res) => {
  try {
    const updated = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Producto no encontrado" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar producto", details: err.message });
  }
};

// ==============================
// DELETE: Eliminar producto
// ==============================
exports.deleteProducto = async (req, res) => {
  try {
    const deleted = await Producto.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ error: "Producto no encontrado" });

    res.json({ message: "Producto eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar producto", details: err.message });
  }
};
