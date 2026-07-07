let productos = [];
let carrito = [];
let regionSeleccionada = "";
let precioMax = Infinity;
let textoBusqueda = "";
let ordenSeleccionado = "default";

const grid = document.getElementById("productosGrid");
const resultadosCount = document.getElementById("resultados-count");
const cartModal = document.getElementById("cartModal");
const cartBtn = document.getElementById("cartBtn");
const closeCart = document.getElementById("closeCart");
const vaciarBtn = document.getElementById("vaciarCarrito");
const exportBtn = document.getElementById("exportExcel");
const countEl = document.getElementById("cartCount");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const modal = document.getElementById("productoModal");
const closeModal = document.getElementById("closeModal");
const filterPanel = document.getElementById("filterPanel");
const priceRange = document.getElementById("priceRange");
const priceValue = document.getElementById("priceValue");
const regionModal = document.getElementById("regionModal");
const confirmRegion = document.getElementById("confirmRegion");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function productoId(producto) {
  return String(producto?._id || producto?.id || "");
}

function formatCLP(value) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

function productoEstaActivo(producto) {
  if (typeof producto.activo === "boolean") return producto.activo;
  return producto.estado !== "inactivo";
}

function ofertaActiva(producto) {
  const oferta = producto.oferta;
  if (!oferta) return null;

  const inicio = new Date(oferta.fecha_inicio);
  const fin = new Date(oferta.fecha_termino);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;

  inicio.setHours(0, 0, 0, 0);
  fin.setHours(23, 59, 59, 999);

  const ahora = new Date();
  if (ahora < inicio || ahora > fin) return null;

  const precio = Number(producto.precio || 0);
  const porcentaje = Number(oferta.porcentaje_descuento);
  const monto = Number(oferta.monto_descuento);
  const descuento = Number.isFinite(monto) && monto > 0
    ? monto
    : (precio * (Number.isFinite(porcentaje) ? porcentaje : 0)) / 100;
  const precioOferta = Math.max(0, Math.round(precio - descuento));
  const porcentajeOferta = Number.isFinite(porcentaje) && porcentaje > 0
    ? porcentaje
    : precio > 0 ? (descuento / precio) * 100 : 0;

  if (descuento <= 0 && porcentajeOferta <= 0) return null;

  return {
    porcentaje: Math.round(porcentajeOferta * 100) / 100,
    precioOferta,
  };
}

function precioProducto(producto) {
  const oferta = ofertaActiva(producto);
  const precioOriginal = Number(producto.precio || 0);

  return {
    precioOriginal,
    precioUnitario: oferta ? oferta.precioOferta : precioOriginal,
    ofertaPorcentaje: oferta ? oferta.porcentaje : 0,
  };
}

function renderPrecioProducto(producto) {
  const precios = precioProducto(producto);
  if (!precios.ofertaPorcentaje) {
    return `<p class="precio">${formatCLP(precios.precioUnitario)}</p>`;
  }

  return `
    <p class="precio precio-oferta">${formatCLP(precios.precioUnitario)}</p>
    <p class="precio-original">${formatCLP(precios.precioOriginal)}</p>
    <span class="oferta-cliente">${precios.ofertaPorcentaje.toLocaleString("es-CL")}% oferta</span>
  `;
}

async function cargarProductos() {
  resultadosCount.textContent = "Cargando productos...";
  grid.innerHTML = '<p class="catalogo-message">Cargando productos...</p>';

  try {
    const resp = await fetch("/api/productos");
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const data = await resp.json();
    productos = data.filter((producto) => producto.aprobado === true && productoEstaActivo(producto));
    aplicarFiltros();
  } catch (err) {
    console.error("Error cargando productos:", err);
    productos = [];
    resultadosCount.textContent = "0 Productos";
    grid.innerHTML = '<p class="catalogo-message error">No se pudieron cargar los productos.</p>';
  }
}

function productoParaCarrito(producto) {
  const precios = precioProducto(producto);
  return {
    productoId: productoId(producto),
    sku: producto.sku || "",
    nombre: producto.nombre || "Producto sin nombre",
    imagen: producto.imagen || "../img/no-image.png",
    precioOriginal: precios.precioOriginal,
    precioUnitario: precios.precioUnitario,
    ofertaPorcentaje: precios.ofertaPorcentaje,
    cantidad: 1,
  };
}

