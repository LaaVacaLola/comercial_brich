const router = require("express").Router();
const auth = require("../middlewares/authMiddleware");
const adminAuth = require("../middlewares/adminMiddleware");
const { getEmpresa, saveEmpresa } = require("../controllers/empresa.controller");

router.use(auth, adminAuth);

router.get("/", getEmpresa);
router.put("/", saveEmpresa);
router.post("/", saveEmpresa);

module.exports = router;
