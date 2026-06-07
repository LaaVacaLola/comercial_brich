const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const {
  getProductos,
  getProductoById,
  createProducto,
  normalizarPreciosProductos,
  updateProducto,
  deleteProducto
} = require("../controllers/producto.controller");

// ==============================
// RUTAS PÚBLICAS (CATÁLOGO CLIENTE)
// ==============================
router.get("/", getProductos);        // SIN AUTH
router.get("/:id", getProductoById);  // SIN AUTH

// ==============================
// RUTAS SOLO ADMIN
// ==============================
router.post("/", auth, adminAuth, createProducto);
router.put("/precios/normalizar", auth, adminAuth, normalizarPreciosProductos);
router.put("/:id", auth, adminAuth, updateProducto);
router.delete("/:id", auth, adminAuth, deleteProducto);

module.exports = router;
