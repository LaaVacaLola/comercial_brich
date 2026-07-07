document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const API_SOL = "/api/solicitudes-compra";
  const API_CLIENTES = "/api/clientes";
  const headersJson = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
  };

  const buscarSolicitud = document.getElementById("buscarSolicitud");
  const filtroEstado = document.getElementById("filtroEstado");
  const btnRecargar = document.getElementById("btnRecargar");
  const btnCrearSolicitud = document.getElementById("btnCrearSolicitud");
  const btnGestionarClientes = document.getElementById("btnGestionarClientes");
  const solicitudesTable = document.getElementById("solicitudesTable");
  const printArea = document.getElementById("printArea");

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

  const clientesModal = document.getElementById("clientesModal");
  const cerrarClientesModal = document.getElementById("cerrarClientesModal");
  const btnNuevoCliente = document.getElementById("btnNuevoCliente");
  const buscarClienteGestion = document.getElementById("buscarClienteGestion");
  const clientesTable = document.getElementById("clientesTable");
  const clienteFormModal = document.getElementById("clienteFormModal");
  const cerrarClienteFormModal = document.getElementById("cerrarClienteFormModal");
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

  let solicitudes = [];
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

  function fechaTexto(value) {
    const fecha = value ? new Date(value) : new Date();
    if (Number.isNaN(fecha.getTime())) return "";
    return fecha.toLocaleDateString("es-CL");
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

    solicitudesTable.innerHTML = "";
    if (lista.length === 0) {
      solicitudesTable.innerHTML = `<tr><td colspan="7">No hay solicitudes para mostrar.</td></tr>`;
      return;
    }

    lista.forEach((sol) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(sol.folio || "")}</strong></td>
        <td>${escapeHtml(sol.cliente?.razonSocial || "")}</td>
        <td>${escapeHtml(sol.cliente?.rut || "")}</td>
        <td><span class="badge ${escapeHtml(sol.estado || "borrador")}">${escapeHtml(sol.estado || "borrador")}</span></td>
        <td>${money(sol.total)}</td>
        <td>${fechaTexto(sol.fecha || sol.createdAt)}</td>
        <td><button class="btn-secondary btn-ver-sol" type="button" data-id="${sol._id}">Ver</button></td>
      `;
      solicitudesTable.appendChild(tr);
    });
  }

  async function cargarSolicitudes() {
    solicitudes = await requestJson(API_SOL);
    renderSolicitudes();
  }

  async function cargarSolicitud(id) {
    solicitudActual = await requestJson(`${API_SOL}/${id}`);
    abrirSolicitudModal(solicitudActual);
  }

  function renderPrintArea() {
    if (!solicitudActual) {
      printArea.innerHTML = "";
      return;
    }

    const rows = (solicitudActual.items || []).map((item) => `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.nombre)}</td>
        <td>${money(item.precioUnitario)}</td>
        <td>${item.cantidad}</td>
        <td>${money(item.subtotal)}</td>
      </tr>
    `).join("") || `<tr><td colspan="5">Sin items.</td></tr>`;

    printArea.innerHTML = `
      <div class="print-document">
        <header class="print-header">
          <div>
            <h1>Comercial Brich</h1>
            <p>Solicitud ${escapeHtml(solicitudActual.folio || "")}</p>
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
            <tr><th>SKU</th><th>Producto</th><th>Precio neto</th><th>Cantidad</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="print-totals">
          <p><span>Neto</span><strong>${money(solicitudActual.neto)}</strong></p>
          <p><span>IVA 19%</span><strong>${money(solicitudActual.iva)}</strong></p>
          <p><span>Total</span><strong>${money(solicitudActual.total)}</strong></p>
        </section>
      </div>
    `;
  }

  function abrirSolicitudModal(solicitud) {
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

    solicitudModalTitle.textContent = `Solicitud ${solicitud.folio || ""}`;
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
            <tr><th>SKU</th><th>Producto</th><th>Precio neto</th><th>Cantidad</th><th>Subtotal</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    const enviada = solicitud.estado === "enviada";
    modalEnviarSolicitud.disabled = solicitud.estado !== "borrador";
    modalAceptarSolicitud.disabled = !enviada;
    modalRechazarSolicitud.disabled = !enviada;
    modalVencerSolicitud.disabled = !["borrador", "enviada"].includes(solicitud.estado);
    modalImprimirSolicitud.disabled = false;
    solicitudModal.style.display = "flex";
  }

  function cerrarSolicitud() {
    solicitudModal.style.display = "none";
  }

  async function cambiarEstado(estado) {
    if (!solicitudActual) return;
    try {
      solicitudActual = await requestJson(`${API_SOL}/${solicitudActual._id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      await cargarSolicitudes();
      abrirSolicitudModal(solicitudActual);
    } catch (err) {
      alert(err.message);
    }
  }

  async function cargarClientes() {
    clientes = await requestJson(API_CLIENTES);
    renderClientes();
  }

  function clienteTexto(cliente) {
    return `${cliente.razonSocial || ""} ${cliente.rut || ""} ${cliente.nombreContacto || ""} ${cliente.email || ""}`.toLowerCase();
  }

  function renderClientes() {
    const texto = buscarClienteGestion.value.trim().toLowerCase();
    const lista = clientes.filter((cliente) => !texto || clienteTexto(cliente).includes(texto));
    clientesTable.innerHTML = "";

    if (lista.length === 0) {
      clientesTable.innerHTML = `<tr><td colspan="6">No hay clientes.</td></tr>`;
      return;
    }

    lista.forEach((cliente) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(cliente.razonSocial)}</td>
        <td>${escapeHtml(cliente.rut)}</td>
        <td>${escapeHtml(cliente.nombreContacto)}</td>
        <td>${escapeHtml(cliente.email)}</td>
        <td>${cliente.activo === false ? "Inactivo" : "Activo"}</td>
        <td><button class="btn-secondary btn-editar-cliente" type="button" data-id="${cliente._id}">Editar</button></td>
      `;
      clientesTable.appendChild(tr);
    });
  }

  function setClienteModalStatus(message, tipo = "") {
    clienteModalStatus.textContent = message || "";
    clienteModalStatus.className = `status-line ${tipo}`.trim();
  }

  function abrirClienteForm(cliente = null) {
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
    clienteFormModal.style.display = "flex";
  }

  function cerrarClienteForm() {
    clienteFormModal.style.display = "none";
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
    try {
      const id = clienteFormId.value;
      await requestJson(id ? `${API_CLIENTES}/${id}` : API_CLIENTES, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payloadCliente()),
      });
      await cargarClientes();
      setClienteModalStatus("Cliente guardado correctamente.", "success");
      setTimeout(cerrarClienteForm, 350);
    } catch (err) {
      setClienteModalStatus(err.message, "error");
    }
  }

  btnCrearSolicitud.addEventListener("click", () => {
    window.location.href = "solicitud_compra_nueva.html";
  });
  btnGestionarClientes.addEventListener("click", async () => {
    await cargarClientes();
    clientesModal.style.display = "flex";
  });
  btnRecargar.addEventListener("click", cargarSolicitudes);
  buscarSolicitud.addEventListener("input", renderSolicitudes);
  filtroEstado.addEventListener("change", renderSolicitudes);
  solicitudesTable.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains("btn-ver-sol") && id) cargarSolicitud(id);
  });

  cerrarSolicitudModal.addEventListener("click", cerrarSolicitud);
  modalEnviarSolicitud.addEventListener("click", () => cambiarEstado("enviada"));
  modalAceptarSolicitud.addEventListener("click", () => cambiarEstado("aceptada"));
  modalRechazarSolicitud.addEventListener("click", () => cambiarEstado("rechazada"));
  modalVencerSolicitud.addEventListener("click", () => cambiarEstado("vencida"));
  modalImprimirSolicitud.addEventListener("click", () => {
    renderPrintArea();
    window.print();
  });

  cerrarClientesModal.addEventListener("click", () => {
    clientesModal.style.display = "none";
  });
  btnNuevoCliente.addEventListener("click", () => abrirClienteForm());
  buscarClienteGestion.addEventListener("input", renderClientes);
  clientesTable.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (!e.target.classList.contains("btn-editar-cliente") || !id) return;
    const cliente = clientes.find((item) => item._id === id);
    if (cliente) abrirClienteForm(cliente);
  });
  cerrarClienteFormModal.addEventListener("click", cerrarClienteForm);
  clienteForm.addEventListener("submit", guardarCliente);

  window.addEventListener("click", (e) => {
    if (e.target === solicitudModal) cerrarSolicitud();
    if (e.target === clientesModal) clientesModal.style.display = "none";
    if (e.target === clienteFormModal) cerrarClienteForm();
  });

  async function init() {
    try {
      await cargarSolicitudes();
      await cargarClientes();
    } catch (err) {
      solicitudesTable.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  init();
});
