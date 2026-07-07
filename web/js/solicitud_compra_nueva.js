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

  const buscarProducto = document.getElementById("buscarProducto");
  const productosList = document.getElementById("productosList");
  const btnGuardarSolicitud = document.getElementById("btnGuardarSolicitud");
  const folioLabel = document.getElementById("folioLabel");
  const estadoBadge = document.getElementById("estadoBadge");
  const clienteId = document.getElementById("clienteId");
  const clienteSeleccionadoNombre = document.getElementById("clienteSeleccionadoNombre");
  const clienteSeleccionadoDetalle = document.getElementById("clienteSeleccionadoDetalle");
  const btnSeleccionarCliente = document.getElementById("btnSeleccionarCliente");
  const validezDias = document.getElementById("validezDias");
  const observaciones = document.getElementById("observaciones");
  const formStatus = document.getElementById("formStatus");
  const itemsTable = document.getElementById("itemsTable");
  const totalNeto = document.getElementById("totalNeto");
  const totalIva = document.getElementById("totalIva");
  const totalGeneral = document.getElementById("totalGeneral");

  const seleccionarClienteModal = document.getElementById("seleccionarClienteModal");
  const cerrarSeleccionClienteModal = document.getElementById("cerrarSeleccionClienteModal");
  const buscarCliente = document.getElementById("buscarCliente");
  const clientesList = document.getElementById("clientesList");
  const btnNuevoCliente = document.getElementById("btnNuevoCliente");
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

  const solicitudCreadaModal = document.getElementById("solicitudCreadaModal");
  const cerrarSolicitudCreadaModal = document.getElementById("cerrarSolicitudCreadaModal");
  const solicitudCreadaTitle = document.getElementById("solicitudCreadaTitle");
  const solicitudCreadaBody = document.getElementById("solicitudCreadaBody");
  const btnNuevaOcLimpia = document.getElementById("btnNuevaOcLimpia");

  let productos = [];
  let clientes = [];
  let clienteSeleccionado = null;
  let items = [];

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

  function productoActivo(producto) {
    if (typeof producto.activo === "boolean") return producto.activo;
    return producto.estado !== "inactivo";
  }

  function setStatus(message, tipo = "") {
    formStatus.textContent = message || "";
    formStatus.className = `status-line ${tipo}`.trim();
  }

  function setClienteModalStatus(message, tipo = "") {
    clienteModalStatus.textContent = message || "";
    clienteModalStatus.className = `status-line ${tipo}`.trim();
  }

  async function cargarProductos() {
    productos = await requestJson(API_PRODUCTOS);
    renderProductos();
  }

  async function cargarClientes() {
    clientes = await requestJson(API_CLIENTES);
    renderClientes();
  }

  function renderProductos() {
    const texto = buscarProducto.value.trim().toLowerCase();
    const lista = productos.filter((producto) => {
      if (!productoActivo(producto)) return false;
      if (!texto) return true;
      return [
        producto.sku,
        producto.nombre,
        producto.categoria,
        producto.region,
      ].some((value) => String(value || "").toLowerCase().includes(texto));
    });

    productosList.innerHTML = "";
    if (lista.length === 0) {
      productosList.innerHTML = `<p class="status-line">No hay productos.</p>`;
      return;
    }

    lista.forEach((producto) => {
      const card = document.createElement("div");
      card.className = "product-pick-card";
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(producto.nombre || "")}</strong>
          <span>${escapeHtml(producto.sku || "Sin SKU")} | ${money(producto.precio)}</span>
        </div>
        <button class="btn-secondary btn-agregar-producto" type="button" data-id="${producto._id}">Agregar</button>
      `;
      productosList.appendChild(card);
    });
  }

  function clienteTexto(cliente) {
    return `${cliente.razonSocial || ""} ${cliente.rut || ""} ${cliente.nombreContacto || ""} ${cliente.email || ""}`.toLowerCase();
  }

  function renderClientes() {
    const texto = buscarCliente.value.trim().toLowerCase();
    const lista = clientes.filter((cliente) => !texto || clienteTexto(cliente).includes(texto));
    clientesList.innerHTML = "";

    if (lista.length === 0) {
      clientesList.innerHTML = `<p class="status-line">No hay clientes.</p>`;
      return;
    }

    lista.forEach((cliente) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "client-select-card";
      button.dataset.id = cliente._id;
      button.innerHTML = `
        <strong>${escapeHtml(cliente.razonSocial)}</strong>
        <span>${escapeHtml(cliente.rut)} | ${escapeHtml(cliente.nombreContacto)} | ${escapeHtml(cliente.email)}</span>
      `;
      clientesList.appendChild(button);
    });
  }

  function seleccionarCliente(cliente) {
    clienteSeleccionado = cliente;
    clienteId.value = cliente?._id || "";
    clienteSeleccionadoNombre.textContent = cliente?.razonSocial || "Sin cliente";
    clienteSeleccionadoDetalle.textContent = cliente
      ? `${cliente.rut} | ${cliente.nombreContacto} | ${cliente.email}`
      : "Selecciona un cliente para continuar.";
    seleccionarClienteModal.style.display = "none";
  }

  function agregarProducto(id) {
    const producto = productos.find((item) => item._id === id);
    if (!producto) return;

    const existente = items.find((item) => item.productoId === id);
    if (existente) {
      existente.cantidad += 1;
    } else {
      items.push({
        productoId: producto._id,
        sku: producto.sku || "Sin SKU",
        nombre: producto.nombre || "",
        precioUnitario: Number(producto.precio || 0),
        cantidad: 1,
      });
    }
    renderItems();
  }

  function renderItems() {
    itemsTable.innerHTML = "";

    if (items.length === 0) {
      itemsTable.innerHTML = `<tr><td colspan="6">Sin items.</td></tr>`;
    } else {
      items.forEach((item, index) => {
        const subtotal = item.precioUnitario * item.cantidad;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(item.sku)}</td>
          <td>${escapeHtml(item.nombre)}</td>
          <td>${money(item.precioUnitario)}</td>
          <td><input class="qty-input" type="number" min="1" step="1" value="${item.cantidad}" data-index="${index}"></td>
          <td>${money(subtotal)}</td>
          <td><button class="remove-item" type="button" data-index="${index}">Eliminar</button></td>
        `;
        itemsTable.appendChild(tr);
      });
    }

    const neto = items.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
    const iva = Math.round(neto * IVA_TASA);
    totalNeto.textContent = money(neto);
    totalIva.textContent = money(iva);
    totalGeneral.textContent = money(neto + iva);
  }

  function payloadSolicitud() {
    if (!clienteSeleccionado) throw new Error("Selecciona un cliente.");
    if (items.length === 0) throw new Error("Agrega al menos un producto.");

    return {
      cliente: {
        razonSocial: clienteSeleccionado.razonSocial,
        rut: clienteSeleccionado.rut,
        email: clienteSeleccionado.email,
        direccion: clienteSeleccionado.direccion,
        nombreContacto: clienteSeleccionado.nombreContacto,
        telefono: clienteSeleccionado.telefono,
      },
      validezDias: Number(validezDias.value),
      observaciones: observaciones.value.trim(),
      items: items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
      })),
    };
  }

  async function guardarSolicitud() {
    setStatus("");
    btnGuardarSolicitud.disabled = true;

    try {
      const solicitud = await requestJson(API_SOL, {
        method: "POST",
        body: JSON.stringify(payloadSolicitud()),
      });
      folioLabel.textContent = solicitud.folio || "Folio creado";
      estadoBadge.textContent = solicitud.estado || "borrador";
      estadoBadge.className = `badge ${solicitud.estado || "borrador"}`.trim();
      setStatus(`OC creada: ${solicitud.folio}.`, "success");
      abrirSolicitudCreada(solicitud);
    } catch (err) {
      setStatus(err.message, "error");
    } finally {
      btnGuardarSolicitud.disabled = false;
    }
  }

  function abrirSolicitudCreada(solicitud) {
    const rows = (solicitud.items || []).map((item) => `
      <tr>
        <td>${escapeHtml(item.sku)}</td>
        <td>${escapeHtml(item.nombre)}</td>
        <td>${money(item.precioUnitario)}</td>
        <td>${item.cantidad}</td>
        <td>${money(item.subtotal)}</td>
      </tr>
    `).join("");

    solicitudCreadaTitle.textContent = `OC ${solicitud.folio} creada`;
    solicitudCreadaBody.innerHTML = `
      <div class="modal-grid">
        <p><strong>Cliente</strong><span>${escapeHtml(solicitud.cliente?.razonSocial || "")}</span></p>
        <p><strong>RUT</strong><span>${escapeHtml(solicitud.cliente?.rut || "")}</span></p>
        <p><strong>Total</strong><span>${money(solicitud.total)}</span></p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>SKU</th><th>Producto</th><th>Precio neto</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    solicitudCreadaModal.style.display = "flex";
  }

  function limpiarOc() {
    clienteSeleccionado = null;
    seleccionarCliente(null);
    items = [];
    validezDias.value = 15;
    observaciones.value = "";
    folioLabel.textContent = "Folio pendiente";
    estadoBadge.textContent = "Borrador";
    estadoBadge.className = "badge";
    setStatus("");
    renderItems();
    solicitudCreadaModal.style.display = "none";
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
      const cliente = await requestJson(id ? `${API_CLIENTES}/${id}` : API_CLIENTES, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(payloadCliente()),
      });
      await cargarClientes();
      seleccionarCliente(cliente);
      clienteFormModal.style.display = "none";
    } catch (err) {
      setClienteModalStatus(err.message, "error");
    }
  }

  btnSeleccionarCliente.addEventListener("click", () => {
    renderClientes();
    seleccionarClienteModal.style.display = "flex";
    buscarCliente.focus();
  });
  cerrarSeleccionClienteModal.addEventListener("click", () => {
    seleccionarClienteModal.style.display = "none";
  });
  buscarCliente.addEventListener("input", renderClientes);
  clientesList.addEventListener("click", (e) => {
    const card = e.target.closest(".client-select-card");
    if (!card) return;
    const cliente = clientes.find((item) => item._id === card.dataset.id);
    if (cliente) seleccionarCliente(cliente);
  });
  btnNuevoCliente.addEventListener("click", () => abrirClienteForm());
  cerrarClienteFormModal.addEventListener("click", () => {
    clienteFormModal.style.display = "none";
  });
  clienteForm.addEventListener("submit", guardarCliente);

  buscarProducto.addEventListener("input", renderProductos);
  productosList.addEventListener("click", (e) => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains("btn-agregar-producto") && id) agregarProducto(id);
  });
  itemsTable.addEventListener("change", (e) => {
    if (!e.target.classList.contains("qty-input")) return;
    const index = Number(e.target.dataset.index);
    const value = Number(e.target.value);
    if (!Number.isInteger(index) || !items[index] || !Number.isInteger(value) || value < 1) {
      renderItems();
      return;
    }
    items[index].cantidad = value;
    renderItems();
  });
  itemsTable.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-item")) return;
    const index = Number(e.target.dataset.index);
    if (Number.isInteger(index)) {
      items.splice(index, 1);
      renderItems();
    }
  });
  btnGuardarSolicitud.addEventListener("click", guardarSolicitud);
  cerrarSolicitudCreadaModal.addEventListener("click", () => {
    solicitudCreadaModal.style.display = "none";
  });
  btnNuevaOcLimpia.addEventListener("click", limpiarOc);
  window.addEventListener("click", (e) => {
    if (e.target === seleccionarClienteModal) seleccionarClienteModal.style.display = "none";
    if (e.target === clienteFormModal) clienteFormModal.style.display = "none";
    if (e.target === solicitudCreadaModal) solicitudCreadaModal.style.display = "none";
  });

  async function init() {
    try {
      renderItems();
      await Promise.all([cargarProductos(), cargarClientes()]);
    } catch (err) {
      setStatus(err.message, "error");
    }
  }

  init();
});
