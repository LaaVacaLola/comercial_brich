document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const API = "/api/productos";
  const headersJson = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
  };

  const tabla = document.getElementById("tablaProductos");
  const filtroProductos = document.getElementById("filtroProductos");
  const btnAgregarProducto = document.getElementById("btnAgregarProducto");
  const btnNormalizarPrecios = document.getElementById("btnNormalizarPrecios");
  const catalogoEstado = document.getElementById("catalogoEstado");

  const productoModal = document.getElementById("productoModal");
  const closeProductoModal = document.getElementById("closeProductoModal");
  const productoForm = document.getElementById("productoForm");
  const productoModalTitle = document.getElementById("productoModalTitle");
  const productoSubmit = document.getElementById("productoSubmit");
  const productoFormEstado = document.getElementById("productoFormEstado");
  const productoId = document.getElementById("productoId");
  const productoSku = document.getElementById("productoSku");
  const productoNombreInput = document.getElementById("productoNombreInput");
  const productoDescripcion = document.getElementById("productoDescripcion");
  const productoPrecio = document.getElementById("productoPrecio");
  const productoUnidad = document.getElementById("productoUnidad");
  const productoCategoria = document.getElementById("productoCategoria");
  const productoRegion = document.getElementById("productoRegion");
  const productoImagen = document.getElementById("productoImagen");
  const productoActivo = document.getElementById("productoActivo");
  const productoAprobado = document.getElementById("productoAprobado");

  const ofertaModal = document.getElementById("ofertaModal");
  const closeModal = document.getElementById("closeModal");
  const productoNombre = document.getElementById("productoNombre");
  const ofertaForm = document.getElementById("ofertaForm");
  const ofertaPorcentaje = document.getElementById("ofertaPorcentaje");
  const ofertaMonto = document.getElementById("ofertaMonto");
  const ofertaInicio = document.getElementById("ofertaInicio");
  const ofertaFin = document.getElementById("ofertaFin");
  const normalizarPreciosModal = document.getElementById("normalizarPreciosModal");
  const closeNormalizarPreciosModal = document.getElementById("closeNormalizarPreciosModal");
  const confirmNormalizarPrecios = document.getElementById("confirmNormalizarPrecios");
  const normalizarPreciosResultado = document.getElementById("normalizarPreciosResultado");

  let productos = [];
  let productoOfertaID = null;
  let productoOfertaPrecio = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function productoEstaActivo(producto) {
    if (typeof producto.activo === "boolean") return producto.activo;
    return producto.estado !== "inactivo";
  }

  function formatCLP(value) {
    return `$${Number(value || 0).toLocaleString("es-CL")}`;
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

    if (porcentajeOferta <= 0 && descuento <= 0) return null;

    return {
      porcentaje: Math.round(porcentajeOferta * 100) / 100,
      precioOferta,
    };
  }

  function renderOfertaActiva(producto) {
    const oferta = ofertaActiva(producto);
    if (!oferta) return '<span class="muted-cell">Sin oferta</span>';
    return `<span class="offer-badge">${oferta.porcentaje.toLocaleString("es-CL")}%</span>`;
  }

  function renderPrecio(producto) {
    const oferta = ofertaActiva(producto);
    const precio = Number(producto.precio || 0);

    if (!oferta) return `<span class="price-normal">${formatCLP(precio)}</span>`;

    return `
      <span class="price-offer">${formatCLP(oferta.precioOferta)}</span>
      <span class="price-original">${formatCLP(precio)}</span>
    `;
  }

  function setEstado(message, tipo = "") {
    catalogoEstado.textContent = message || "";
    catalogoEstado.className = `catalogo-estado ${tipo}`.trim();
  }

  function setFormEstado(message, tipo = "") {
    productoFormEstado.textContent = message || "";
    productoFormEstado.className = `form-status ${tipo}`.trim();
  }

  function filtrarProductos() {
    const texto = filtroProductos.value.trim().toLowerCase();
    if (!texto) return productos;

    return productos.filter((p) => {
      return [
        p.sku,
        p.nombre,
        p.categoria,
        p.region,
        p.unidad,
      ].some((value) => String(value || "").toLowerCase().includes(texto));
    });
  }

  async function cargarProductos() {
    setEstado("Cargando productos...");
    tabla.innerHTML = `
      <tr>
        <td colspan="8">Cargando productos...</td>
      </tr>`;

    try {
      const res = await fetch(API, { headers: headersJson });

      if (!res.ok) {
        tabla.innerHTML = `
          <tr>
            <td colspan="8">Error cargando productos (HTTP ${res.status})</td>
          </tr>`;
        setEstado("No se pudieron cargar los productos.", "error");
        return;
      }

      productos = await res.json();
      renderTabla();
      setEstado(`${productos.length} productos cargados.`, "success");
    } catch (err) {
      console.error(err);
      tabla.innerHTML = `
        <tr>
          <td colspan="8">Error cargando productos</td>
        </tr>`;
      setEstado("Error de conexion al cargar productos.", "error");
    }
  }

  async function normalizarSkusAlEntrar() {
    try {
      const res = await fetch(`${API}/skus/normalizar`, {
        method: "PUT",
        headers: headersJson,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEstado(data.details || data.error || `No se pudieron verificar los SKU (HTTP ${res.status})`, "error");
        return;
      }

      if (data.actualizados > 0) {
        setEstado(`${data.actualizados} SKU generados automaticamente.`, "success");
      }
    } catch (err) {
      console.error(err);
      setEstado("No se pudieron verificar los SKU automaticamente.", "error");
    }
  }

  function renderTabla() {
    const lista = filtrarProductos();
    tabla.innerHTML = "";

    if (lista.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="8">No hay productos para mostrar.</td>
        </tr>`;
      return;
    }

    lista.forEach((p) => {
      const tr = document.createElement("tr");
      const activo = productoEstaActivo(p);

      tr.innerHTML = `
        <td>${escapeHtml(p.sku || "Sin SKU")}</td>
        <td>
          <img
            src="${escapeHtml(p.imagen || "../img/no-image.png")}"
            alt="${escapeHtml(p.nombre)}"
            class="img-producto"
          >
        </td>
        <td>
          <strong>${escapeHtml(p.nombre)}</strong>
          ${activo ? "" : '<span class="inactive-flag">Desactivado</span>'}
          <span class="muted-cell">${escapeHtml(p.descripcion || "")}</span>
        </td>
        <td>${escapeHtml(p.categoria || "-")}</td>
        <td>${escapeHtml(p.region || "-")}</td>
        <td>${renderOfertaActiva(p)}</td>
        <td class="price-cell">${renderPrecio(p)}</td>
        <td class="actions-cell">
          <button class="btn-warning btn-editar" data-id="${p._id}" type="button">Editar</button>
          <button class="btn-secondary btn-oferta" data-id="${p._id}" type="button">Oferta</button>
        </td>
      `;

      tabla.appendChild(tr);
    });
  }

  function abrirProductoModal(producto = null) {
    productoForm.reset();
    setFormEstado("");

    if (producto) {
      productoModalTitle.textContent = "Editar producto";
      productoSubmit.textContent = "Guardar cambios";
      productoId.value = producto._id;
      productoSku.value = producto.sku || "Se generara al guardar";
      productoNombreInput.value = producto.nombre || "";
      productoDescripcion.value = producto.descripcion || "";
      productoPrecio.value = producto.precio ?? 0;
      productoUnidad.value = producto.unidad || "";
      productoCategoria.value = producto.categoria || "";
      productoRegion.value = producto.region || "";
      productoImagen.value = producto.imagen || "";
      productoActivo.checked = productoEstaActivo(producto);
      productoAprobado.checked = Boolean(producto.aprobado);
    } else {
      productoModalTitle.textContent = "Nuevo producto";
      productoSubmit.textContent = "Crear producto";
      productoId.value = "";
      productoSku.value = "Se genera automaticamente";
      productoPrecio.value = 0;
      productoActivo.checked = true;
      productoAprobado.checked = false;
    }

    productoModal.style.display = "flex";
    productoNombreInput.focus();
  }

  function cerrarProductoModal() {
    productoModal.style.display = "none";
  }

  function payloadProductoDesdeForm() {
    const precio = Number(productoPrecio.value);

    if (!productoNombreInput.value.trim()) {
      throw new Error("El nombre es obligatorio.");
    }

    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error("El precio debe ser un numero mayor o igual a 0.");
    }

    return {
      nombre: productoNombreInput.value.trim(),
      descripcion: productoDescripcion.value.trim(),
      precio,
      unidad: productoUnidad.value.trim(),
      categoria: productoCategoria.value.trim(),
      region: productoRegion.value.trim(),
      imagen: productoImagen.value.trim(),
      activo: productoActivo.checked,
      aprobado: productoAprobado.checked,
    };
  }

  async function guardarProducto(e) {
    e.preventDefault();
    setFormEstado("");

    let payload;
    try {
      payload = payloadProductoDesdeForm();
    } catch (err) {
      setFormEstado(err.message, "error");
      return;
    }

    const id = productoId.value;
    const editando = Boolean(id);
    productoSubmit.disabled = true;
    productoSubmit.textContent = editando ? "Guardando..." : "Creando...";

    try {
      const res = await fetch(editando ? `${API}/${id}` : API, {
        method: editando ? "PUT" : "POST",
        headers: headersJson,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormEstado(data.details || data.error || `Error HTTP ${res.status}`, "error");
        return;
      }

      setFormEstado(editando ? "Producto actualizado." : `Producto creado con SKU ${data.sku}.`, "success");
      await cargarProductos();
      setTimeout(cerrarProductoModal, 500);
    } catch (err) {
      console.error(err);
      setFormEstado("Error de conexion al guardar producto.", "error");
    } finally {
      productoSubmit.disabled = false;
      productoSubmit.textContent = editando ? "Guardar cambios" : "Crear producto";
    }
  }

  tabla.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    const producto = productos.find((p) => p._id === id);
    if (!producto) return;

    if (e.target.classList.contains("btn-editar")) {
      abrirProductoModal(producto);
    }

    if (e.target.classList.contains("btn-oferta")) {
      productoOfertaID = id;
      productoOfertaPrecio = Number(producto.precio || 0);
      productoNombre.textContent = producto.nombre || "";
      ofertaForm.reset();
      ofertaModal.style.display = "flex";
    }
  });

  btnAgregarProducto.addEventListener("click", () => abrirProductoModal());
  closeProductoModal.addEventListener("click", cerrarProductoModal);
  productoForm.addEventListener("submit", guardarProducto);
  filtroProductos.addEventListener("input", renderTabla);

  closeModal.addEventListener("click", () => {
    ofertaModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === productoModal) cerrarProductoModal();
    if (e.target === ofertaModal) ofertaModal.style.display = "none";
    if (e.target === normalizarPreciosModal) normalizarPreciosModal.style.display = "none";
  });

  function calcularMontoDesdePorcentaje() {
    const porcentaje = Number(ofertaPorcentaje.value);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || !productoOfertaPrecio) return;
    ofertaMonto.value = Math.round((productoOfertaPrecio * porcentaje) / 100);
  }

  function calcularPorcentajeDesdeMonto() {
    const monto = Number(ofertaMonto.value);
    if (!Number.isFinite(monto) || monto < 0 || !productoOfertaPrecio) return;
    ofertaPorcentaje.value = ((monto / productoOfertaPrecio) * 100).toFixed(2);
  }

  ofertaPorcentaje.addEventListener("input", calcularMontoDesdePorcentaje);
  ofertaMonto.addEventListener("input", calcularPorcentajeDesdeMonto);

  ofertaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!productoOfertaID) return;

    if (!ofertaPorcentaje.value && !ofertaMonto.value) {
      alert("Ingresa porcentaje o monto de descuento");
      return;
    }

    try {
      const res = await fetch(`${API}/${productoOfertaID}`, {
        method: "PUT",
        headers: headersJson,
        body: JSON.stringify({
          oferta: {
            fecha_inicio: ofertaInicio.value,
            fecha_termino: ofertaFin.value,
            porcentaje_descuento: ofertaPorcentaje.value,
            monto_descuento: ofertaMonto.value,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Error al guardar oferta: " + (err.details || err.error || "HTTP " + res.status));
        return;
      }

      alert("Oferta guardada correctamente");
      ofertaModal.style.display = "none";
      cargarProductos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar oferta");
    }
  });

  btnNormalizarPrecios.addEventListener("click", () => {
    normalizarPreciosResultado.textContent = "Todavia no se ha ejecutado el proceso.";
    confirmNormalizarPrecios.disabled = false;
    confirmNormalizarPrecios.textContent = "Ejecutar normalizacion";
    normalizarPreciosModal.style.display = "flex";
  });

  closeNormalizarPreciosModal.addEventListener("click", () => {
    normalizarPreciosModal.style.display = "none";
  });

  confirmNormalizarPrecios.addEventListener("click", async () => {
    confirmNormalizarPrecios.disabled = true;
    confirmNormalizarPrecios.textContent = "Procesando...";
    normalizarPreciosResultado.textContent = "Normalizando precios, espera un momento...";

    try {
      const res = await fetch(`${API}/precios/normalizar`, {
        method: "PUT",
        headers: headersJson,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        normalizarPreciosResultado.textContent = data.details || data.error || `Error HTTP ${res.status}`;
        confirmNormalizarPrecios.disabled = false;
        confirmNormalizarPrecios.textContent = "Reintentar";
        return;
      }

      normalizarPreciosResultado.innerHTML = `
        <strong>Proceso completado.</strong><br>
        Productos revisados: ${data.total}<br>
        Productos actualizados: ${data.actualizados}<br>
        Sin cambios: ${data.sinCambios}<br>
        Omitidos por precio invalido: ${data.omitidos}
      `;
      confirmNormalizarPrecios.textContent = "Proceso ejecutado";
      cargarProductos();
    } catch (err) {
      console.error(err);
      normalizarPreciosResultado.textContent = "Error de conexion al normalizar precios";
      confirmNormalizarPrecios.disabled = false;
      confirmNormalizarPrecios.textContent = "Reintentar";
    }
  });

  (async () => {
    await normalizarSkusAlEntrar();
    await cargarProductos();
  })();
});
