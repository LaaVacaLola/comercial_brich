document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const API_SOL = "/api/solicitudes-compra";
  const API_PRODUCTOS = "/api/productos";
  const API_CLIENTES = "/api/clientes";
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

  const buscarCliente = document.getElementById("buscarCliente");
  const clienteSelect = document.getElementById("clienteSelect");
  const btnNuevoCliente = document.getElementById("btnNuevoCliente");
  const btnEditarCliente = document.getElementById("btnEditarCliente");
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

  const clienteModal = document.getElementById("clienteModal");
  const cerrarClienteModal = document.getElementById("cerrarClienteModal");
  const clienteForm = document.getElementById("clienteForm");
  const clienteFormId = document.getElementById("clienteFormId");
  const clienteModalTitle = document.getElementById("clienteModalTitle");
  const clienteModalStatus = document.getElementById("clienteModalStatus");
  const clienteFormRazonSocial = document.getElementById("clienteFormRazonSocial");
  const clienteFormRut = document.getElementById("clienteFormRut");
  const clienteFormEmail = document.getElementById("clienteFormEmail");
  const clienteFormTelefono = document.getElementById("clienteFormTelefono");
  const clienteFormContacto = document.getElementById("clienteFormContacto");
  const clienteFormDireccion = document.getElementById("clienteFormDireccion");
  const clienteFormActivo = document.getElementById("clienteFormActivo");

  const solicitudModal = document.getElementById("solicitudModal");
  const cerrarSolicitudModal = document.getElementById("cerrarSolicitudModal");
  const solicitudModalTitle = document.getElementById("solicitudModalTitle");
  const solicitudModalCliente = document.getElementById("solicitudModalCliente");
  const solicitudModalEstado = document.getElementById("solicitudModalEstado");
  const solicitudModalBody = document.getElementById("solicitudModalBody");
  const modalEnviarSolicitud = document.getElementById("modalEnviarSolicitud");
  const modalAceptarSolicitud = document.getElementById("modalAceptarSolicitud");
  const modalRechazarSolicitud = document.getElementById("modalRechazarSolicitud");
  const modalVencerSolicitud = document.getElementById("modalVencerSolicitud");
  const modalImprimirSolicitud = document.getElementById("modalImprimirSolicitud");

  let solicitudes = [];
  let productos = [];
  let clientes = [];
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

  function setClienteModalStatus(message, tipo = "") {
    clienteModalStatus.textContent = message || "";
    clienteModalStatus.className = `status-line ${tipo}`.trim();
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
    if (!clienteSelect.value && !solicitudActual) {
      throw new Error("Selecciona un cliente antes de guardar la cotizacion.");
    }

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
    clienteSelect.value = "";
    buscarCliente.value = "";
    validezDias.value = 15;
    formTitle.textContent = "Nueva cotizacion";
    folioLabel.textContent = "Folio pendiente";
    setEstadoBadge("borrador");
    setStatus("");
    renderItems();
    renderPrintArea();
    marcarSolicitudActiva();
    renderClientes();
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
    seleccionarClientePorSnapshot(solicitud.cliente);
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
      button.addEventListener("click", async () => {
        const solicitud = await cargarSolicitud(sol._id);
        if (solicitud) abrirSolicitudModal(solicitud);
      });
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

  function clienteTexto(cliente) {
    return `${cliente.razonSocial || ""} ${cliente.rut || ""} ${cliente.nombreContacto || ""} ${cliente.email || ""}`.toLowerCase();
  }

  function renderClientes() {
    const selected = clienteSelect.value;
    const texto = buscarCliente.value.trim().toLowerCase();
    const disponibles = clientes.filter((cliente) => !texto || clienteTexto(cliente).includes(texto));
    clienteSelect.innerHTML = `<option value="">Seleccionar cliente</option>`;

    disponibles.forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente._id;
      option.textContent = `${cliente.razonSocial} - ${cliente.rut}`;
      clienteSelect.appendChild(option);
    });

    if (selected && clientes.some((cliente) => cliente._id === selected)) {
      clienteSelect.value = selected;
    }

    btnEditarCliente.disabled = !clienteSelect.value;
  }

  function llenarDatosCliente(cliente = {}) {
    clienteRazonSocial.value = cliente.razonSocial || "";
    clienteRut.value = cliente.rut || "";
    clienteEmail.value = cliente.email || "";
    clienteTelefono.value = cliente.telefono || "";
    clienteContacto.value = cliente.nombreContacto || "";
    clienteDireccion.value = cliente.direccion || "";
  }

  function seleccionarCliente(id) {
    const cliente = clientes.find((item) => item._id === id);
    clienteSelect.value = cliente?._id || "";
    llenarDatosCliente(cliente || {});
    btnEditarCliente.disabled = !cliente;
  }

  function seleccionarClientePorSnapshot(clienteSnapshot = {}) {
    const cliente = clientes.find((item) => item.rut === clienteSnapshot?.rut);
    clienteSelect.value = cliente?._id || "";
    buscarCliente.value = "";
    renderClientes();
    if (cliente) clienteSelect.value = cliente._id;
    btnEditarCliente.disabled = !clienteSelect.value;
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

  async function cargarClientes() {
    clientes = await requestJson(API_CLIENTES);
    renderClientes();
  }

  async function cargarSolicitud(id) {
    try {
      const solicitud = await requestJson(`${API_SOL}/${id}`);
      poblarFormulario(solicitud);
      return solicitud;
    } catch (err) {
      setStatus(err.message, "error");
      return null;
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
      abrirSolicitudModal(solicitud);
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
      if (solicitudModal.style.display === "flex") abrirSolicitudModal(solicitud);
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  function abrirClienteModal(cliente = null) {
    clienteForm.reset();
    setClienteModalStatus("");
    clienteFormId.value = cliente?._id || "";
    clienteModalTitle.textContent = cliente ? "Editar cliente" : "Nuevo cliente";
    clienteFormRazonSocial.value = cliente?.razonSocial || "";
    clienteFormRut.value = cliente?.rut || "";
    clienteFormEmail.value = cliente?.email || "";
    clienteFormTelefono.value = cliente?.telefono || "";
    clienteFormContacto.value = cliente?.nombreContacto || "";
    clienteFormDireccion.value = cliente?.direccion || "";
    clienteFormActivo.value = cliente?.activo === false ? "false" : "true";
    clienteModal.style.display = "flex";
    clienteFormRazonSocial.focus();
  }

  function cerrarModalCliente() {
    clienteModal.style.display = "none";
  }

  function payloadCliente() {
    return {
      razonSocial: clienteFormRazonSocial.value.trim(),
      rut: clienteFormRut.value.trim(),
      email: clienteFormEmail.value.trim(),
      telefono: clienteFormTelefono.value.trim(),
      nombreContacto: clienteFormContacto.value.trim(),
      direccion: clienteFormDireccion.value.trim(),
      activo: clienteFormActivo.value === "true",
    };
  }

  async function guardarCliente(e) {
    e.preventDefault();
    setClienteModalStatus("");

    try {
      const id = clienteFormId.value;
      const cliente = await requestJson(id ? `${API_CLIENTES}/${id}` : API_CLIENTES, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payloadCliente()),
      });
      await cargarClientes();
      buscarCliente.value = "";
      renderClientes();
      seleccionarCliente(cliente._id);
      setClienteModalStatus("Cliente guardado correctamente.", "success");
      setTimeout(cerrarModalCliente, 350);
    } catch (err) {
      setClienteModalStatus(err.message, "error");
    }
  }

  function renderSolicitudModal(solicitud) {
    const items = solicitud.items || [];
    const rows = items.length
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

    solicitudModalTitle.textContent = `Cotizacion ${solicitud.folio || ""}`;
    solicitudModalCliente.textContent = `${solicitud.cliente?.razonSocial || ""} | ${solicitud.cliente?.rut || ""}`;
    solicitudModalEstado.textContent = solicitud.estado || "borrador";
    solicitudModalEstado.className = `badge ${solicitud.estado || "borrador"}`.trim();
    solicitudModalBody.innerHTML = `
      <div class="modal-grid">
        <p><strong>Email</strong><span>${escapeHtml(solicitud.cliente?.email || "")}</span></p>
        <p><strong>Telefono</strong><span>${escapeHtml(solicitud.cliente?.telefono || "")}</span></p>
        <p><strong>Contacto</strong><span>${escapeHtml(solicitud.cliente?.nombreContacto || "")}</span></p>
        <p><strong>Direccion</strong><span>${escapeHtml(solicitud.cliente?.direccion || "")}</span></p>
        <p><strong>Validez</strong><span>${solicitud.validezDias || 15} dias</span></p>
        <p><strong>Total</strong><span>${money(solicitud.total)}</span></p>
      </div>
      <div class="table-wrap">
        <table>
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
      </div>
      <div class="totals">
        <div><span>Neto</span><strong>${money(solicitud.neto)}</strong></div>
        <div><span>IVA 19%</span><strong>${money(solicitud.iva)}</strong></div>
        <div><span>Total</span><strong>${money(solicitud.total)}</strong></div>
      </div>
    `;

    const enviada = solicitud.estado === "enviada";
    modalEnviarSolicitud.disabled = solicitud.estado !== "borrador";
    modalAceptarSolicitud.disabled = !enviada;
    modalRechazarSolicitud.disabled = !enviada;
    modalVencerSolicitud.disabled = !["borrador", "enviada"].includes(solicitud.estado);
    modalImprimirSolicitud.disabled = false;
  }

  function abrirSolicitudModal(solicitud) {
    solicitudActual = solicitud;
    renderSolicitudModal(solicitud);
    solicitudModal.style.display = "flex";
  }

  function cerrarModalSolicitud() {
    solicitudModal.style.display = "none";
  }

  btnNuevaSolicitud.addEventListener("click", limpiarFormulario);
  btnRecargar.addEventListener("click", cargarSolicitudes);
  buscarSolicitud.addEventListener("input", renderSolicitudes);
  filtroEstado.addEventListener("change", renderSolicitudes);
  buscarProducto.addEventListener("input", renderProductos);
  buscarCliente.addEventListener("input", renderClientes);
  clienteSelect.addEventListener("change", () => seleccionarCliente(clienteSelect.value));
  btnNuevoCliente.addEventListener("click", () => abrirClienteModal());
  btnEditarCliente.addEventListener("click", () => {
    const cliente = clientes.find((item) => item._id === clienteSelect.value);
    if (cliente) abrirClienteModal(cliente);
  });
  cerrarClienteModal.addEventListener("click", cerrarModalCliente);
  clienteForm.addEventListener("submit", guardarCliente);
  cerrarSolicitudModal.addEventListener("click", cerrarModalSolicitud);
  modalEnviarSolicitud.addEventListener("click", () => cambiarEstado("enviada"));
  modalAceptarSolicitud.addEventListener("click", () => cambiarEstado("aceptada"));
  modalRechazarSolicitud.addEventListener("click", () => cambiarEstado("rechazada"));
  modalVencerSolicitud.addEventListener("click", () => cambiarEstado("vencida"));
  modalImprimirSolicitud.addEventListener("click", () => {
    if (!solicitudActual) return;
    renderPrintArea();
    window.print();
  });
  window.addEventListener("click", (e) => {
    if (e.target === clienteModal) cerrarModalCliente();
    if (e.target === solicitudModal) cerrarModalSolicitud();
  });

  async function init() {
    try {
      limpiarFormulario();
      await Promise.all([cargarSolicitudes(), cargarProductos(), cargarClientes()]);
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  init();
});
