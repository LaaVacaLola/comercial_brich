const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const controller = require("../controllers/solicitudCompra.controller");

router.use(auth, adminAuth);

router.get("/", controller.listSolicitudesCompra);
router.post("/", controller.createSolicitudCompra);
router.get("/:id", controller.getSolicitudCompraById);
router.put("/:id", controller.updateSolicitudCompra);
router.patch("/:id", controller.updateSolicitudCompra);
router.post("/:id/items", controller.addItem);
router.put("/:id/items/:itemId", controller.updateItem);
router.patch("/:id/items/:itemId", controller.updateItem);
router.delete("/:id/items/:itemId", controller.removeItem);
router.patch("/:id/estado", controller.changeEstado);

module.exports = router;
