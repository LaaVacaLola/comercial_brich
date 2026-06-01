const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");

// Esta ruta está protegida
router.get("/", auth, (req, res) => {
  res.json({
    message: `Hola ${req.user.email}, bienvenido al dashboard`,
    role: req.user.rol_id
  });
});

module.exports = router;
