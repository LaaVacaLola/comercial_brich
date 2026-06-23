document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("resultTable");
  const pageButtons = document.getElementById("pageButtons");
  const pageInfo = document.getElementById("pageInfo");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const filterIds = ["fechaDesde", "fechaHasta", "estado", "codigo", "codigoOrganismo", "codigoProveedor"];
  const pageSize = 20;
  const cacheRadius = 5;

  let ordenes = [];
  let currentPage = 1;
  let pageCache = new Map();
  let detailCache = new Map();

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function setDefaultFilters() {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    document.getElementById("fechaDesde").value = isoDate(weekAgo);
    document.getElementById("fechaHasta").value = isoDate(today);
    document.getElementById("estado").value = "todos";
  }

  function ensureRequiredFilters() {
    if (!document.getElementById("fechaDesde").value || !document.getElementById("fechaHasta").value) setDefaultFilters();
    if (!document.getElementById("estado").value) document.getElementById("estado").value = "todos";
  }

  function valueAt(item, paths, fallback = "-") {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => acc?.[key], item);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return fallback;
  }

  function textAt(item, paths, fallback = "-") {
    const value = valueAt(item, paths, fallback);
    if (typeof value === "object") return fallback;
    return value === fallback ? fallback : String(value).trim();
  }

  function normalizeRut(value) {
    return String(value || "").replace(/[^0-9kK]/g, "").toUpperCase();
  }

  function collectObjects(value, bucket = [], seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return bucket;
    seen.add(value);

    if (!Array.isArray(value)) bucket.push(value);

    Object.values(value).forEach((child) => {
      if (child && typeof child === "object") collectObjects(child, bucket, seen);
    });

    return bucket;
  }

  function pickFromObject(item, keys, fallback = "") {
    for (const key of keys) {
      const value = item?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return fallback;
  }

  function providerFromResponse(data, rutBuscado) {
    const rutNormalizado = normalizeRut(rutBuscado);
    const objects = collectObjects(data);
    const rutKeys = [
      "RutEmpresa",
      "RUTEmpresa",
      "RutProveedor",
      "RutSucursal",
      "Rut",
      "rut",
      "rutempresaproveedor",
    ];
    const codeKeys = [
      "CodigoEmpresa",
      "CodigoProveedor",
      "Codigo",
      "codigoEmpresa",
      "codigoProveedor",
      "codigo",
    ];
    const nameKeys = [
      "NombreEmpresa",
      "NombreProveedor",
      "Nombre",
      "RazonSocial",
      "nombreEmpresa",
      "nombreProveedor",
      "nombre",
    ];

    const exactRutMatch = objects.find((item) =>
      rutKeys.some((key) => normalizeRut(item?.[key]) === rutNormalizado)
    );
    const candidate = exactRutMatch || objects.find((item) => pickFromObject(item, codeKeys, ""));

    if (!candidate) {
      return {
        codigo: "",
        nombre: "Proveedor no encontrado",
      };
    }

    return {
      codigo: pickFromObject(candidate, codeKeys, ""),
      nombre: pickFromObject(candidate, nameKeys, "Proveedor encontrado"),
      rut: pickFromObject(candidate, rutKeys, ""),
    };
  }

  function formatDate(value) {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function estadoOrden(item) {
    const estado = textAt(item, ["Estado", "EstadoOrdenCompra", "estado"], "");
    if (estado) return estado;
    const codigoEstado = Number(valueAt(item, ["CodigoEstado"], 0));
    const estados = {
      4: "Enviada a proveedor",
      5: "En proceso",
      6: "Aceptada",
      9: "Cancelada",
      12: "Recepcion conforme",
      13: "Pendiente recepcion",
      14: "Recepcionada parcialmente",
      15: "Recepcion conforme incompleta",
    };
    return estados[codigoEstado] || `Estado ${codigoEstado || "-"}`;
  }

  function totalPages() {
    return Math.max(1, Math.ceil(ordenes.length / pageSize));
  }

  function getPageItems(page) {
    if (pageCache.has(page)) return pageCache.get(page);
    const start = (page - 1) * pageSize;
    const items = ordenes.slice(start, start + pageSize);
    pageCache.set(page, items);
    return items;
  }

  function renderPageButtons() {
    const maxPage = totalPages();
    const min = Math.max(1, currentPage - cacheRadius);
    const max = Math.min(maxPage, currentPage + cacheRadius);
    pageButtons.innerHTML = "";

    for (let page = min; page <= max; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = page === currentPage ? "page-button active" : "page-button";
      button.textContent = page;
      button.addEventListener("click", () => goToPage(page));
      pageButtons.appendChild(button);
    }

    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= maxPage;
    pageInfo.textContent = `Pagina ${currentPage} de ${maxPage} | ${ordenes.length} ordenes`;
  }

  function renderTable() {
    const items = getPageItems(currentPage);
    tbody.innerHTML = "";

    if (!items.length) {
      MP.renderEmpty(tbody, 4, "No se encontraron ordenes para los filtros indicados.");
      renderPageButtons();
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("tr");
      const codigo = textAt(item, ["Codigo", "CodigoOC", "codigo"]);
      MP.appendCell(row, codigo);
      MP.appendCell(row, textAt(item, ["Nombre", "Descripcion", "NombreOrden"]));
      MP.appendStatus(row, estadoOrden(item));
      MP.appendAction(row, "Ver", () => showOrdenDetail(codigo, item));
      tbody.appendChild(row);
    });

    renderPageButtons();
  }

  function goToPage(page) {
    const nextPage = Math.min(Math.max(1, page), totalPages());
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    renderTable();
    MP.setMessage(`Mostrando pagina ${currentPage}.`);
  }

  function infoRow(label, value) {
    return `<div class="tender-info-row"><span>${label}</span><strong>${value || "-"}</strong></div>`;
  }

  function metric(label, value) {
    return `<div class="tender-metric"><span>${label}</span><strong>${value || "-"}</strong></div>`;
  }

  function renderItems(item) {
    const listado = valueAt(item, ["Items.Listado"], []);
    if (!Array.isArray(listado) || !listado.length) return "<p>No hay items informados.</p>";
    return `
      <table class="detail-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoria</th>
            <th>Especificacion comprador</th>
            <th>Cantidad</th>
            <th>Precio neto</th>
          </tr>
        </thead>
        <tbody>
          ${listado.map((linea) => `
            <tr>
              <td>${textAt(linea, ["Producto", "NombreProducto"])}</td>
              <td>${textAt(linea, ["Categoria"])}</td>
              <td>${textAt(linea, ["EspecificacionComprador", "Descripcion"])}</td>
              <td>${textAt(linea, ["Cantidad"])}</td>
              <td>${MP.formatMoney(valueAt(linea, ["PrecioNeto"], 0))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function showOrdenModal(item) {
    const modal = document.getElementById("detailModal");
    const content = document.getElementById("detailContent");
    if (!modal || !content) return;

    const codigo = textAt(item, ["Codigo"]);
    const estado = estadoOrden(item);

    content.innerHTML = `
      <article class="tender-sheet">
        <header class="tender-header">
          <div>
            <span class="tender-code">${codigo}</span>
            <h2>${textAt(item, ["Nombre"])}</h2>
          </div>
          <span class="tender-state">${estado}</span>
        </header>

        <section class="tender-summary">
          ${metric("Total", MP.formatMoney(valueAt(item, ["Total"], 0)))}
          ${metric("Total neto", MP.formatMoney(valueAt(item, ["TotalNeto"], 0)))}
          ${metric("IVA", `${textAt(item, ["PorcentajeIva"])}% / ${MP.formatMoney(valueAt(item, ["Impuestos"], 0))}`)}
          ${metric("Tipo", `${textAt(item, ["Tipo"])} / ${textAt(item, ["CodigoTipo"])}`)}
          ${metric("Moneda", textAt(item, ["TipoMoneda"]))}
          ${metric("Estado proveedor", textAt(item, ["EstadoProveedor", "CodigoEstadoProveedor"]))}
        </section>

        <section class="tender-panel">
          <h3>Descripcion</h3>
          <p>${textAt(item, ["Descripcion"])}</p>
        </section>

        <div class="tender-layout">
          <section class="tender-panel">
            <h3>Proveedor</h3>
            ${infoRow("Nombre", textAt(item, ["Proveedor.Nombre"]))}
            ${infoRow("Codigo", textAt(item, ["Proveedor.Codigo"]))}
            ${infoRow("Sucursal", textAt(item, ["Proveedor.NombreSucursal"]))}
            ${infoRow("RUT sucursal", textAt(item, ["Proveedor.RutSucursal"]))}
            ${infoRow("Direccion", textAt(item, ["Proveedor.Direccion"]))}
            ${infoRow("Comuna", textAt(item, ["Proveedor.Comuna"]))}
            ${infoRow("Region", textAt(item, ["Proveedor.Region"]))}
            ${infoRow("Contacto", textAt(item, ["Proveedor.NombreContacto"]))}
          </section>

          <aside class="tender-panel side">
            <h3>Comprador</h3>
            ${infoRow("Organismo", textAt(item, ["Comprador.NombreOrganismo"]))}
            ${infoRow("Codigo organismo", textAt(item, ["Comprador.CodigoOrganismo"]))}
            ${infoRow("Unidad", textAt(item, ["Comprador.NombreUnidad"]))}
            ${infoRow("RUT unidad", textAt(item, ["Comprador.RutUnidad"]))}
            ${infoRow("Actividad", textAt(item, ["Comprador.Actividad"]))}
            ${infoRow("Comuna", textAt(item, ["Comprador.ComunaUnidad"]))}
            ${infoRow("Region", textAt(item, ["Comprador.RegionUnidad"]))}
            ${infoRow("Contacto", textAt(item, ["Comprador.NombreContacto"]))}
          </aside>
        </div>

        <section class="tender-panel">
          <h3>Fechas</h3>
          <div class="tender-info-grid">
            ${infoRow("Creacion", formatDate(valueAt(item, ["Fechas.FechaCreacion"])))}
            ${infoRow("Envio", formatDate(valueAt(item, ["Fechas.FechaEnvio"])))}
            ${infoRow("Aceptacion", formatDate(valueAt(item, ["Fechas.FechaAceptacion"])))}
            ${infoRow("Ultima modificacion", formatDate(valueAt(item, ["Fechas.FechaUltimaModificacion"])))}
            ${infoRow("Cancelacion", formatDate(valueAt(item, ["Fechas.FechaCancelacion"])))}
          </div>
        </section>

        <section class="tender-panel">
          <h3>Condiciones comerciales</h3>
          <div class="tender-info-grid">
            ${infoRow("Financiamiento", textAt(item, ["Financiamiento"]))}
            ${infoRow("Forma de pago", MP.formaPago(valueAt(item, ["FormaPago"])))}
            ${infoRow("Tipo despacho", MP.tipoDespacho(valueAt(item, ["TipoDespacho"])))}
            ${infoRow("Pais", textAt(item, ["Pais"]))}
            ${infoRow("Descuentos", MP.formatMoney(valueAt(item, ["Descuentos"], 0)))}
            ${infoRow("Cargos", MP.formatMoney(valueAt(item, ["Cargos"], 0)))}
          </div>
        </section>

        <section class="tender-panel">
          <h3>Items de la orden</h3>
          ${renderItems(item)}
        </section>

        <details class="tender-json">
          <summary>Ver JSON completo</summary>
          <pre class="detail-json">${JSON.stringify(item, null, 2)}</pre>
        </details>
      </article>`;

    modal.style.display = "flex";
  }

  async function showOrdenDetail(codigo, fallbackItem) {
    try {
      MP.setMessage("Cargando detalle de orden...");
      if (!detailCache.has(codigo)) {
        const detail = await MP.request(`/ordenes/${encodeURIComponent(codigo)}`);
        detailCache.set(codigo, MP.getListado(detail)[0] || detail);
      }
      showOrdenModal(detailCache.get(codigo));
      MP.setMessage(`Detalle cargado: ${codigo}`);
    } catch (err) {
      showOrdenModal(fallbackItem);
      MP.setMessage(`No se pudo cargar detalle remoto: ${err.message}`, true);
    }
  }

  async function loadOrdenes() {
    try {
      MP.setMessage("Consultando ordenes en ChileCompra...");
      tbody.innerHTML = "";
      pageCache = new Map();
      detailCache = new Map();
      currentPage = 1;
      ensureRequiredFilters();

      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/ordenes${query ? `?${query}` : ""}`);
      console.log("Respuesta JSON listado ordenes:", data);
      ordenes = MP.getListado(data);

      if (!ordenes.length) {
        MP.renderEmpty(tbody, 4, "No se encontraron ordenes para los filtros indicados.");
        renderPageButtons();
        MP.setMessage("Sin resultados.");
        return;
      }

      renderTable();
      MP.setMessage(`${ordenes.length} ordenes encontradas. Mostrando datos disponibles del listado.`);
    } catch (err) {
      ordenes = [];
      pageCache = new Map();
      detailCache = new Map();
      MP.renderEmpty(tbody, 4, "No fue posible cargar ordenes.");
      renderPageButtons();
      MP.setMessage(err.message, true);
    }
  }

  async function buscarProveedor() {
    const rut = document.getElementById("rutProveedor").value.trim();
    const result = document.getElementById("proveedorResult");
    if (!rut) {
      result.textContent = "Ingresa un RUT con puntos y guion.";
      return;
    }
    try {
      result.textContent = "Buscando proveedor...";
      const data = await MP.request(`/proveedor?rut=${encodeURIComponent(rut)}`);
      console.log("Respuesta JSON busqueda proveedor:", data);
      const proveedor = providerFromResponse(data, rut);
      const { codigo, nombre } = proveedor;

      if (!codigo) {
        result.textContent = `${nombre}. No se encontro codigo de proveedor para ese RUT.`;
        MP.setMessage("Proveedor encontrado sin codigo util para filtrar, o RUT sin resultados.", true);
        return;
      }

      document.getElementById("codigoProveedor").value = codigo;
      result.textContent = `${nombre} | Codigo proveedor: ${codigo}. Filtrando ordenes...`;
      await loadOrdenes();
      MP.setMessage(`Proveedor ${nombre} encontrado. Filtro aplicado con codigo ${codigo}.`);
    } catch (err) {
      result.textContent = err.message;
      MP.setMessage(`No se pudo buscar proveedor por RUT: ${err.message}`, true);
    }
  }

  document.getElementById("buscarBtn").addEventListener("click", loadOrdenes);
  document.getElementById("buscarProveedorBtn").addEventListener("click", buscarProveedor);
  document.getElementById("limpiarBtn").addEventListener("click", async () => {
    MP.resetFilters(["codigo", "codigoOrganismo", "codigoProveedor"]);
    const rutProveedor = document.getElementById("rutProveedor");
    const proveedorResult = document.getElementById("proveedorResult");
    if (rutProveedor) rutProveedor.value = "";
    if (proveedorResult) proveedorResult.textContent = "";
    setDefaultFilters();
    await loadOrdenes();
    MP.setMessage("Busqueda inicial restaurada.");
  });

  prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1));
  nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1));
  setDefaultFilters();
  loadOrdenes();
});
