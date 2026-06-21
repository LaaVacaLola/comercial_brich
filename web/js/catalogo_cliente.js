// ===============================
// CARGAR PRODUCTOS REALES DEL BACKEND
// ===============================
let productos = [];     // 🟦 ahora viene del backend
let regionSeleccionada = "";
let precioMax = 10000;
let carrito = [];

// Obtener token desde localStorage
function getToken() {
  return localStorage.getItem("token") || "";
}

// Cargar productos desde el servidor
async function cargarProductos() {
  try {
    const token = getToken();
    const headers = {};

    // ➤ SOLO agregar Authorization si realmente existe token
    if (token && token.trim() !== "") {
      headers["Authorization"] = "Bearer " + token;
    }

    const resp = await fetch("/api/productos", {
      method: "GET",
      headers
    });

    if (!resp.ok) {
      throw new Error("HTTP " + resp.status);
    }

    const data = await resp.json();

    // filtramos solo aprobados y activos, con compatibilidad para productos antiguos
    productos = data.filter(p => {
      const activo = typeof p.activo === "boolean" ? p.activo : p.estado === "activo";
      return p.aprobado === true && activo;
    });

    console.log("Productos cargados:", productos);
  } catch (err) {
    console.error("❌ Error cargando productos:", err);
  }
}



// ===============================
// 🛒 CARRITO MEJORADO CON BOTONES + / -
// ===============================
function agregarAlCarrito(id) {
  const producto = productos.find(p => p.id == id);
  const existente = carrito.find(p => p.id == id);

  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push({ ...producto, cantidad: 1 });
  }

  actualizarCarrito();
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  actualizarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  actualizarCarrito();
}

function actualizarCarrito() {
  const countEl   = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  countEl.textContent = carrito.reduce((acc, p) => acc + p.cantidad, 0);
  cartItems.innerHTML = "";

  let total = 0;

  carrito.forEach((p, i) => {
    const subtotal = p.precio * p.cantidad;
    total += subtotal;

    const item = document.createElement("div");
    item.className = "cart-item";

    const img = document.createElement("img");
    img.src = p.imagen;
    img.alt = p.nombre;

    const detalle = document.createElement("div");
    detalle.className = "detalle";

    const nombre = document.createElement("span");
    nombre.className = "nombre";
    nombre.textContent = p.nombre;

    const controles = document.createElement("div");
    controles.className = "controles-cantidad";

    const btnMenos = document.createElement("button");
    btnMenos.className = "btn-cantidad menos";
    btnMenos.textContent = "–";
    btnMenos.addEventListener("click", () => {
      if (p.cantidad > 1) p.cantidad--;
      else carrito.splice(i, 1);
      actualizarCarrito();
    });

    const spanCantidad = document.createElement("span");
    spanCantidad.className = "cantidad";
    spanCantidad.textContent = p.cantidad;

    const btnMas = document.createElement("button");
    btnMas.className = "btn-cantidad mas";
    btnMas.textContent = "+";
    btnMas.addEventListener("click", () => {
      p.cantidad++;
      actualizarCarrito();
    });

    controles.append(btnMenos, spanCantidad, btnMas);
    detalle.append(nombre, controles);

    const precio = document.createElement("span");
    precio.className = "precio-producto";
    precio.textContent = `$${subtotal}`;

    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn-remove";
    btnRemove.dataset.index = i;
    btnRemove.textContent = "✕";
    btnRemove.addEventListener("click", () => eliminarDelCarrito(i));

    item.append(img, detalle, precio, btnRemove);
    cartItems.appendChild(item);
  });

  cartTotal.innerHTML = `<strong>Total:</strong> $${total}`;
}


// ===============================
// EXPORTAR A EXCEL CON LOGO
// ===============================
async function exportarExcel() {
  if (carrito.length === 0) {
    alert("El carrito está vacío");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Carrito Comercial Brich");

  const response = await fetch("../img/logo.png");
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  const imageId = workbook.addImage({
    buffer: arrayBuffer,
    extension: "png",
  });

  sheet.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: 150, height: 80 }
  });

  sheet.mergeCells("C1", "E2");
  const titleCell = sheet.getCell("C1");
  titleCell.value = "Comercial Brich - Carrito de Compras";
  titleCell.font = { size: 16, bold: true, color: { argb: "003366" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  sheet.addRow([]);
  sheet.addRow([]);

  const headers = ["Producto", "Precio ($)"];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0097c9" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  carrito.forEach(p => {
    const row = sheet.addRow([p.nombre, p.precio]);
    row.getCell(2).numFmt = "$#,##0";
  });

  sheet.addRow([]);
  const total = carrito.reduce((acc, p) => acc + p.precio, 0);
  const totalRow = sheet.addRow(["TOTAL", total]);

  totalRow.font = { bold: true, color: { argb: "003366" } };
  totalRow.getCell(2).numFmt = "$#,##0";

  sheet.columns = [
    { width: 45 },
    { width: 15 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), "Carrito_Comercial_Brich.xlsx");
}


// ===============================
// MODAL CARRITO
// ===============================
const cartModal = document.getElementById("cartModal");
const cartBtn = document.getElementById("cartBtn");
const closeCart = document.getElementById("closeCart");
const vaciarBtn = document.getElementById("vaciarCarrito");
const exportBtn = document.getElementById("exportExcel");
exportBtn.addEventListener("click", exportarExcel);

cartBtn.addEventListener("click", () => cartModal.style.display = "flex");
closeCart.addEventListener("click", () => cartModal.style.display = "none");
vaciarBtn.addEventListener("click", vaciarCarrito);
window.addEventListener("click", e => { if (e.target === cartModal) cartModal.style.display = "none"; });


