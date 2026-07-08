let productos = [];
let carrito = [];
let regionSeleccionada = "";
let precioMax = Infinity;
let textoBusqueda = "";
let ordenSeleccionado = "default";
const REGION_STORAGE_KEY = "catalogoRegion";

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
const regionSelect = document.getElementById("regionSelect");
const regionActual = document.getElementById("regionActual");
const cambiarRegion = document.getElementById("cambiarRegion");

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

function normalizarRegion(value) {
  return String(value || "").trim();
}

function regionesDisponibles() {
  return [...new Set(productos.map((producto) => normalizarRegion(producto.region)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function actualizarRegionActual() {
  regionActual.textContent = regionSeleccionada || "Sin seleccionar";
}

function poblarSelectorRegiones() {
  const regiones = regionesDisponibles();
  const opciones = regiones.length > 0
    ? regiones
    : Array.from(regionSelect.options)
      .map((option) => normalizarRegion(option.value))
      .filter(Boolean);

  regionSelect.innerHTML = '<option value="">-- Selecciona --</option>';

  opciones.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    regionSelect.appendChild(option);
  });

  if (regionSeleccionada && opciones.includes(regionSeleccionada)) {
    regionSelect.value = regionSeleccionada;
  }
}

function abrirSelectorRegion() {
  poblarSelectorRegiones();
  regionModal.style.display = "flex";
}

function guardarRegion(region) {
  regionSeleccionada = normalizarRegion(region);
  localStorage.setItem(REGION_STORAGE_KEY, regionSeleccionada);
  actualizarRegionActual();
  aplicarFiltros();
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
    const regionGuardada = normalizarRegion(localStorage.getItem(REGION_STORAGE_KEY));
    const regiones = regionesDisponibles();
    regionSeleccionada = regiones.includes(regionGuardada) ? regionGuardada : "";
    actualizarRegionActual();
    poblarSelectorRegiones();
    aplicarFiltros();
    if (!regionSeleccionada) abrirSelectorRegion();
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
  workbook.creator = "Comercial Brich";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Carrito", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const brandBlue = "083C6F";
  const brandCyan = "0097C9";
  const brandGreen = "16A34A";
  const brandYellow = "FFC107";
  const darkText = "1E293B";
  const mutedText = "64748B";
  const lightBlue = "EAF3F8";
  const borderColor = "CBD5E1";
  const moneyFormat = '"$"#,##0';
  const generatedAt = new Date();
  const totalCantidad = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const total = carrito.reduce((acc, item) => acc + item.precioUnitario * item.cantidad, 0);
  const totalOriginal = carrito.reduce((acc, item) => acc + item.precioOriginal * item.cantidad, 0);
  const ahorro = Math.max(0, totalOriginal - total);

  sheet.properties.defaultRowHeight = 22;
  sheet.columns = [
    { header: "Item", key: "item", width: 8 },
    { header: "SKU", key: "sku", width: 24 },
    { header: "Producto", key: "producto", width: 62 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Precio unitario", key: "precioUnitario", width: 20 },
    { header: "Oferta %", key: "oferta", width: 12 },
    { header: "Precio original", key: "precioOriginal", width: 20 },
    { header: "Subtotal", key: "subtotal", width: 20 },
  ];

  sheet.mergeCells("A1:B3");
  sheet.getCell("A1").value = "";
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
  sheet.getCell("A1").border = {
    top: { style: "medium", color: { argb: brandBlue } },
    left: { style: "medium", color: { argb: brandBlue } },
    bottom: { style: "medium", color: { argb: brandBlue } },
    right: { style: "medium", color: { argb: brandBlue } },
  };

  sheet.mergeCells("C1:H1");
  sheet.getCell("C1").value = "Comercial Brich";
  sheet.getCell("C1").font = { bold: true, size: 20, color: { argb: "FFFFFF" } };
  sheet.getCell("C1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandBlue } };
  sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("C2:H2");
  sheet.getCell("C2").value = "Carrito de compras";
  sheet.getCell("C2").font = { bold: true, size: 14, color: { argb: brandBlue } };
  sheet.getCell("C2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
  sheet.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("C3:H3");
  sheet.getCell("C3").value = "Resumen preparado desde el catalogo publico";
  sheet.getCell("C3").font = { italic: true, size: 10, color: { argb: mutedText } };
  sheet.getCell("C3").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 22;

  try {
    const response = await fetch("../img/logo.png");
    if (response.ok) {
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const imageId = workbook.addImage({ buffer: arrayBuffer, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 0.35, row: 0.25 }, ext: { width: 118, height: 64 } });
    }
  } catch (err) {
    console.warn("No se pudo agregar el logo al Excel:", err.message);
  }

  const infoRows = [
    ["Fecha de generacion", generatedAt.toLocaleString("es-CL"), "", "", "Region", regionSeleccionada || "Sin seleccionar", "", ""],
    ["Productos distintos", carrito.length, "", "", "Unidades totales", totalCantidad, "", ""],
    ["Total carrito", total, "", "", "Ahorro por ofertas", ahorro, "", ""],
  ];

  infoRows.forEach((values, index) => {
    const row = sheet.getRow(4 + index);
    row.values = values;
    row.height = 23;
    [1, 5].forEach((col) => {
      const cell = row.getCell(col);
      cell.font = { bold: true, color: { argb: brandBlue } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } };
    });
    [2, 6].forEach((col) => {
      const cell = row.getCell(col);
      cell.font = { bold: true, color: { argb: darkText } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  sheet.getCell("B6").numFmt = moneyFormat;
  sheet.getCell("F6").numFmt = moneyFormat;

  sheet.mergeCells("A8:H8");
  sheet.getCell("A8").value = "Detalle de productos";
  sheet.getCell("A8").font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
  sheet.getCell("A8").fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandCyan } };
  sheet.getCell("A8").alignment = { horizontal: "left", vertical: "middle" };

  const headerRow = sheet.getRow(10);
  headerRow.values = ["Item", "SKU", "Producto", "Cantidad", "Precio unitario", "Oferta %", "Precio original", "Subtotal"];
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandBlue } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: brandBlue } },
      left: { style: "thin", color: { argb: brandBlue } },
      bottom: { style: "thin", color: { argb: brandBlue } },
      right: { style: "thin", color: { argb: brandBlue } },
    };
  });

  carrito.forEach((item, index) => {
    const rowNumber = 11 + index;
    const row = sheet.getRow(rowNumber);
    const nombreLength = String(item.nombre || "").length;
    const skuLength = String(item.sku || "Sin SKU").length;
    row.values = [
      index + 1,
      item.sku || "Sin SKU",
      item.nombre,
      item.cantidad,
      item.precioUnitario,
      item.ofertaPorcentaje || 0,
      item.precioOriginal,
      item.precioUnitario * item.cantidad,
    ];
    row.height = Math.max(28, Math.min(72, 22 + Math.ceil(Math.max(nombreLength / 42, skuLength / 20)) * 14));

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: borderColor } },
        left: { style: "thin", color: { argb: borderColor } },
        bottom: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } },
      };
      cell.alignment = {
        horizontal: colNumber === 2 || colNumber === 3 ? "left" : "center",
        vertical: "top",
        wrapText: colNumber === 2 || colNumber === 3,
      };
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } };
      }
    });

    row.getCell(3).font = { color: { argb: darkText } };
    row.getCell(5).numFmt = moneyFormat;
    row.getCell(6).numFmt = "0.00";
    row.getCell(7).numFmt = moneyFormat;
    row.getCell(8).numFmt = moneyFormat;
  });

  const totalRowNumber = 12 + carrito.length;
  const totalRow = sheet.getRow(totalRowNumber);
  totalRow.values = ["", "", "", "", "", "TOTAL", "", total];
  totalRow.height = 28;
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandGreen } };
    cell.border = {
      top: { style: "thin", color: { argb: brandGreen } },
      left: { style: "thin", color: { argb: brandGreen } },
      bottom: { style: "thin", color: { argb: brandGreen } },
      right: { style: "thin", color: { argb: brandGreen } },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  totalRow.getCell(8).numFmt = moneyFormat;

  const noteRowNumber = totalRowNumber + 2;
  sheet.mergeCells(`A${noteRowNumber}:H${noteRowNumber}`);
  sheet.getCell(`A${noteRowNumber}`).value = "Documento generado automaticamente desde el catalogo publico. Valores referenciales sujetos a confirmacion comercial.";
  sheet.getCell(`A${noteRowNumber}`).font = { italic: true, color: { argb: mutedText } };
  sheet.getCell(`A${noteRowNumber}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  [1, 2, 3, 4, 5, 6].forEach((rowNumber) => {
    sheet.getRow(rowNumber).eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: borderColor } },
        left: { style: "thin", color: { argb: borderColor } },
        bottom: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } },
      };
      cell.alignment = { vertical: "middle" };
    });
  });

  sheet.autoFilter = {
    from: { row: 10, column: 1 },
    to: { row: 10 + carrito.length, column: 8 },
  };

  sheet.getRow(10).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  sheet.getCell("F6").fill = { type: "pattern", pattern: "solid", fgColor: { argb: brandYellow } };
  sheet.getCell("F6").font = { bold: true, color: { argb: darkText } };

  const buffer = await workbook.xlsx.writeBuffer();
  const fechaArchivo = generatedAt.toISOString().slice(0, 10);
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), `Carrito_Comercial_Brich_${fechaArchivo}.xlsx`);
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
      <h4 title="${escapeHtml(producto.nombre || "Producto sin nombre")}">${escapeHtml(producto.nombre || "Producto sin nombre")}</h4>
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
    const coincideRegion = regionSeleccionada && normalizarRegion(producto.region) === regionSeleccionada;
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
    const region = normalizarRegion(regionSelect.value);
    if (!region) {
      alert("Selecciona una region.");
      return;
    }

    guardarRegion(region);
    regionModal.style.display = "none";
  });
}

if (cambiarRegion) {
  cambiarRegion.addEventListener("click", abrirSelectorRegion);
}

actualizarRegionActual();
actualizarCarrito();
cargarProductos();
