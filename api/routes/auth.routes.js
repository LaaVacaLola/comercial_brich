const router = require("express").Router();
const { login } = require("../controllers/auth.controller");

const auth = require("../middlewares/authMiddleware");
const adminOnly = require("../middlewares/adminMiddleware");

// ===============================
// Obtener datos del usuario autenticado
// ===============================
router.get("/me", auth, (req, res) => {
  res.json({
    id: req.user.uid,
    nombre: req.user.nombre,
    email: req.user.email,
    role: req.user.role
  });
});

// ===============================
// Ruta de login
// ===============================
router.post("/login", login);

// ===============================
// Rutas protegidas solo para ADMIN
// ===============================
router.get("/admin/stats", auth, adminOnly, (req, res) => {
  res.json({
    message: "Bienvenido administrador",
    stats: {
      ventas: 3250000,
      ordenesPendientes: 18,
      ordenesAceptadas: 34,
      usuarios: 12
    }
  });
});

module.exports = router;
