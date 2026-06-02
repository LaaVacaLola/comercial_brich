const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const controller = require("../controllers/mercadoPublico.controller");

router.use(auth, adminAuth);

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "Modulo Mercado Publico disponible.",
  });
});

router.get("/ajustes", controller.getAjustes);
router.put("/ajustes/ticket", controller.saveTicket);
router.post("/ajustes/ticket", controller.saveTicket);
router.get("/ajustes/test", controller.testConexion);
router.get("/licitaciones", controller.getLicitaciones);
router.get("/licitaciones/:codigo", controller.getLicitacionByCodigo);
router.get("/ordenes", controller.getOrdenes);
router.get("/ordenes/:codigo", controller.getOrdenByCodigo);
router.get("/reportes", controller.getReportes);
router.post("/reportes/jobs", controller.startReporteJob);
router.get("/reportes/jobs/:id", controller.getReporteJob);
router.get("/reportes/guardados", controller.getAnalisisGuardados);
router.get("/oc-jobs", controller.getDescargaOrdenesJobs);
router.put("/oc-jobs/:id/cancel", controller.cancelJob);
router.post("/oc-jobs/sync", controller.syncEntidadesGuardadas);
router.get("/oc-cache", controller.getOrdenesCache);
router.get("/proveedor", controller.getProveedor);
router.get("/compradores", controller.getCompradores);
router.get("/proveedores-guardados", controller.getProveedoresGuardados);
router.post("/proveedores-guardados", controller.saveProveedorGuardado);
router.get("/clientes-observados", controller.getClientesGuardados);
router.post("/clientes-observados", controller.saveClienteGuardado);

router.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta Mercado Publico no encontrada",
    method: req.method,
    path: req.originalUrl,
  });
});

module.exports = router;