// ===============================
// MODAL PRODUCTO
// ===============================
const modal = document.getElementById("productoModal");
const closeModal = document.getElementById("closeModal");

function abrirModal(prod) {
  document.getElementById("modalImg").src = prod.imagen;
  document.getElementById("modalNombre").textContent = prod.nombre;
  document.getElementById("modalDescripcion").textContent = prod.descripcion;
  document.getElementById("modalPrecio").textContent = `$ ${prod.precio}`;

  const modalContent = document.querySelector(".modal-producto");
  let existingBtn = document.getElementById("btnAddModal");
  if (existingBtn) existingBtn.remove();

  const btnAdd = document.createElement("button");
  btnAdd.id = "btnAddModal";
  btnAdd.classList.add("btn-add");
  btnAdd.textContent = "Agregar al carrito 🛒";
  btnAdd.addEventListener("click", () => agregarAlCarrito(prod.id));
  modalContent.appendChild(btnAdd);

  modal.style.display = "flex";
}

closeModal.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });


// ===============================
// RENDERIZAR PRODUCTOS
// ===============================
const grid = document.getElementById("productosGrid");

function renderProductos(lista) {
  grid.innerHTML = "";
  lista.forEach(p => {
    const card = document.createElement("div");
    card.classList.add("product-card");
    card.innerHTML = `
      <img src="${p.imagen}" alt="${p.nombre}">
      <h4>${p.nombre}</h4>
      <p>ID ${p.id_padre}</p>
      <p class="precio">$ ${p.precio}</p>
      <button class="btn-add" data-id="${p.id}">Agregar al carrito</button>
    `;
    grid.appendChild(card);

    card.addEventListener("click", e => {
      if (!e.target.classList.contains("btn-add")) {
        abrirModal(p);
      }
    });
  });

  document.querySelectorAll(".btn-add").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      agregarAlCarrito(e.target.dataset.id);
    });
  });

  document.getElementById("resultados-count").textContent = `${lista.length} Productos`;
}


// ===============================
// MODAL REGIÓN
// ===============================
const regionModal = document.getElementById("regionModal");
const confirmRegion = document.getElementById("confirmRegion");

window.addEventListener("load", async () => {
  await cargarProductos();
  regionModal.style.display = "flex";
});

confirmRegion.addEventListener("click", () => {
  const select = document.getElementById("regionSelect");
  if (select.value) {
    regionSeleccionada = select.value;
    regionModal.style.display = "none";
    aplicarFiltros();
  } else {
    alert("Selecciona una región");
  }
});


// ===============================
// PANEL FILTROS
// ===============================
const filterPanel = document.getElementById("filterPanel");
document.getElementById("filterBtn").addEventListener("click", () => {
  filterPanel.classList.add("active");
});
document.getElementById("closeFilter").addEventListener("click", () => {
  filterPanel.classList.remove("active");
});

const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");
priceRange.addEventListener("input", () => {
  priceValue.textContent = priceRange.value;
  precioMax = parseInt(priceRange.value);
});

document.getElementById("applyFilters").addEventListener("click", () => {
  aplicarFiltros();
  filterPanel.classList.remove("active");
});


// ===============================
// BUSCADOR Y ORDENAR
// ===============================
document.getElementById("searchBar").addEventListener("input", e => aplicarFiltros(e.target.value));
document.getElementById("sortSelect").addEventListener("change", e => aplicarFiltros(document.getElementById("searchBar").value, e.target.value));


// ===============================
// FILTROS Y ORDEN
// ===============================
function aplicarFiltros(texto = "", orden = "default") {
  let lista = productos.filter(p =>
    p.region === regionSeleccionada &&
    p.precio <= precioMax &&
    p.nombre.toLowerCase().includes(texto.toLowerCase())
  );

  switch (orden) {
    case "precio-asc": lista.sort((a,b) => a.precio - b.precio); break;
    case "precio-desc": lista.sort((a,b) => b.precio - a.precio); break;
    case "nombre-asc": lista.sort((a,b) => a.nombre.localeCompare(b.nombre)); break;
    case "nombre-desc": lista.sort((a,b) => b.nombre.localeCompare(a.nombre)); break;
  }

  renderProductos(lista);
}


// ===============================
// OPORTUNIDADES CHILECOMPRA
// ===============================
async function cargarOportunidades() {
  const contenedor = document.getElementById("oportunidadesContainer");
  if (!contenedor) return;

  contenedor.innerHTML = "<p>Cargando oportunidades...</p>";

  try {
    const respuesta = await fetch("/oportunidades");
    const data = await respuesta.json();

    if (data.error) {
      contenedor.innerHTML = `
        <p>Error (${data.Codigo}): ${data.Mensaje}</p>
      `;
      return;
    }

    if (!data || !data.Licitaciones || data.Licitaciones.length === 0) {
      contenedor.innerHTML = "<p>No hay licitaciones abiertas.</p>";
      return;
    }

    contenedor.innerHTML = "";
    data.Licitaciones.forEach((lic) => {
      const div = document.createElement("div");
      div.classList.add("card-oportunidad");
      div.innerHTML = `
        <h3>${lic.Nombre || lic.NombreLicitacion}</h3>
        <p><strong>Código:</strong> ${lic.CodigoExterno || lic.Codigo}</p>
      `;
      contenedor.appendChild(div);
    });
  } catch (error) {
    contenedor.innerHTML = "<p>Error al cargar oportunidades.</p>";
  }
}

document.addEventListener("DOMContentLoaded", cargarOportunidades);