function agregarAlCarrito(id) {
  const producto = productos.find((item) => productoId(item) === String(id));
  if (!producto) return;

  const existente = carrito.find((item) => item.productoId === productoId(producto));
  if (existente) {
    existente.cantidad += 1;
  } else {
    carrito.push(productoParaCarrito(producto));
  }

  actualizarCarrito();
}

function cambiarCantidad(index, delta) {
  const item = carrito[index];
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) {
    carrito.splice(index, 1);
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
  const totalCantidad = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const total = carrito.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0);

  countEl.textContent = totalCantidad;
  cartItems.innerHTML = "";

  if (carrito.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">El carrito esta vacio.</p>';
    cartTotal.innerHTML = "<strong>Total:</strong> $0";
    return;
  }

  carrito.forEach((item, index) => {
    const subtotal = item.precioUnitario * item.cantidad;
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(item.nombre)}">
      <div class="detalle">
        <span class="nombre">${escapeHtml(item.nombre)}</span>
        <span class="sku">${escapeHtml(item.sku || "Sin SKU")}</span>
        <span class="precio-unitario">${formatCLP(item.precioUnitario)} c/u</span>
        <div class="controles-cantidad">
          <button class="btn-cantidad menos" data-action="menos" data-index="${index}" type="button">-</button>
          <span class="cantidad">${item.cantidad}</span>
          <button class="btn-cantidad mas" data-action="mas" data-index="${index}" type="button">+</button>
        </div>
      </div>
      <span class="precio-producto">${formatCLP(subtotal)}</span>
      <button class="btn-remove" data-action="eliminar" data-index="${index}" type="button" aria-label="Eliminar producto">x</button>
    `;
    cartItems.appendChild(div);
  });

  cartTotal.innerHTML = `<strong>Total:</strong> ${formatCLP(total)}`;
}

async function exportarExcel() {
  if (carrito.length === 0) {
    alert("El carrito esta vacio.");
    return;
  }

  if (!window.ExcelJS || !window.saveAs) {
    alert("No se pudo cargar la libreria de exportacion. Revisa la conexion e intenta nuevamente.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Carrito");

  try {
    const response = await fetch("../img/logo.png");
    if (response.ok) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const imageId = workbook.addImage({ buffer: arrayBuffer, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 64 } });
    }
  } catch (err) {
    console.warn("No se pudo agregar el logo al Excel:", err.message);
  }

  sheet.mergeCells("C1", "F2");
  sheet.getCell("C1").value = "Comercial Brich - Carrito de Compras";
  sheet.getCell("C1").font = { size: 16, bold: true, color: { argb: "083C6F" } };
  sheet.getCell("C1").alignment = { vertical: "middle", horizontal: "center" };

  sheet.addRow([]);
  sheet.addRow([]);

  const header = sheet.addRow(["SKU", "Producto", "Cantidad", "Precio unitario", "Oferta %", "Subtotal"]);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "083C6F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  carrito.forEach((item) => {
    const row = sheet.addRow([
      item.sku || "Sin SKU",
      item.nombre,
      item.cantidad,
      item.precioUnitario,
      item.ofertaPorcentaje || 0,
      item.precioUnitario * item.cantidad,
    ]);
    row.getCell(4).numFmt = "$#,##0";
    row.getCell(5).numFmt = "0.00";
    row.getCell(6).numFmt = "$#,##0";
  });

  const total = carrito.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0);
  sheet.addRow([]);
  const totalRow = sheet.addRow(["", "", "", "", "TOTAL", total]);
  totalRow.font = { bold: true, color: { argb: "083C6F" } };
  totalRow.getCell(6).numFmt = "$#,##0";

  sheet.columns = [
    { width: 20 },
    { width: 55 },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), "Carrito_Comercial_Brich.xlsx");
}

function abrirModal(producto) {
  const precios = precioProducto(producto);
  document.getElementById("modalImg").src = producto.imagen || "../img/no-image.png";
  document.getElementById("modalNombre").textContent = producto.nombre || "";
  document.getElementById("modalDescripcion").textContent = producto.descripcion || "";
  document.getElementById("modalPrecio").textContent = formatCLP(precios.precioUnitario);

  const modalContent = document.querySelector(".modal-producto");
  const existingBtn = document.getElementById("btnAddModal");
  if (existingBtn) existingBtn.remove();

  const btnAdd = document.createElement("button");
  btnAdd.id = "btnAddModal";
  btnAdd.className = "btn-add";
  btnAdd.type = "button";
  btnAdd.textContent = "Agregar al carrito";
  btnAdd.addEventListener("click", () => {
    agregarAlCarrito(productoId(producto));
    modal.style.display = "none";
  });
  modalContent.appendChild(btnAdd);

  modal.style.display = "flex";
}

function renderProductos(lista) {
  grid.innerHTML = "";
  resultadosCount.textContent = `${lista.length} Productos`;

  if (lista.length === 0) {
    grid.innerHTML = '<p class="catalogo-message">No hay productos para mostrar.</p>';
    return;
  }

  lista.forEach((producto) => {
    const id = productoId(producto);
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${escapeHtml(producto.imagen || "../img/no-image.png")}" alt="${escapeHtml(producto.nombre || "Producto")}">
      <h4>${escapeHtml(producto.nombre || "Producto sin nombre")}</h4>
      <p>${escapeHtml(producto.sku || producto.id_padre || "Sin SKU")}</p>
      ${renderPrecioProducto(producto)}
      <button class="btn-add" data-id="${escapeHtml(id)}" type="button">Agregar al carrito</button>
    `;

    card.addEventListener("click", (event) => {
      if (!event.target.classList.contains("btn-add")) abrirModal(producto);
    });

    card.querySelector(".btn-add").addEventListener("click", (event) => {
      event.stopPropagation();
      agregarAlCarrito(id);
    });

    grid.appendChild(card);
  });
}

