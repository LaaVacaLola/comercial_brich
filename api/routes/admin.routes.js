// routes/admin.routes.js
const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const mercadoPublicoController = require("../controllers/mercadoPublico.controller");

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

router.get("/mercado-publico/ajustes", auth, adminAuth, mercadoPublicoController.getAjustes);
router.post("/mercado-publico/ajustes/ticket", auth, adminAuth, mercadoPublicoController.saveTicket);
router.put("/mercado-publico/ajustes/ticket", auth, adminAuth, mercadoPublicoController.saveTicket);
router.get("/mercado-publico/ajustes/test", auth, adminAuth, mercadoPublicoController.testConexion);

module.exports = router;
