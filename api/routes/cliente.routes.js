const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const controller = require("../controllers/cliente.controller");

router.use(auth, adminAuth);

router.get("/", controller.listClientes);
router.post("/", controller.createCliente);
router.put("/:id", controller.updateCliente);
router.patch("/:id", controller.updateCliente);

module.exports = router;
