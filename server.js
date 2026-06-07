// server.js
require("dotenv").config({ path: ".env" });

const express = require("express");
const path = require("path");
const cors = require("cors");
const { connectDB } = require("./api/db");

const app = express();
const helmet = require("helmet");
const morgan = require("morgan");


// fetch
let fetchImpl = global.fetch;
if (!fetchImpl) {
  fetchImpl = require("node-fetch");
}
const fetch = (...args) => fetchImpl(...args);

const PORT = process.env.PORT || 3000;


// Seguridad con Helmet + CSP
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.jsdelivr.net"], // Chart.js
      "style-src": ["'self'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"], // estilos
      "font-src": ["'self'", "https://fonts.gstatic.com"], // fuentes
      "img-src": ["'self'", "data:", "https:"], // imágenes locales/externas

      "connect-src": [
        "'self'",
        "http://localhost:3000",
        // API oficial Mercado Publico / ChileCompra
        "https://api.mercadopublico.cl",
        "https://www.chilecompra.cl",
      ],
    },
  })
);

// ===============================
// Middlewares (deben ir primero)
// ===============================
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "web")));

// ===============================
// Rutas de la API (después de json())
// ===============================
app.use("/api/auth", require("./api/routes/auth.routes"));
app.use("/api/dashboard", require("./api/routes/dashboard.routes"));
app.use("/api/usuarios", require("./api/routes/user.routes")); // ✅ ya toma req.body
app.use("/api/admin", require("./api/routes/admin.routes"));
app.use("/api/productos", require("./api/routes/producto.routes"));
app.use("/api/mercado-publico", require("./api/routes/mercadoPublico.routes"));


// ===============================
// Rutas del FRONT
// ===============================
app.get("/cliente/catalogo", (req, res) => {
  res.sendFile(path.join(__dirname, "web/html/catalogo_cliente.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "web/html/login.html"));
});

// ===============================
// Errores
// ===============================
app.use((req, res, next) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

app.use((err, req, res, next) => {
  console.error("Error interno:", err.message);
  res.status(500).json({ message: "Error interno del servidor" });
});

// ===============================
// Iniciar servidor
// ===============================
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
