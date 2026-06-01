// routes/admin.routes.js
const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");

// Ruta protegida para admins
router.get("/stats", auth, adminAuth, (req, res) => {
  res.json({
    message: "Bienvenido administrador",
    user: req.user,
    data: {
      ventasMes: 3250000,
      pendientesEntrega: 18,
      pendientesAceptacion: 12,
      aceptadas: 34,
    },
  });
});

module.exports = router;
