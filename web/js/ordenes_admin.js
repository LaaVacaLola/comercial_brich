document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("ordersTable");
  const pageButtons = document.getElementById("pageButtons");
  const pageInfo = document.getElementById("pageInfo");
  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const jobPanel = document.getElementById("jobPanel");
  const jobTitle = document.getElementById("jobTitle");
  const jobStatus = document.getElementById("jobStatus");
  const jobProgressBar = document.getElementById("jobProgressBar");
  const jobProgressFill = document.getElementById("jobProgressFill");
  const jobProgressText = document.getElementById("jobProgressText");
  const jobLog = document.getElementById("jobLog");
  const descargarBtn = document.getElementById("descargarBtn");
  const detenerBtn = document.getElementById("detenerBtn");
  const descargarBtnTop = document.getElementById("descargarBtnTop");
  const fuenteDatos = document.getElementById("fuenteDatos");
  const pageSize = 20;

  let ordenes = [];
  let currentPage = 1;
  let pageCache = new Map();
  let detailCache = new Map();
  let pollTimer = null;
  let lastOcProcesadas = 0;

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function setDefaultFilters() {
    const today = new Date();
    const monthsAgo = new Date();
    monthsAgo.setMonth(today.getMonth() - 6);
    document.getElementById("fechaDesde").value = isoDate(monthsAgo);
    document.getElementById("fechaHasta").value = isoDate(today);
    document.getElementById("estado").value = "todos";
  }

  function textAt(item, paths, fallback = "-") {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => acc?.[key], item);
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return typeof value === "object" ? fallback : String(value).trim();
      }
    }
    return fallback;
  }

  function valueAt(item, paths, fallback = null) {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => acc?.[key], item);
      if (value !== undefined && value !== null) return value;
    }
    return fallback;
  }

  function formatDate(value) {
    if (!value || value === "-") return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function estadoOrden(item) {
    const estado = textAt(item, ["Estado", "EstadoOrdenCompra", "estado"], "");
    if (estado) return estado;
    const codigo = Number(valueAt(item, ["CodigoEstado"], 0));
    const map = { 4: "Enviada a proveedor", 5: "En proceso", 6: "Aceptada", 9: "Cancelada", 12: "Recepcion conforme", 13: "Pendiente recepcion", 14: "Recepcionada parcialmente", 15: "Recepcion conforme incompleta" };
    return map[codigo] || `Estado ${codigo || "-"}`;
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
    const min = Math.max(1, currentPage - 5);
    const max = Math.min(maxPage, currentPage + 5);
    pageButtons.innerHTML = "";
    for (let p = min; p <= max; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = p === currentPage ? "page-button active" : "page-button";
      btn.textContent = p;
      btn.addEventListener("click", () => goToPage(p));
      pageButtons.appendChild(btn);
    }
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= maxPage;
    pageInfo.textContent = `Pagina ${currentPage} de ${maxPage} | ${ordenes.length} ordenes`;
  }

  function renderTable() {
    const items = getPageItems(currentPage);
    tbody.innerHTML = "";

    if (!items.length) {
      MP.renderEmpty(tbody, 7, "No se encontraron ordenes.");
      renderPageButtons();
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("tr");
      const codigo = textAt(item, ["Codigo", "CodigoOC"]);
      MP.appendCell(row, codigo);
      MP.appendCell(row, textAt(item, ["Nombre", "NombreOrden"]));
      MP.appendCell(row, textAt(item, ["Comprador.NombreOrganismo", "Comprador.NombreUnidad"]));
      MP.appendCell(row, formatDate(valueAt(item, ["Fechas.FechaEnvio", "Fechas.FechaCreacion"])));
      MP.appendCell(row, MP.formatMoney(valueAt(item, ["Total"], 0)));
      MP.appendStatus(row, estadoOrden(item));
      MP.appendAction(row, "Ver", () => showDetail(codigo, item));
      tbody.appendChild(row);
    });

    renderPageButtons();
  }

  function goToPage(page) {
    const next = Math.min(Math.max(1, page), totalPages());
    if (next === currentPage) return;
    currentPage = next;
    renderTable();
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
        <thead><tr><th>Producto</th><th>Categoria</th><th>Cantidad</th><th>Precio neto</th></tr></thead>
        <tbody>
          ${listado.map((linea) => `
            <tr>
              <td>${textAt(linea, ["Producto", "NombreProducto"])}</td>
              <td>${textAt(linea, ["Categoria"])}</td>
              <td>${textAt(linea, ["Cantidad"])}</td>
              <td>${MP.formatMoney(valueAt(linea, ["PrecioNeto"], 0))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  function showDetailModal(item) {
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
          ${metric("IVA", `${textAt(item, ["PorcentajeIva"])}%`)}
          ${metric("Moneda", textAt(item, ["TipoMoneda"]))}
          ${metric("Forma de pago", textAt(item, ["FormaPago"]))}
          ${metric("Tipo despacho", textAt(item, ["TipoDespacho"]))}
        </section>

        <div class="tender-layout">
          <section class="tender-panel">
            <h3>Comprador</h3>
            ${infoRow("Organismo", textAt(item, ["Comprador.NombreOrganismo"]))}
            ${infoRow("Unidad", textAt(item, ["Comprador.NombreUnidad"]))}
            ${infoRow("RUT unidad", textAt(item, ["Comprador.RutUnidad"]))}
            ${infoRow("Comuna", textAt(item, ["Comprador.ComunaUnidad"]))}
            ${infoRow("Region", textAt(item, ["Comprador.RegionUnidad"]))}
            ${infoRow("Contacto", textAt(item, ["Comprador.NombreContacto"]))}
          </section>

          <aside class="tender-panel">
            <h3>Fechas</h3>
            ${infoRow("Creacion", formatDate(valueAt(item, ["Fechas.FechaCreacion"])))}
            ${infoRow("Envio", formatDate(valueAt(item, ["Fechas.FechaEnvio"])))}
            ${infoRow("Aceptacion", formatDate(valueAt(item, ["Fechas.FechaAceptacion"])))}
            ${infoRow("Ultima modificacion", formatDate(valueAt(item, ["Fechas.FechaUltimaModificacion"])))}
          </aside>
        </div>

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

  async function showDetail(codigo, fallbackItem) {
    try {
      MP.setMessage("Cargando detalle...");
      if (!detailCache.has(codigo)) {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/mercado-publico/ordenes/${encodeURIComponent(codigo)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        detailCache.set(codigo, MP.getListado(data)[0] || data);
      }
      showDetailModal(detailCache.get(codigo));
      MP.setMessage(`Detalle cargado: ${codigo}`);
    } catch (err) {
      showDetailModal(fallbackItem);
      MP.setMessage(`No se pudo cargar detalle: ${err.message}`, true);
    }
  }

  // --- Job panel ---

  const statusLabels = {
    queued: "En cola",
    running: "Descargando",
    complete: "Completado",
    error: "Error",
    cancelled: "Detenido",
  };

  function setJobButtons(isActive) {
    descargarBtn.hidden = isActive;
    detenerBtn.hidden = !isActive;
    descargarBtnTop.disabled = isActive;
  }

  function renderJobPanel(job) {
    if (!job) {
      jobPanel.hidden = true;
      setJobButtons(false);
      return;
    }

    jobPanel.hidden = false;

    const pct = job.progress?.porcentaje ?? 0;
    const oc = job.progress?.ocProcesadas ?? 0;
    const isActive = ["queued", "running"].includes(job.status);

    jobTitle.textContent = `Descarga: ${job.entidadNombre || job.entidadCodigo}`;
    jobStatus.textContent = statusLabels[job.status] || job.status;
    jobStatus.className = `status-badge status-badge--${job.status}`;
    setJobButtons(isActive);

    if (isActive) {
      jobProgressBar.hidden = false;
      jobProgressFill.style.width = `${pct}%`;
      jobProgressText.textContent = `${pct}% — ${oc} OC guardadas`;
      jobLog.textContent = job.logs?.at(-1)?.message || "";
    } else {
      jobProgressBar.hidden = true;
      jobLog.textContent = job.status === "complete"
        ? `Finalizado: ${oc} OC guardadas en cache.`
        : (job.error || "");
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Recarga silenciosa del cache: actualiza ordenes[] y la tabla sin resetear la pagina actual
  async function silentCacheRefresh() {
    try {
      const params = new URLSearchParams();
      const fechaDesde = document.getElementById("fechaDesde").value;
      const fechaHasta = document.getElementById("fechaHasta").value;
      const estado = document.getElementById("estado").value;
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (estado && estado !== "todos") params.set("estado", estado);

      const token = localStorage.getItem("token");
      const url = `/api/empresa/ordenes/cache${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const nuevas = MP.getListado(data);

      if (nuevas.length !== ordenes.length) {
        ordenes = nuevas;
        pageCache = new Map();
        renderTable();
        MP.setMessage(`${ordenes.length} OC en cache (descargando...)`);
      }
    } catch (_) {
      // silencioso: no interrumpir el polling
    }
  }

  function startPolling() {
    stopPolling();
    lastOcProcesadas = 0;

    pollTimer = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/empresa/ordenes/job", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        renderJobPanel(data.job);

        const ocActuales = data.job?.progress?.ocProcesadas ?? 0;

        // Si el job guardó nuevas OC desde el último poll, refrescar la tabla en modo cache
        if (fuenteDatos.value === "cache" && ocActuales > lastOcProcesadas) {
          lastOcProcesadas = ocActuales;
          await silentCacheRefresh();
        }

        if (!data.job || ["complete", "error", "cancelled"].includes(data.job.status)) {
          stopPolling();
          if (data.job?.status === "complete") {
            fuenteDatos.value = "cache";
            await loadOrdenes();
          }
        }
      } catch (_) {
        stopPolling();
      }
    }, 3000);
  }

  async function checkJobStatus() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/empresa/ordenes/job", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      renderJobPanel(data.job);

      if (data.job && ["queued", "running"].includes(data.job.status)) {
        lastOcProcesadas = data.job.progress?.ocProcesadas ?? 0;
        startPolling();
      }
    } catch (_) {
      jobPanel.hidden = true;
    }
  }

  async function iniciarDescarga() {
    try {
      setJobButtons(true);
      descargarBtnTop.disabled = true;
      MP.setMessage("Iniciando descarga de ordenes en ChileCompra...");

      const token = localStorage.getItem("token");
      const res = await fetch("/api/empresa/ordenes/job", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        MP.setMessage(data.error || `Error ${res.status}`, true);
        setJobButtons(false);
        descargarBtnTop.disabled = false;
        return;
      }

      renderJobPanel(data.job);
      fuenteDatos.value = "cache";
      MP.setMessage("Job iniciado. Las OC aparecen en la lista a medida que se descargan.");
      startPolling();
    } catch (err) {
      MP.setMessage(err.message, true);
      setJobButtons(false);
      descargarBtnTop.disabled = false;
    }
  }

  async function detenerDescarga() {
    try {
      detenerBtn.disabled = true;
      MP.setMessage("Deteniendo descarga...");

      const token = localStorage.getItem("token");
      const res = await fetch("/api/empresa/ordenes/job", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        MP.setMessage(data.error || `Error ${res.status}`, true);
        detenerBtn.disabled = false;
        return;
      }

      stopPolling();
      renderJobPanel(data.job);
      MP.setMessage("Descarga detenida. Las OC ya guardadas quedan en cache.");
    } catch (err) {
      MP.setMessage(err.message, true);
      detenerBtn.disabled = false;
    }
  }

  // --- Carga de ordenes ---

  async function loadOrdenes() {
    try {
      const fuente = fuenteDatos.value;
      const label = fuente === "cache" ? "cache local" : "API ChileCompra";
      MP.setMessage(`Consultando ordenes desde ${label}...`);
      tbody.innerHTML = "";
      pageCache = new Map();
      detailCache = new Map();
      currentPage = 1;

      const params = new URLSearchParams();
      const fechaDesde = document.getElementById("fechaDesde").value;
      const fechaHasta = document.getElementById("fechaHasta").value;
      const estado = document.getElementById("estado").value;
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (estado && estado !== "todos") params.set("estado", estado);

      const endpoint = fuente === "cache"
        ? `/api/empresa/ordenes/cache`
        : `/api/empresa/ordenes`;
      const url = `${endpoint}${params.toString() ? `?${params}` : ""}`;

      const token = localStorage.getItem("token");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      if (!res.ok) {
        MP.setMessage(data.error || `Error ${res.status}`, true);
        MP.renderEmpty(tbody, 7, data.error || "No se pudieron cargar las ordenes.");
        renderPageButtons();
        return;
      }

      ordenes = MP.getListado(data);

      if (!ordenes.length) {
        const hint = fuente === "cache"
          ? " Usa 'Descargar OC de ChileCompra' para poblar el cache."
          : "";
        MP.renderEmpty(tbody, 7, `No se encontraron ordenes para los filtros indicados.${hint}`);
        renderPageButtons();
        MP.setMessage(`Sin resultados en ${label}.${hint}`);
        return;
      }

      const origen = data.fromCache ? "cache local" : "ChileCompra";
      renderTable();
      MP.setMessage(`${ordenes.length} ordenes encontradas (${origen}, proveedor ${data.codigoProveedor || ""}).`);
    } catch (err) {
      ordenes = [];
      pageCache = new Map();
      MP.renderEmpty(tbody, 7, "No fue posible cargar ordenes.");
      renderPageButtons();
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("buscarBtn").addEventListener("click", loadOrdenes);
  document.getElementById("limpiarBtn").addEventListener("click", () => {
    setDefaultFilters();
    loadOrdenes();
  });
  descargarBtn.addEventListener("click", iniciarDescarga);
  detenerBtn.addEventListener("click", detenerDescarga);
  descargarBtnTop.addEventListener("click", iniciarDescarga);
  prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1));
  nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1));

  setDefaultFilters();
  checkJobStatus();
  loadOrdenes();
});