function aplicarFiltros() {
  let lista = productos.filter((producto) => {
    const precio = precioProducto(producto).precioUnitario;
    const coincideRegion = !regionSeleccionada || producto.region === regionSeleccionada;
    const coincidePrecio = precio <= precioMax;
    const texto = `${producto.nombre || ""} ${producto.sku || ""} ${producto.categoria || ""}`.toLowerCase();
    const coincideTexto = texto.includes(textoBusqueda.toLowerCase());
    return coincideRegion && coincidePrecio && coincideTexto;
  });

  switch (ordenSeleccionado) {
    case "precio-asc":
      lista.sort((a, b) => precioProducto(a).precioUnitario - precioProducto(b).precioUnitario);
      break;
    case "precio-desc":
      lista.sort((a, b) => precioProducto(b).precioUnitario - precioProducto(a).precioUnitario);
      break;
    case "nombre-asc":
      lista.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
      break;
    case "nombre-desc":
      lista.sort((a, b) => String(b.nombre || "").localeCompare(String(a.nombre || "")));
      break;
  }

  renderProductos(lista);
}

cartBtn.addEventListener("click", () => {
  actualizarCarrito();
  cartModal.style.display = "flex";
});

closeCart.addEventListener("click", () => {
  cartModal.style.display = "none";
});

vaciarBtn.addEventListener("click", vaciarCarrito);
exportBtn.addEventListener("click", exportarExcel);

cartItems.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  const index = Number(event.target.dataset.index);
  if (!action || !Number.isInteger(index)) return;

  if (action === "menos") cambiarCantidad(index, -1);
  if (action === "mas") cambiarCantidad(index, 1);
  if (action === "eliminar") eliminarDelCarrito(index);
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === cartModal) cartModal.style.display = "none";
  if (event.target === modal) modal.style.display = "none";
  if (event.target === regionModal) regionModal.style.display = "none";
});

document.getElementById("filterBtn").addEventListener("click", () => {
  filterPanel.classList.add("active");
});

document.getElementById("closeFilter").addEventListener("click", () => {
  filterPanel.classList.remove("active");
});

priceRange.addEventListener("input", () => {
  precioMax = Number(priceRange.value);
  priceValue.textContent = Number(priceRange.value).toLocaleString("es-CL");
});

document.getElementById("applyFilters").addEventListener("click", () => {
  aplicarFiltros();
  filterPanel.classList.remove("active");
});

document.getElementById("searchBar").addEventListener("input", (event) => {
  textoBusqueda = event.target.value.trim();
  aplicarFiltros();
});

document.getElementById("sortSelect").addEventListener("change", (event) => {
  ordenSeleccionado = event.target.value;
  aplicarFiltros();
});

if (confirmRegion) {
  confirmRegion.addEventListener("click", () => {
    const select = document.getElementById("regionSelect");
    regionSeleccionada = select.value || "";
    regionModal.style.display = "none";
    aplicarFiltros();
  });
}

actualizarCarrito();
cargarProductos();
