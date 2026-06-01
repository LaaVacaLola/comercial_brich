// importProductos.js
require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

const { connectDB } = require("./api/db");
const Producto = require("./api/models/Producto");

// ----------------------------------------------------
// 1) Obtener todos los links de productos en UNA página
// ----------------------------------------------------
async function obtenerLinksProductos(urlCategoria) {
  console.log("📥 Cargando página:", urlCategoria);

  const resp = await axios.get(urlCategoria);
  const $ = cheerio.load(resp.data);

  const links = [];

  // Detecta tarjetas de productos de Odoo
  $(".oe_product .oe_product_image a, .o_product_tile a").each((i, el) => {
    const href = $(el).attr("href");
    if (href) {
      const abs = href.startsWith("http")
        ? href
        : "https://cmbrich.odoo.com" + href;
      links.push(abs);
    }
  });

  const unicos = [...new Set(links)];
  console.log("🔗 Productos encontrados en esta página:", unicos.length);
  return unicos;
}

// ----------------------------------------------------
// 2) Scrap por producto individual
// ----------------------------------------------------
async function scrapProducto(url) {
  console.log("🔎 Scrapeando:", url);

  const resp = await axios.get(url);
  const $ = cheerio.load(resp.data);

  // Nombre
  const nombre = $("h1").first().text().trim();

  // Precio
  const precioText = $(".oe_price .oe_currency_value, .o_price .oe_currency_value")
    .first()
    .text()
    .trim();

  const precio = parseFloat(
    precioText.replace(/[^\d.,]/g, "").replace(",", ".")
  ) || 0;

  // Imagen principal correcta
  let imgUrl =
    $("#o-carousel-product img").first().attr("src") ||
    $(".o_carousel_product img").first().attr("src") ||
    "";

  if (imgUrl && !imgUrl.startsWith("http")) {
    imgUrl = "https://cmbrich.odoo.com" + imgUrl;
  }

  // ID Padre desde URL
  const idMatch = url.match(/\/id-(\d+)/);
  const id_padre = idMatch ? idMatch[1] : "";

  return {
    id_padre,
    nombre,
    imagen: imgUrl,
    precio,
    estado: "activo",
    aprobado: true,
    region: "Arica" // <-- cámbiala manual si quieres
  };
}

// ----------------------------------------------------
// 3) IMPORTADOR PRINCIPAL
// ----------------------------------------------------
async function importar(urlCategoria, region) {
  try {
    await connectDB();
    console.log("✅ Conectado a MongoDB");

    const links = await obtenerLinksProductos(urlCategoria);
    let contador = 0;

    for (const url of links) {
      try {
        const data = await scrapProducto(url);
        data.region = region; // asigna región a todos

        if (!data.nombre) {
          console.log("⚠ Producto sin nombre, saltando:", url);
          continue;
        }

        // Upsert por id_padre
        const doc = await Producto.findOneAndUpdate(
          { id_padre: data.id_padre },
          data,
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );

        contador++;
        console.log(`✅ Guardado/Actualizado: ${doc.nombre}`);

      } catch (err) {
        console.error("❌ Error procesando producto:", url);
        console.error(err.message);
      }
    }

    console.log(`🎉 Importación completada (${contador} productos)`);

  } catch (err) {
    console.error("❌ Error en la importación:", err.message);
  } finally {
    process.exit(0);
  }
}

// ----------------------------------------------------
// EJECUCIÓN DESDE CONSOLA
// ----------------------------------------------------
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("❌ Debes ingresar: URL_DE_PAGINA y REGION");
  console.log('Ejemplo:');
  console.log('node importProductos.js "https://cmbrich.odoo.com/shop/category/alimentos-174" "Arica y Parinacota"');
  process.exit(1);
}

const [urlCategoria, region] = args;

importar(urlCategoria, region);
