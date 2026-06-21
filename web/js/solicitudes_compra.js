document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const API_SOL = "/api/solicitudes-compra";
  const API_PRODUCTOS = "/api/productos";
  const IVA_TASA = 0.19;
  const headersJson = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
  };

  const solicitudesList = document.getElementById("solicitudesList");
  const buscarSolicitud = document.getElementById("buscarSolicitud");
  const filtroEstado = document.getElementById("filtroEstado");
  const btnRecargar = document.getElementById("btnRecargar");
  const btnNuevaSolicitud = document.getElementById("btnNuevaSolicitud");
  const solicitudForm = document.getElementById("solicitudForm");
  const solicitudId = document.getElementById("solicitudId");
  const formTitle = document.getElementById("formTitle");
  const folioLabel = document.getElementById("folioLabel");
  const estadoBadge = document.getElementById("estadoBadge");
  const formStatus = document.getElementById("formStatus");
  const btnGuardarSolicitud = document.getElementById("btnGuardarSolicitud");
  const btnEnviarSolicitud = document.getElementById("btnEnviarSolicitud");
  const btnAceptarSolicitud = document.getElementById("btnAceptarSolicitud");
  const btnRechazarSolicitud = document.getElementById("btnRechazarSolicitud");
  const btnVencerSolicitud = document.getElementById("btnVencerSolicitud");
  const btnImprimirSolicitud = document.getElementById("btnImprimirSolicitud");

  const clienteRazonSocial = document.getElementById("clienteRazonSocial");
  const clienteRut = document.getElementById("clienteRut");
  const clienteEmail = document.getElementById("clienteEmail");
  const clienteTelefono = document.getElementById("clienteTelefono");
  const clienteContacto = document.getElementById("clienteContacto");
  const clienteDireccion = document.getElementById("clienteDireccion");
  const validezDias = document.getElementById("validezDias");
  const observaciones = document.getElementById("observaciones");

  const buscarProducto = document.getElementById("buscarProducto");
  const productoSelect = document.getElementById("productoSelect");
  const itemCantidad = document.getElementById("itemCantidad");
  const btnAgregarItem = document.getElementById("btnAgregarItem");
  const itemsTable = document.getElementById("itemsTable");
  const totalNeto = document.getElementById("totalNeto");
  const totalIva = document.getElementById("totalIva");
  const totalGeneral = document.getElementById("totalGeneral");
  const printArea = document.getElementById("printArea");

  let solicitudes = [];
  let productos = [];
  let solicitudActual = null;

  function money(value) {
    return `$${Number(value || 0).toLocaleString("es-CL")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, tipo = "") {
    formStatus.textContent = message || "";
    formStatus.className = `status-line ${tipo}`.trim();
  }

  function productoActivo(producto) {
    if (typeof producto.activo === "boolean") return producto.activo;
    return producto.estado !== "inactivo";
  }

  async function requestJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headersJson,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.details || data.error || `Error HTTP ${res.status}`);
    }
    return data;
  }

  function payloadSolicitud() {
    return {
      cliente: {
        razonSocial: clienteRazonSocial.value.trim(),
        rut: clienteRut.value.trim(),
        email: clienteEmail.value.trim(),
        direccion: clienteDireccion.value.trim(),
        nombreContacto: clienteContacto.value.trim(),
        telefono: clienteTelefono.value.trim(),
      },
      validezDias: Number(validezDias.value),
      observaciones: observaciones.value.trim(),
    };
  }

  function limpiarFormulario() {
    solicitudActual = null;
    solicitudForm.reset();
    solicitudId.value = "";
    validezDias.value = 15;
    formTitle.textContent = "Nueva cotizacion";
    folioLabel.textContent = "Folio pendiente";
    setEstadoBadge("borrador");
    setStatus("");
    renderItems();
    renderPrintArea();
    marcarSolicitudActiva();
  }

  function setEstadoBadge(estado = "borrador") {
    estadoBadge.textContent = estado;
    estadoBadge.className = `badge ${estado}`.trim();
  }

  function poblarFormulario(solicitud) {
    solicitudActual = solicitud;
    solicitudId.value = solicitud._id;
    formTitle.textContent = "Editar cotizacion";
    folioLabel.textContent = solicitud.folio || "Folio pendiente";
    setEstadoBadge(solicitud.estado);

    clienteRazonSocial.value = solicitud.cliente?.razonSocial || "";
    clienteRut.value = solicitud.cliente?.rut || "";
    clienteEmail.value = solicitud.cliente?.email || "";
    clienteTelefono.value = solicitud.cliente?.telefono || "";
    clienteContacto.value = solicitud.cliente?.nombreContacto || "";
    clienteDireccion.value = solicitud.cliente?.direccion || "";
    validezDias.value = solicitud.validezDias || 15;
    observaciones.value = solicitud.observaciones || "";
    setStatus("");
    renderItems();
    renderPrintArea();
    marcarSolicitudActiva();
  }

  function renderSolicitudes() {
    const texto = buscarSolicitud.value.trim().toLowerCase();
    const estadoFiltro = filtroEstado.value;
    const lista = solicitudes.filter((sol) => {
      const coincideTexto = [
        sol.folio,
        sol.cliente?.razonSocial,
        sol.cliente?.rut,
        sol.estado,
      ].some((value) => String(value || "").toLowerCase().includes(texto));
      const coincideEstado = !estadoFiltro || sol.estado === estadoFiltro;
      return coincideTexto && coincideEstado;
    });

    solicitudesList.innerHTML = "";
    if (lista.length === 0) {
      solicitudesList.innerHTML = `<p class="status-line">No hay cotizaciones.</p>`;
      return;
    }

    lista.forEach((sol) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "solicitud-card";
      button.dataset.id = sol._id;
      button.innerHTML = `
        <strong>${escapeHtml(sol.folio)}</strong>
        <span>${escapeHtml(sol.cliente?.razonSocial || "")}</span>
        <span>${escapeHtml(sol.estado)} - ${money(sol.total)}</span>
      `;
      button.addEventListener("click", () => cargarSolicitud(sol._id));
      solicitudesList.appendChild(button);
    });

    marcarSolicitudActiva();
  }

  function marcarSolicitudActiva() {
    solicitudesList.querySelectorAll(".solicitud-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.id === solicitudActual?._id);
    });
  }

  function renderProductos() {
    const texto = buscarProducto.value.trim().toLowerCase();
    const disponibles = productos.filter((p) => {
      if (!productoActivo(p)) return false;
      if (!texto) return true;
      return [
        p.sku,
        p.nombre,
        p.categoria,
        p.region,
      ].some((value) => String(value || "").toLowerCase().includes(texto));
    });
    productoSelect.innerHTML = `<option value="">Seleccionar producto</option>`;

    disponibles.forEach((p) => {
      const option = document.createElement("option");
      option.value = p._id;
      option.textContent = `${p.sku || "Sin SKU"} - ${p.nombre} (${money(p.precio)})`;
      productoSelect.appendChild(option);
    });
  }

  function renderItems() {
    const items = solicitudActual?.items || [];
    itemsTable.innerHTML = "";

    if (items.length === 0) {
      itemsTable.innerHTML = `
        <tr>
          <td colspan="6">Sin items.</td>
        </tr>`;
    } else {
      items.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.nombre)}</td>
          <td>${money(item.precioUnitario)}</td>
          <td>
            <input class="qty-input" type="number" min="1" step="1" value="${item.cantidad}" data-id="${item._id}">
          </td>
          <td>${money(item.subtotal)}</td>
          <td>
            <button class="remove-item" type="button" data-id="${item._id}">Eliminar</button>
          </td>
        `;
        itemsTable.appendChild(tr);
      });
    }

    const neto = items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const iva = Math.round(neto * IVA_TASA);
    totalNeto.textContent = money(solicitudActual?.neto ?? neto);
    totalIva.textContent = money(solicitudActual?.iva ?? iva);
    totalGeneral.textContent = money(solicitudActual?.total ?? neto + iva);

    const editable = !solicitudActual || ["borrador", "enviada"].includes(solicitudActual.estado);
    const enviada = solicitudActual?.estado === "enviada";
    btnAgregarItem.disabled = !solicitudActual || !editable;
    productoSelect.disabled = !solicitudActual || !editable;
    buscarProducto.disabled = !solicitudActual || !editable;
    itemCantidad.disabled = !solicitudActual || !editable;
    btnEnviarSolicitud.disabled = !solicitudActual || solicitudActual.estado !== "borrador";
    btnAceptarSolicitud.disabled = !enviada;
    btnRechazarSolicitud.disabled = !enviada;
    btnVencerSolicitud.disabled = !solicitudActual || !["borrador", "enviada"].includes(solicitudActual.estado);
    btnImprimirSolicitud.disabled = !solicitudActual;
    btnGuardarSolicitud.disabled = Boolean(solicitudActual && !editable);
  }

  function fechaTexto(value) {
    const fecha = value ? new Date(value) : new Date();
    if (Number.isNaN(fecha.getTime())) return "";
    return fecha.toLocaleDateString("es-CL");
  }

  function renderPrintArea() {
    if (!solicitudActual) {
      printArea.innerHTML = "";
      return;
    }

    const items = solicitudActual.items || [];
    const rows = items.length > 0
      ? items.map((item) => `
          <tr>
            <td>${escapeHtml(item.sku)}</td>
            <td>${escapeHtml(item.nombre)}</td>
            <td>${money(item.precioUnitario)}</td>
            <td>${item.cantidad}</td>
            <td>${money(item.subtotal)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5">Sin items.</td></tr>`;

    printArea.innerHTML = `
      <div class="print-document">
        <header class="print-header">
          <div>
            <h1>Comercial Brich</h1>
            <p>Cotizacion ${escapeHtml(solicitudActual.folio || "")}</p>
          </div>
          <div>
            <strong>Fecha</strong>
            <span>${fechaTexto(solicitudActual.fecha || solicitudActual.createdAt)}</span>
          </div>
        </header>

        <section class="print-client">
          <h2>Cliente</h2>
          <div class="print-grid">
            <p><strong>Razon social:</strong> ${escapeHtml(solicitudActual.cliente?.razonSocial || "")}</p>
            <p><strong>RUT:</strong> ${escapeHtml(solicitudActual.cliente?.rut || "")}</p>
            <p><strong>Email:</strong> ${escapeHtml(solicitudActual.cliente?.email || "")}</p>
            <p><strong>Telefono:</strong> ${escapeHtml(solicitudActual.cliente?.telefono || "")}</p>
            <p><strong>Contacto:</strong> ${escapeHtml(solicitudActual.cliente?.nombreContacto || "")}</p>
            <p><strong>Direccion:</strong> ${escapeHtml(solicitudActual.cliente?.direccion || "")}</p>
          </div>
        </section>

        <table class="print-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Precio neto</th>
              <th>Cantidad</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <section class="print-totals">
          <p><span>Neto</span><strong>${money(solicitudActual.neto)}</strong></p>
          <p><span>IVA 19%</span><strong>${money(solicitudActual.iva)}</strong></p>
          <p><span>Total</span><strong>${money(solicitudActual.total)}</strong></p>
        </section>

        <section class="print-notes">
          <p><strong>Validez:</strong> ${solicitudActual.validezDias || 15} dias</p>
          <p><strong>Observaciones:</strong> ${escapeHtml(solicitudActual.observaciones || "")}</p>
        </section>
      </div>
    `;
  }

  async function cargarSolicitudes() {
    solicitudes = await requestJson(API_SOL);
    renderSolicitudes();
  }

  async function cargarProductos() {
    productos = await requestJson(API_PRODUCTOS);
    renderProductos();
  }

  async function cargarSolicitud(id) {
    try {
      const solicitud = await requestJson(`${API_SOL}/${id}`);
      poblarFormulario(solicitud);
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  solicitudForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("");
    btnGuardarSolicitud.disabled = true;

    try {
      const id = solicitudId.value;
      const solicitud = await requestJson(id ? `${API_SOL}/${id}` : API_SOL, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payloadSolicitud()),
      });

      setStatus(id ? "Cotizacion actualizada." : `Cotizacion creada: ${solicitud.folio}.`, "success");
      poblarFormulario(solicitud);
      await cargarSolicitudes();
    } catch (err) {
      setStatus(err.message, "error");
    } finally {
      btnGuardarSolicitud.disabled = false;
      renderItems();
    }
  });

  btnAgregarItem.addEventListener("click", async () => {
    if (!solicitudActual) {
      setStatus("Primero guarda la cotizacion.", "error");
      return;
    }

    try {
      const solicitud = await requestJson(`${API_SOL}/${solicitudActual._id}/items`, {
        method: "POST",
        body: JSON.stringify({
          productoId: productoSelect.value,
          cantidad: Number(itemCantidad.value),
        }),
      });
      productoSelect.value = "";
      itemCantidad.value = 1;
      poblarFormulario(solicitud);
      await cargarSolicitudes();
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  itemsTable.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("qty-input") || !solicitudActual) return;

    try {
      const solicitud = await requestJson(`${API_SOL}/${solicitudActual._id}/items/${e.target.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cantidad: Number(e.target.value) }),
      });
      poblarFormulario(solicitud);
      await cargarSolicitudes();
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  itemsTable.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("remove-item") || !solicitudActual) return;

    try {
      const solicitud = await requestJson(`${API_SOL}/${solicitudActual._id}/items/${e.target.dataset.id}`, {
        method: "DELETE",
      });
      poblarFormulario(solicitud);
      await cargarSolicitudes();
    } catch (err) {
      setStatus(err.message, "error");
    }
  });

  btnEnviarSolicitud.addEventListener("click", async () => {
    cambiarEstado("enviada");
  });

  btnAceptarSolicitud.addEventListener("click", () => cambiarEstado("aceptada"));
  btnRechazarSolicitud.addEventListener("click", () => cambiarEstado("rechazada"));
  btnVencerSolicitud.addEventListener("click", () => cambiarEstado("vencida"));
  btnImprimirSolicitud.addEventListener("click", () => {
    if (!solicitudActual) return;
    renderPrintArea();
    window.print();
  });

  async function cambiarEstado(estado) {
    if (!solicitudActual) return;

    try {
      const solicitud = await requestJson(`${API_SOL}/${solicitudActual._id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      setStatus(`Cotizacion marcada como ${estado}.`, "success");
      poblarFormulario(solicitud);
      await cargarSolicitudes();
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  btnNuevaSolicitud.addEventListener("click", limpiarFormulario);
  btnRecargar.addEventListener("click", cargarSolicitudes);
  buscarSolicitud.addEventListener("input", renderSolicitudes);
  filtroEstado.addEventListener("change", renderSolicitudes);
  buscarProducto.addEventListener("input", renderProductos);

  async function init() {
    try {
      limpiarFormulario();
      await Promise.all([cargarSolicitudes(), cargarProductos()]);
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  init();
});
