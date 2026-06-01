const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const controller = require("../controllers/mercadoPublico.controller");

router.use(auth, adminAuth);

router.get("/licitaciones", controller.getLicitaciones);
router.get("/licitaciones/:codigo", controller.getLicitacionByCodigo);
router.get("/ordenes", controller.getOrdenes);
router.get("/ordenes/:codigo", controller.getOrdenByCodigo);
router.get("/reportes", controller.getReportes);
router.get("/proveedor", controller.getProveedor);
router.get("/compradores", controller.getCompradores);
router.get("/ajustes", controller.getAjustes);
router.put("/ajustes/ticket", controller.saveTicket);
router.get("/ajustes/test", controller.testConexion);

module.exports = router;
