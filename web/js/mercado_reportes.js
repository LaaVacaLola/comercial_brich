document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const charts = {};

  if (!MP.getTokenOrRedirect()) return;

  function selectedValues(id) {
    return Array.from(document.getElementById(id)?.selectedOptions || [])
      .map((option) => option.value)
      .filter(Boolean);
  }

  function selectedLimit() {
    return document.getElementById("limiteOrdenes")?.value || "100";
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
        plugins: {
          legend: {
            display: type !== "bar",
          },
        },
      },
    });
  }

  function names(items) {
    return (items || []).map((item) => item.nombre || "Sin informacion");
  }

  function amounts(items) {
    return (items || []).map((item) => Number(item.monto || item.cantidad || 0));
  }

  function fillSelect(id, items, valueKey, labelKey, emptyText) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "";

    if (!items.length) {
      const option = document.createElement("option");
      option.disabled = true;
      option.textContent = emptyText;
      select.appendChild(option);
      return;
    }

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item[valueKey] || "";
      option.textContent = `${item[labelKey] || "Sin nombre"} (${item[valueKey] || "sin codigo"})`;
      select.appendChild(option);
    });
  }

  async function cargarSelectores() {
    try {
      MP.setMessage("Cargando proveedores y clientes observados...");
      const [proveedoresData, clientesData] = await Promise.all([
        MP.request("/proveedores-guardados", { silent: true }),
        MP.request("/clientes-observados", { silent: true }),
      ]);

      fillSelect(
        "proveedorSelector",
        MP.getListado(proveedoresData),
        "codigoProveedor",
        "nombreProveedor",
        "No hay proveedores guardados"
      );
      fillSelect(
        "clienteSelector",
        MP.getListado(clientesData),
        "codigoOrganismo",
        "nombreOrganismo",
        "No hay clientes guardados"
      );

      MP.setMessage("Selectores cargados. Selecciona proveedores y presiona Generar.");
    } catch (err) {
      MP.setMessage(`No se pudieron cargar selectores: ${err.message}`, true);
    }
  }

  function renderOrdenes(ordenes) {
    const tbody = document.getElementById("ordenesAnalizadasTable");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!ordenes.length) {
      MP.renderEmpty(tbody, 6, "No hay ordenes de compra para los proveedores/clientes seleccionados.");
      return;
    }

    ordenes.forEach((orden) => {
      const row = document.createElement("tr");
      MP.appendCell(row, orden.codigo || "-");
      MP.appendCell(row, orden.proveedor?.nombre || "-");
      MP.appendCell(row, orden.comprador?.nombreOrganismo || "-");
      MP.appendCell(row, orden.fecha || "-");
      MP.appendCell(row, MP.formatMoney(orden.total || 0));
      MP.appendStatus(row, orden.estado || "-");
      tbody.appendChild(row);
    });
  }

  function renderProgress(progress = {}, status = "running") {
    const porcentaje = Number(progress.porcentaje || 0);
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
      : `Procesando ${procesadas} de ${total} OC objetivo. Consultas API: ${progress.consultasProcesadas || 0}.`;
  }

  function renderReport(data, seleccionados, modo) {
    document.getElementById("totalOrdenes").textContent = data.resumen?.totalOrdenes || 0;
    document.getElementById("montoTotal").textContent = MP.formatMoney(data.resumen?.montoTotal || 0);
    document.getElementById("promedioOrden").textContent = MP.formatMoney(data.resumen?.promedioOrden || 0);
    document.getElementById("seleccionadosCount").textContent = seleccionados.length;
    document.getElementById("seleccionadosLabel").textContent = modo === "clientes"
      ? "Clientes usados para consultar OC por organismo comprador."
      : "Proveedores usados para consultar OC por proveedor.";

    chart("productosCompradosChart", "bar", names(data.topProductosComprados), amounts(data.topProductosComprados), "Monto");
    chart("clientesCompradoresChart", "bar", names(data.topClientesCompradores), amounts(data.topClientesCompradores), "Monto");
    chart("fechasChart", "line", names(data.porFecha), amounts(data.porFecha), "Monto");
    chart("estadosChart", "doughnut", names(data.porEstado), amounts(data.porEstado), "Monto");
    renderOrdenes(data.ordenes || []);
  }

  async function generarReportes(modo) {
    const proveedores = selectedValues("proveedorSelector");
    const clientes = selectedValues("clienteSelector");

    if (modo === "proveedores" && !proveedores.length) {
      MP.setMessage("Selecciona al menos un proveedor observado.", true);
      renderReport({ resumen: {}, ordenes: [] }, proveedores, modo);
      return;
    }

    if (modo === "clientes" && !clientes.length) {
      MP.setMessage("Selecciona al menos un cliente observado.", true);
      renderReport({ resumen: {}, ordenes: [] }, clientes, modo);
      return;
    }

    try {
      MP.setMessage(modo === "clientes"
        ? `Consultando hasta ${selectedLimit()} OC por clientes con cola lenta anti-429...`
        : `Consultando hasta ${selectedLimit()} OC por proveedores con cola lenta anti-429...`);
      const params = new URLSearchParams();
      params.set("modoAnalisis", modo);
      params.set("limiteOrdenes", selectedLimit());
      if (modo === "clientes") {
        params.set("clientesObservados", clientes.join(","));
      } else {
        params.set("proveedoresObservados", proveedores.join(","));
        if (clientes.length) params.set("clientesObservados", clientes.join(","));
      }

      const job = await MP.request("/reportes/jobs", {
        method: "POST",
        body: Object.fromEntries(params.entries()),
      });
      if (!job?.id) return;

      let data = null;
      while (!data) {
        await sleep(1000);
        const status = await MP.request(`/reportes/jobs/${encodeURIComponent(job.id)}`, { silent: true });
        renderProgress(status.progress, status.status);

        if (status.status === "complete") {
          data = status.result;
        } else if (status.status === "error") {
          throw new Error(status.error || "No fue posible generar analitica");
        }
      }

      renderReport(data, modo === "clientes" ? clientes : proveedores, modo);
      MP.setMessage(`Analitica generada con ${data.resumen?.totalOrdenes || 0} OC.`);
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("analizarProveedoresBtn").addEventListener("click", () => generarReportes("proveedores"));
  document.getElementById("analizarClientesBtn").addEventListener("click", () => generarReportes("clientes"));
  cargarSelectores();
});
