import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/oportunidades", async (req, res) => {
  try {
    const response = await fetch("https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?ticket=F8537A18-6766-4DEF-9E59-426B4FEE2844");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error al conectar con ChileCompra:", error);
    res.status(500).json({ error: "Error al obtener los datos" });
  }
});

app.listen(4000, () => console.log("Servidor proxy escuchando en el puerto 4000"));
