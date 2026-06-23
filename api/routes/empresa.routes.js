const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const {
  getEmpresa,
  saveEmpresa,
  getOrdenesEmpresa,
  getOrdenesEmpresaCache,
  iniciarJobDescargaEmpresa,
  getJobDescargaEmpresa,
  cancelarJobDescargaEmpresa,
} = require("../controllers/empresa.controller");

router.use(auth, adminAuth);

router.get("/", getEmpresa);
router.put("/", saveEmpresa);
router.post("/", saveEmpresa);
router.get("/ordenes", getOrdenesEmpresa);
router.get("/ordenes/cache", getOrdenesEmpresaCache);
router.post("/ordenes/job", iniciarJobDescargaEmpresa);
router.get("/ordenes/job", getJobDescargaEmpresa);
router.delete("/ordenes/job", cancelarJobDescargaEmpresa);

module.exports = router;
