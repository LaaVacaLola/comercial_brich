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

  let licitaciones = [];
  let currentPage = 1;
  let pageCache = new Map();

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

  function isoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
    const fechaDesde = document.getElementById("fechaDesde");
    const fechaHasta = document.getElementById("fechaHasta");
    const estado = document.getElementById("estado");

    if (!fechaDesde.value || !fechaHasta.value) {
      setDefaultFilters();
      return;
    }

    if (!estado.value) {
      estado.value = "todos";
    }
  }

  function valueAt(item, paths, fallback = "-") {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => acc?.[key], item);
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    return fallback;
  }

  function textAt(item, paths, fallback = "-") {
    const value = valueAt(item, paths, fallback);
    if (typeof value === "object") return fallback;
    return value === fallback ? fallback : String(value).trim();
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

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("es-CL").format(number) : "-";
  }

  function estadoLicitacion(item) {
    const estado = textAt(item, ["Estado", "EstadoLicitacion"], "");
    if (estado) return estado;

    const codigoEstado = Number(valueAt(item, ["CodigoEstado"], 0));
    const estados = {
      5: "Publicada",
      6: "Cerrada",
      7: "Desierta",
      8: "Adjudicada",
      15: "Revocada",
      18: "Revocada",
      19: "Suspendida",
    };

    return estados[codigoEstado] || `Estado ${codigoEstado || "-"}`;
  }

  function tipoLicitacion(item) {
    const tipo = textAt(item, ["Tipo"], "");
    if (tipo) return tipo;

    const codigo = textAt(item, ["CodigoExterno", "Codigo"], "");
    const match = codigo.match(/-([A-Z]{1,3}\d*)$/i);
    return match ? match[1].toUpperCase() : "-";
  }

  function totalPages() {
    return Math.max(1, Math.ceil(licitaciones.length / pageSize));
  }

  function getPageItems(page) {
    if (pageCache.has(page)) return pageCache.get(page);
    const start = (page - 1) * pageSize;
    const items = licitaciones.slice(start, start + pageSize);
    pageCache.set(page, items);
    return items;
  }

  function warmPageCache(centerPage) {
    const maxPage = totalPages();
    const min = Math.max(1, centerPage - cacheRadius);
    const max = Math.min(maxPage, centerPage + cacheRadius);

    window.requestIdleCallback
      ? window.requestIdleCallback(() => {
        for (let page = min; page <= max; page += 1) getPageItems(page);
      })
      : setTimeout(() => {
        for (let page = min; page <= max; page += 1) getPageItems(page);
      }, 0);
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
    pageInfo.textContent = `Pagina ${currentPage} de ${maxPage} | ${licitaciones.length} licitaciones`;
  }

  function renderTable() {
    const items = getPageItems(currentPage);
    tbody.innerHTML = "";

    if (!items.length) {
      MP.renderEmpty(tbody, 6, "No se encontraron licitaciones para los filtros indicados.");
      renderPageButtons();
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("tr");
      const codigo = textAt(item, ["CodigoExterno", "Codigo", "codigo"]);

      MP.appendCell(row, codigo);
      MP.appendCell(row, textAt(item, ["Nombre", "NombreLicitacion", "Descripcion"]));
      MP.appendCell(row, tipoLicitacion(item));
      MP.appendCell(row, formatDate(valueAt(item, ["Fechas.FechaCierre", "FechaCierre", "Fechas.FechaFinal", "FechaFinal", "Fecha"])));
      MP.appendStatus(row, estadoLicitacion(item));
      MP.appendAction(row, "Ver", () => showLicitacionDetail(codigo, item));

      tbody.appendChild(row);
    });

    renderPageButtons();
    warmPageCache(currentPage);
  }

  function goToPage(page) {
    const nextPage = Math.min(Math.max(1, page), totalPages());
    if (nextPage === currentPage) return;
    currentPage = nextPage;
    renderTable();
    MP.setMessage(`Mostrando pagina ${currentPage}. Cache preparado de ${Math.max(1, currentPage - cacheRadius)} a ${Math.min(totalPages(), currentPage + cacheRadius)}.`);
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
            <th>Cantidad</th>
            <th>Unidad</th>
          </tr>
        </thead>
        <tbody>
          ${listado.map((linea) => `
            <tr>
              <td>${textAt(linea, ["NombreProducto"])}</td>
              <td>${textAt(linea, ["Categoria"])}</td>
              <td>${formatNumber(valueAt(linea, ["Cantidad"], 0))}</td>
              <td>${textAt(linea, ["UnidadMedida"])}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function detailMetric(label, value) {
    return `
      <div class="tender-metric">
        <span>${label}</span>
        <strong>${value || "-"}</strong>
      </div>
    `;
  }

  function infoRow(label, value) {
    return `
      <div class="tender-info-row">
        <span>${label}</span>
        <strong>${value || "-"}</strong>
      </div>
    `;
  }

  function dateRow(label, value) {
    return `
      <li>
        <span>${label}</span>
        <strong>${formatDate(value)}</strong>
      </li>
    `;
  }

  function showDetailModal(item) {
    const modal = document.getElementById("detailModal");
    const content = document.getElementById("detailContent");
    if (!modal || !content) return;

    const codigo = textAt(item, ["CodigoExterno", "Codigo"]);
    const estado = textAt(item, ["Estado", "CodigoEstado"]);
    const nombre = textAt(item, ["Nombre", "NombreLicitacion"]);

    content.innerHTML = `
      <article class="tender-sheet">
        <header class="tender-header">
          <div>
            <span class="tender-code">${codigo}</span>
            <h2>${nombre}</h2>
          </div>
          <span class="tender-state">${estado}</span>
        </header>

        <section class="tender-summary">
          ${detailMetric("Monto estimado", MP.formatMoney(valueAt(item, ["MontoEstimado"], 0)))}
          ${detailMetric("Moneda", textAt(item, ["Moneda"]))}
          ${detailMetric("Tipo", `${textAt(item, ["Tipo"])} / ${textAt(item, ["CodigoTipo"])}`)}
          ${detailMetric("Reclamos", formatNumber(valueAt(item, ["CantidadReclamos"], 0)))}
        </section>

        <div class="tender-layout">
          <section class="tender-panel main">
            <h3>Descripcion de la licitacion</h3>
            <p>${textAt(item, ["Descripcion"])}</p>

            <h3>Productos o servicios requeridos</h3>
            ${renderItems(item)}
          </section>

          <aside class="tender-panel side">
            <h3>Comprador</h3>
            ${infoRow("Organismo", textAt(item, ["Comprador.NombreOrganismo", "NombreOrganismo"]))}
            ${infoRow("Unidad", textAt(item, ["Comprador.NombreUnidad"]))}
            ${infoRow("RUT unidad", textAt(item, ["Comprador.RutUnidad"]))}
            ${infoRow("Region", textAt(item, ["Comprador.RegionUnidad"]))}
            ${infoRow("Comuna", textAt(item, ["Comprador.ComunaUnidad"]))}
            ${infoRow("Direccion", textAt(item, ["Comprador.DireccionUnidad"]))}
            ${infoRow("Contacto", textAt(item, ["Comprador.NombreUsuario"]))}
            ${infoRow("Cargo", textAt(item, ["Comprador.CargoUsuario"]))}
          </aside>
        </div>

        <section class="tender-panel">
          <h3>Fechas relevantes</h3>
          <ol class="tender-timeline">
            ${dateRow("Publicacion", valueAt(item, ["Fechas.FechaPublicacion", "FechaPublicacion"]))}
            ${dateRow("Inicio", valueAt(item, ["Fechas.FechaInicio"]))}
            ${dateRow("Cierre de preguntas", valueAt(item, ["Fechas.FechaFinal"]))}
            ${dateRow("Publicacion de respuestas", valueAt(item, ["Fechas.FechaPubRespuestas"]))}
            ${dateRow("Cierre", valueAt(item, ["Fechas.FechaCierre", "FechaCierre"]))}
            ${dateRow("Apertura tecnica", valueAt(item, ["Fechas.FechaActoAperturaTecnica"]))}
            ${dateRow("Apertura economica", valueAt(item, ["Fechas.FechaActoAperturaEconomica"]))}
            ${dateRow("Adjudicacion estimada", valueAt(item, ["Fechas.FechaEstimadaAdjudicacion", "Fechas.FechaAdjudicacion"]))}
          </ol>
        </section>

        <section class="tender-panel">
          <h3>Condiciones comerciales</h3>
          <div class="tender-info-grid">
            ${infoRow("Fuente financiamiento", textAt(item, ["FuenteFinanciamiento"]))}
            ${infoRow("Responsable pago", textAt(item, ["NombreResponsablePago"]))}
            ${infoRow("Responsable contrato", textAt(item, ["NombreResponsableContrato"]))}
            ${infoRow("Duracion contrato", `${textAt(item, ["TiempoDuracionContrato", "Tiempo"])} ${textAt(item, ["UnidadTiempoDuracionContrato", "UnidadTiempo"])}`)}
            ${infoRow("Subcontratacion", textAt(item, ["SubContratacion"]))}
            ${infoRow("Renovable", textAt(item, ["EsRenovable"]))}
          </div>
        </section>

        <details class="tender-json">
          <summary>Ver JSON completo</summary>
          <pre class="detail-json">${JSON.stringify(item, null, 2)}</pre>
        </details>
      </article>
    `;

    modal.style.display = "flex";
  }

  async function showLicitacionDetail(codigo, fallbackItem) {
    try {
      MP.setMessage("Cargando detalle de licitacion...");
      const detail = await MP.request(`/licitaciones/${encodeURIComponent(codigo)}`);
      const item = MP.getListado(detail)[0] || detail || fallbackItem;
      showDetailModal(item);
      MP.setMessage(`Detalle cargado: ${codigo}`);
    } catch (err) {
      showDetailModal(fallbackItem);
      MP.setMessage(`No se pudo cargar detalle remoto. Mostrando datos del listado: ${err.message}`, true);
    }
  }

  async function loadLicitaciones() {
    try {
      MP.setMessage("Consultando licitaciones en ChileCompra...");
      tbody.innerHTML = "";
      pageCache = new Map();
      currentPage = 1;
      ensureRequiredFilters();

      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/licitaciones${query ? `?${query}` : ""}`);
      console.log("Respuesta JSON listado licitaciones:", data);
      licitaciones = MP.getListado(data);

      if (!licitaciones.length) {
        MP.renderEmpty(tbody, 6, "No se encontraron licitaciones para los filtros indicados.");
        renderPageButtons();
        MP.setMessage("Sin resultados.");
        return;
      }

      warmPageCache(1);
      renderTable();
      MP.setMessage(`${licitaciones.length} licitaciones encontradas. Mostrando 20 por pagina.`);
    } catch (err) {
      licitaciones = [];
      pageCache = new Map();
      MP.renderEmpty(tbody, 6, "No fue posible cargar licitaciones.");
      renderPageButtons();
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("buscarBtn").addEventListener("click", loadLicitaciones);
  document.getElementById("limpiarBtn").addEventListener("click", () => {
    MP.resetFilters(["codigo", "codigoOrganismo", "codigoProveedor"]);
    setDefaultFilters();
    licitaciones = [];
    pageCache = new Map();
    currentPage = 1;
    MP.renderEmpty(tbody, 6, "Selecciona filtros y presiona Buscar.");
    renderPageButtons();
    MP.setMessage("Filtros limpiados.");
  });

  prevPageBtn.addEventListener("click", () => goToPage(currentPage - 1));
  nextPageBtn.addEventListener("click", () => goToPage(currentPage + 1));

  setDefaultFilters();
  loadLicitaciones();
});
