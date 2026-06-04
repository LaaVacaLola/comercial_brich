document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const charts = {};
  const PAGE_SIZE = 5;
  let proveedores = [];
  let clientes = [];
  let modoActual = "proveedores";
  let entidadesSeleccionadas = [];
  let ultimoResultado = null;
  let debounceTimer = null;
  let analysisRunId = 0;
  let ordenesAnalizadas = [];
  let analisisGuardados = [];
  let ordenesPage = 1;
  let analisisPage = 1;

  if (!MP.getTokenOrRedirect()) return;

  function selectedPeriodo() {
    return document.getElementById("periodoAnalisis")?.value || "mes_actual";
  }

  function selectedPeriodoLabel() {
    const select = document.getElementById("periodoAnalisis");
    return select?.selectedOptions?.[0]?.textContent || "Mes actual";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function chart(id, type, labels, values, label) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(canvas.getContext("2d"), {
      type,
      data: {
        labels: labels.length ? labels : ["Sin datos"],
        datasets: [{
          label,
          data: values.length ? values : [0],
          backgroundColor: ["#0a2f6b", "#27ae60", "#f1c40f", "#e74c3c", "#34495e", "#4db8ff", "#8e44ad", "#16a085"],
          borderColor: "#0a2f6b",
          tension: 0.35,
          fill: type === "line",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type !== "bar" } },
      },
    });
  }

  function names(items) {
    return (items || []).map((item) => item.nombre || "Sin informacion");
  }

  function amounts(items) {
    return (items || []).map((item) => Number(item.monto || item.cantidad || 0));
  }

  function productName(item, fallback) {
    return item?.Producto || item?.NombreProducto || item?.Categoria || item?.EspecificacionComprador || fallback || "Sin producto";
  }

  function entityNameFromOrden(orden, modo) {
    return modo === "clientes"
      ? orden.proveedor?.nombre || "Sin proveedor"
      : orden.comprador?.nombreOrganismo || "Sin cliente";
  }

  function productEntityOptions(ordenes = [], modo) {
    const entities = new Map();

    ordenes.forEach((orden) => {
      const entity = entityNameFromOrden(orden, modo);
      const current = entities.get(entity) || { nombre: entity, cantidad: 0 };
      current.cantidad += 1;
      entities.set(entity, current);
    });

    return Array.from(entities.values())
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
  }

  function productsForEntity(ordenes = [], modo, entityName) {
    const products = new Map();

    ordenes
      .filter((orden) => entityNameFromOrden(orden, modo) === entityName)
      .forEach((orden) => {
      const items = Array.isArray(orden.items) ? orden.items : [];

      if (!items.length) {
        return;
      }

      items.forEach((item) => {
        const product = productName(item, orden.nombre || orden.codigo);
        const cantidad = Number(String(item.Cantidad ?? "").replace(/[^\d.-]/g, ""));
        if (!Number.isFinite(cantidad) || cantidad <= 0) return;
        const current = products.get(product) || { nombre: product, cantidad: 0 };
        current.cantidad += cantidad;
        products.set(product, current);
      });
    });

    return Array.from(products.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 7);
  }

  function parseOrdenDate(value) {
    if (!value) return null;
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function monthlyTotalsByYear(ordenes = []) {
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const years = new Map();

    ordenes.forEach((orden) => {
      const date = parseOrdenDate(orden.fecha);
      if (!date) return;
      const year = String(date.getFullYear());
      const month = date.getMonth();
      const current = years.get(year) || Array.from({ length: 12 }, (_, index) => ({ nombre: monthNames[index], monto: 0 }));
      current[month].monto += Number(orden.total || 0);
      years.set(year, current);
    });

    return Array.from(years.entries())
      .sort(([yearA], [yearB]) => Number(yearA) - Number(yearB))
      .map(([year, months]) => ({ year, months: months.filter((month) => month.monto > 0) }))
      .filter((item) => item.months.length);
  }

  function renderMonthlyCharts(ordenes = []) {
    const container = document.getElementById("fechasPorAnoCharts");
    if (!container) return;

    Object.keys(charts)
      .filter((id) => id.startsWith("fechasAnoChart-"))
      .forEach((id) => {
        charts[id].destroy();
        delete charts[id];
      });

    container.innerHTML = "";
    const years = monthlyTotalsByYear(ordenes);

    if (!years.length) {
      container.innerHTML = '<p class="empty-chart">Sin montos mensuales para el periodo seleccionado.</p>';
      return;
    }

    years.forEach(({ year, months }) => {
      const block = document.createElement("article");
      block.className = "year-chart-card";
      const title = document.createElement("h3");
      title.textContent = year;
      const canvas = document.createElement("canvas");
      const canvasId = `fechasAnoChart-${year}`;
      canvas.id = canvasId;
      block.appendChild(title);
      block.appendChild(canvas);
      container.appendChild(block);
      chart(canvasId, "line", names(months), amounts(months), `Monto ${year}`);
    });
  }

  function renderProductEntityCard(ordenes = [], modo) {
    const selector = document.getElementById("productoEntidadSelector");
    if (!selector) return;

    const previousValue = selector.value;
    const options = productEntityOptions(ordenes, modo);
    selector.innerHTML = "";

    if (!options.length) {
      const option = document.createElement("option");
      option.textContent = modo === "clientes" ? "Sin proveedores" : "Sin clientes";
      option.disabled = true;
      selector.appendChild(option);
      chart("productoEntidadChart", "doughnut", [], [], "Cantidad");
      return;
    }

    options.forEach((entity) => {
      const option = document.createElement("option");
      option.value = entity.nombre;
      option.textContent = entity.nombre;
      selector.appendChild(option);
    });

    if (previousValue && options.some((entity) => entity.nombre === previousValue)) {
      selector.value = previousValue;
    }

    const selectedEntity = selector.value || options[0].nombre;
    const products = productsForEntity(ordenes, modo, selectedEntity);
    chart("productoEntidadChart", "doughnut", names(products), amounts(products), "Cantidad");
  }

  function entidadesDisponibles() {
    return modoActual === "clientes"
      ? clientes.map((item) => ({ codigo: item.codigoOrganismo, nombre: item.nombreOrganismo }))
      : proveedores.map((item) => ({ codigo: item.codigoProveedor, nombre: item.nombreProveedor }));
  }

  function renderEntidadSelector() {
    const select = document.getElementById("entidadSelector");
    if (!select) return;
    const selectedCodes = new Set(entidadesSeleccionadas.map((item) => item.codigo));
    const disponibles = entidadesDisponibles().filter((item) => item.codigo && !selectedCodes.has(item.codigo));
    select.innerHTML = "";

    if (!disponibles.length) {
      const option = document.createElement("option");
      option.disabled = true;
      option.textContent = modoActual === "clientes" ? "No hay clientes disponibles" : "No hay proveedores disponibles";
      select.appendChild(option);
      return;
    }

    disponibles.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.codigo;
      option.textContent = `${item.nombre || "Sin nombre"} (${item.codigo})`;
      select.appendChild(option);
    });
  }

  function renderEntidadesSeleccionadas() {
    const container = document.getElementById("entidadesSeleccionadas");
    if (!container) return;
    container.innerHTML = "";

    if (!entidadesSeleccionadas.length) {
      container.innerHTML = '<span class="empty-selection">Sin entidades agregadas.</span>';
      return;
    }

    entidadesSeleccionadas.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "selected-chip";
      chip.textContent = `${item.nombre || "Sin nombre"} x`;
      chip.addEventListener("click", () => {
        entidadesSeleccionadas = entidadesSeleccionadas.filter((selected) => selected.codigo !== item.codigo);
        renderEntidadSelector();
        renderEntidadesSeleccionadas();
        scheduleAnalisis();
      });
      container.appendChild(chip);
    });
  }

  function limpiarResultado() {
    ultimoResultado = null;
    document.getElementById("guardarAnalisisBtn").disabled = true;
    renderReport({ resumen: {}, ordenes: [], topProductosComprados: [], topProveedores: [], topClientesCompradores: [] }, [], modoActual);
    renderProgress({}, "idle");
  }

  function agregarEntidadActual() {
    const select = document.getElementById("entidadSelector");
    const codigo = select?.value;
    if (!codigo) return;
    const item = entidadesDisponibles().find((entidad) => entidad.codigo === codigo);
    if (!item || entidadesSeleccionadas.some((selected) => selected.codigo === item.codigo)) return;
    entidadesSeleccionadas.push(item);
    renderEntidadSelector();
    renderEntidadesSeleccionadas();
    scheduleAnalisis();
  }

  async function cargarSelectores() {
    try {
      const [proveedoresData, clientesData] = await Promise.all([
        MP.request("/proveedores-guardados", { silent: true }),
        MP.request("/clientes-observados", { silent: true }),
      ]);

      proveedores = MP.getListado(proveedoresData);
      clientes = MP.getListado(clientesData);
      renderEntidadSelector();
      renderEntidadesSeleccionadas();
    } catch (err) {
      renderEntidadSelector();
      renderEntidadesSeleccionadas();
    }
  }

  function renderPager(containerId, totalItems, currentPage, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    container.innerHTML = "";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn-secondary pager-btn";
    prev.textContent = "Anterior";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => onChange(currentPage - 1));

    const label = document.createElement("span");
    label.textContent = `${currentPage} / ${totalPages}`;

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn-secondary pager-btn";
    next.textContent = "Siguiente";
    next.disabled = currentPage >= totalPages;
    next.addEventListener("click", () => onChange(currentPage + 1));

    container.appendChild(prev);
    container.appendChild(label);
    container.appendChild(next);
  }

  function pageSlice(items, page) {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }

  function renderOrdenes(ordenes) {
    const tbody = document.getElementById("ordenesAnalizadasTable");
    if (!tbody) return;
    if (Array.isArray(ordenes)) {
      ordenesAnalizadas = ordenes;
      ordenesPage = 1;
    }

    tbody.innerHTML = "";

    if (!ordenesAnalizadas.length) {
      MP.renderEmpty(tbody, 6, "No hay ordenes de compra para los parametros seleccionados.");
      renderPager("ordenesPager", 0, 1, () => {});
      return;
    }

    pageSlice(ordenesAnalizadas, ordenesPage).forEach((orden) => {
      const row = document.createElement("tr");
      MP.appendCell(row, orden.codigo || "-");
      MP.appendCell(row, orden.proveedor?.nombre || "-");
      MP.appendCell(row, orden.comprador?.nombreOrganismo || "-");
      MP.appendCell(row, orden.fecha || "-");
      MP.appendCell(row, MP.formatMoney(orden.total || 0));
      MP.appendStatus(row, orden.estado || "-");
      tbody.appendChild(row);
    });

    renderPager("ordenesPager", ordenesAnalizadas.length, ordenesPage, (page) => {
      ordenesPage = page;
      renderOrdenes(null);
    });
  }

  function formatDate(value) {
    if (!value) return "-";
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

  async function cargarAnalisisGuardados() {
    const tbody = document.getElementById("analisisGuardadosTable");
    if (!tbody) return;

    try {
      const data = await MP.request("/reportes/guardados", { silent: true });
      analisisGuardados = MP.getListado(data);
      analisisPage = 1;
      renderAnalisisGuardadosPage();
    } catch (err) {
      MP.renderEmpty(tbody, 5, "No fue posible cargar analisis guardados.");
    }
  }

  function renderAnalisisGuardadosPage() {
    const tbody = document.getElementById("analisisGuardadosTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!analisisGuardados.length) {
      MP.renderEmpty(tbody, 5, "No hay analisis guardados.");
      renderPager("analisisPager", 0, 1, () => {});
      return;
    }

    pageSlice(analisisGuardados, analisisPage).forEach((item) => {
      const row = document.createElement("tr");
      MP.appendCell(row, formatDate(item.createdAt));
      MP.appendCell(row, item.modoAnalisis || "-");
      MP.appendCell(row, String(item.resumen?.totalOrdenes || 0));
      MP.appendCell(row, MP.formatMoney(item.resumen?.montoTotal || 0));
      const actionCell = document.createElement("td");
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "btn-primary pager-btn";
      viewBtn.textContent = "Ver";
      viewBtn.addEventListener("click", () => cargarAnalisisGuardado(item));
      actionCell.appendChild(viewBtn);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    renderPager("analisisPager", analisisGuardados.length, analisisPage, (page) => {
      analisisPage = page;
      renderAnalisisGuardadosPage();
    });
  }

  function setModoAnalisis(modo) {
    modoActual = modo === "clientes" ? "clientes" : "proveedores";
    document.querySelectorAll("#tipoAnalisisControl button").forEach((button) => {
      button.classList.toggle("active", button.dataset.modo === modoActual);
    });
  }

  function entidadesFromFiltros(filtros = {}) {
    const codes = modoActual === "clientes"
      ? filtros.clientesObservados || []
      : filtros.proveedoresObservados || [];
    const normalizedCodes = new Set(
      (Array.isArray(codes) ? codes : String(codes || "").split(","))
        .map((code) => String(code).trim())
        .filter(Boolean)
    );
    return entidadesDisponibles().filter((entidad) => normalizedCodes.has(String(entidad.codigo)));
  }

  function cargarAnalisisGuardado(item) {
    const filtros = item?.filtros || {};
    setModoAnalisis(filtros.modoAnalisis);
    const periodo = filtros.periodoAnalisis || "mes_actual";
    const periodoSelect = document.getElementById("periodoAnalisis");
    if (periodoSelect) periodoSelect.value = periodo;
    entidadesSeleccionadas = entidadesFromFiltros(filtros);
    renderEntidadSelector();
    renderEntidadesSeleccionadas();
    scheduleAnalisis();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderProgress(progress = {}, status = "idle") {
    const porcentaje = status === "idle" ? 0 : Number(progress.porcentaje || 0);
    document.getElementById("progressPercent").textContent = `${porcentaje}%`;
    document.getElementById("progressBar").style.width = `${Math.min(100, porcentaje)}%`;
    document.getElementById("ocEncontradas").textContent = progress.ocEncontradas || 0;
    document.getElementById("ocProcesadas").textContent = progress.ocProcesadas || 0;
    document.getElementById("ocOmitidas").textContent = progress.ocOmitidas || 0;
    document.getElementById("consultasOmitidas").textContent = progress.consultasOmitidas || 0;

    const total = progress.totalObjetivo || 0;
    const procesadas = Number(progress.ocProcesadas || 0) + Number(progress.ocOmitidas || 0);
    document.getElementById("progressText").textContent = status === "complete"
      ? "Analitica completa."
      : `Procesando ${procesadas} de ${total} OC validas.`;
  }

  function renderReport(data, seleccionados, modo) {
    document.getElementById("totalOrdenes").textContent = data.resumen?.totalOrdenes || 0;
    document.getElementById("montoTotal").textContent = MP.formatMoney(data.resumen?.montoTotal || 0);
    document.getElementById("promedioOrden").textContent = MP.formatMoney(data.resumen?.promedioOrden || 0);
    document.getElementById("seleccionadosCount").textContent = seleccionados.length;
    document.getElementById("seleccionadosLabel").textContent = modo === "clientes"
      ? "Clientes agregados al analisis."
      : "Proveedores agregados al analisis.";

    const isCliente = modo === "clientes";
    const relaciones = isCliente ? data.topProveedores : data.topClientesCompradores;
    document.getElementById("relacionesTitle").textContent = isCliente ? "Proveedores principales" : "Clientes compradores";
    document.getElementById("relacionesDesc").textContent = isCliente
      ? "Proveedores que mas venden a los clientes seleccionados."
      : "Organismos compradores a los que mas vende el proveedor seleccionado.";
    document.getElementById("productosMontoTitle").textContent = isCliente ? "Productos mas comprados" : "Productos o servicios mas vendidos";
    document.getElementById("productosMontoDesc").textContent = isCliente
      ? "Productos o servicios con mayor monto comprado por los clientes seleccionados."
      : "Productos o servicios con mayor monto vendido por los proveedores seleccionados.";
    document.getElementById("productoEntidadTitle").textContent = isCliente
      ? "Producto por proveedor"
      : "Producto por cliente";
    document.getElementById("productoEntidadDesc").textContent = isCliente
      ? "Cruce entre productos o servicios y proveedores que los venden."
      : "Cruce entre productos o servicios y clientes que los compran.";

    chart("productosCompradosChart", "bar", names(data.topProductosComprados), amounts(data.topProductosComprados), "Monto");
    chart("relacionesChart", "bar", names(relaciones), amounts(relaciones), "Monto");
    renderProductEntityCard(data.ordenes || [], modo);
    renderMonthlyCharts(data.ordenes || []);
    renderOrdenes(data.ordenes || []);
  }

  function buildPayload() {
    const codes = entidadesSeleccionadas.map((item) => item.codigo);
    return {
      modoAnalisis: modoActual,
      periodoAnalisis: selectedPeriodo(),
      ...(modoActual === "clientes"
        ? { clientesObservados: codes.join(",") }
        : { proveedoresObservados: codes.join(",") }),
    };
  }

  function scheduleAnalisis() {
    clearTimeout(debounceTimer);
    document.getElementById("guardarAnalisisBtn").disabled = true;
    ultimoResultado = null;

    if (!entidadesSeleccionadas.length) {
      limpiarResultado();
      return;
    }

    debounceTimer = setTimeout(() => generarReportes(), 500);
  }

  async function generarReportes() {
    const runId = ++analysisRunId;
    try {
      renderProgress({ porcentaje: 5 }, "running");
      const job = await MP.request("/reportes/jobs", {
        method: "POST",
        body: buildPayload(),
        silent: true,
      });
      if (!job?.id || runId !== analysisRunId) return;

      let data = null;
      while (!data && runId === analysisRunId) {
        await sleep(700);
        const status = await MP.request(`/reportes/jobs/${encodeURIComponent(job.id)}`, { silent: true });
        renderProgress(status.progress, status.status);

        if (status.status === "complete") {
          data = status.result;
        } else if (status.status === "error") {
          throw new Error(status.error || "No fue posible generar analitica");
        }
      }

      if (!data || runId !== analysisRunId) return;
      ultimoResultado = data;
      renderReport(data, entidadesSeleccionadas, modoActual);
      document.getElementById("guardarAnalisisBtn").disabled = false;
    } catch (err) {
      renderProgress({}, "idle");
    }
  }

  async function guardarAnalisisActual() {
    if (!ultimoResultado) return;
    const button = document.getElementById("guardarAnalisisBtn");
    button.disabled = true;
    try {
      await MP.request("/reportes/guardados", {
        method: "POST",
        body: { resultado: ultimoResultado },
        silent: true,
      });
      await cargarAnalisisGuardados();
    } catch (err) {
      button.disabled = false;
    }
  }

  document.querySelectorAll("#tipoAnalisisControl button").forEach((button) => {
    button.addEventListener("click", () => {
      setModoAnalisis(button.dataset.modo || "proveedores");
      entidadesSeleccionadas = [];
      renderEntidadSelector();
      renderEntidadesSeleccionadas();
      scheduleAnalisis();
    });
  });
  document.getElementById("agregarEntidadBtn").addEventListener("click", agregarEntidadActual);
  document.getElementById("periodoAnalisis").addEventListener("change", scheduleAnalisis);
  document.getElementById("guardarAnalisisBtn").addEventListener("click", guardarAnalisisActual);
  document.getElementById("refreshAnalisisBtn").addEventListener("click", cargarAnalisisGuardados);
  document.getElementById("productoEntidadSelector").addEventListener("change", () => {
    renderProductEntityCard(ultimoResultado?.ordenes || [], modoActual);
  });

  cargarSelectores();
  cargarAnalisisGuardados();
  limpiarResultado();
});
