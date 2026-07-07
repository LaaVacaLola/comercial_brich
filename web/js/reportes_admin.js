document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const API_REPORTES = "/api/solicitudes-compra/reportes/resumen";
  const headers = { Authorization: `Bearer ${token}` };
  const charts = {};

  const fromDate = document.getElementById("fromDate");
  const toDate = document.getElementById("toDate");
  const clienteFilter = document.getElementById("clienteFilter");
  const generarReporteBtn = document.getElementById("generarReporteBtn");
  const exportExcelBtn = document.getElementById("exportExcelBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  const reportStatus = document.getElementById("reportStatus");
  const solicitudesReportTable = document.getElementById("solicitudesReportTable");
  const solicitudModal = document.getElementById("solicitudModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalTitle = document.getElementById("modalTitle");
  const solicitudDetails = document.getElementById("solicitudDetails");

  let reporteActual = null;

  function money(value) {
    return `$${Number(value || 0).toLocaleString("es-CL")}`;
  }

  function fechaTexto(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("es-CL");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type = "") {
    reportStatus.textContent = message || "";
    reportStatus.className = `status-line ${type}`.trim();
  }

  async function requestJson(url) {
    const response = await fetch(url, { headers });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = "login.html";
      throw new Error("Sesion expirada");
    }
    if (!response.ok) {
      throw new Error(data.details || data.error || `Error HTTP ${response.status}`);
    }
    return data;
  }

  function queryString() {
    const params = new URLSearchParams();
    if (fromDate.value) params.set("fromDate", fromDate.value);
    if (toDate.value) params.set("toDate", toDate.value);
    if (clienteFilter.value) params.set("cliente", clienteFilter.value);
    return params.toString();
  }

  function renderSummary(data) {
    const resumen = data.resumen || {};
    document.getElementById("totalSolicitudes").textContent = resumen.totalSolicitudes || 0;
    document.getElementById("totalNeto").textContent = money(resumen.neto);
    document.getElementById("totalIva").textContent = money(resumen.iva);
    document.getElementById("totalGeneral").textContent = money(resumen.total);
    document.getElementById("promedioSolicitud").textContent = money(resumen.promedioSolicitud);
  }

  function chart(id, type, labels, values, label) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas.getContext("2d"), {
      type,
      data: {
        labels: labels.length ? labels : ["Sin datos"],
        datasets: [{
          label,
          data: values.length ? values : [0],
          backgroundColor: ["#0a2f6b", "#27ae60", "#f1c40f", "#e74c3c", "#34495e", "#4db8ff"],
          borderColor: "#0a2f6b",
          borderWidth: 2,
          fill: type === "line",
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type !== "bar" } },
        scales: type === "pie" || type === "doughnut" ? {} : { y: { beginAtZero: true } },
      },
    });
  }

  function renderCharts(data) {
    const names = (items) => items.map((item) => item.nombre || "Sin informacion");
    const totals = (items) => items.map((item) => Number(item.total || 0));
    chart("ventasClienteChart", "bar", names(data.porCliente || []), totals(data.porCliente || []), "Total");
    chart("ventasMesChart", "line", names(data.porMes || []), totals(data.porMes || []), "Total");
    chart("productosChart", "bar", names(data.porProducto || []), totals(data.porProducto || []), "Monto");
  }

  function renderClienteOptions(data) {
    const selected = clienteFilter.value;
    clienteFilter.innerHTML = '<option value="">Todos los clientes</option>';
    (data.clientes || []).forEach((cliente) => {
      const option = document.createElement("option");
      option.value = cliente.rut || "";
      option.textContent = `${cliente.razonSocial || "Sin cliente"}${cliente.rut ? ` | ${cliente.rut}` : ""}`;
      clienteFilter.appendChild(option);
    });
    clienteFilter.value = selected;
  }

  function renderTable(data) {
    const solicitudes = data.solicitudes || [];
    solicitudesReportTable.innerHTML = "";

    if (!solicitudes.length) {
      solicitudesReportTable.innerHTML = '<tr><td colspan="7">No hay SOL aceptadas para los filtros seleccionados.</td></tr>';
      return;
    }

    solicitudes.forEach((solicitud) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(solicitud.folio || "")}</strong></td>
        <td>${escapeHtml(solicitud.cliente?.razonSocial || "")}</td>
        <td>${fechaTexto(solicitud.fecha)}</td>
        <td>${money(solicitud.neto)}</td>
        <td>${money(solicitud.iva)}</td>
        <td>${money(solicitud.total)}</td>
        <td><button class="btn-secondary btn-ver-sol" type="button" data-id="${solicitud.id}">Ver</button></td>
      `;
      solicitudesReportTable.appendChild(row);
    });
  }

  function renderReport(data) {
    reporteActual = data;
    renderClienteOptions(data);
    renderSummary(data);
    renderCharts(data);
    renderTable(data);
    const count = data.resumen?.totalSolicitudes || 0;
    setStatus(count ? `${count} SOL aceptadas encontradas.` : "Sin SOL aceptadas para los filtros seleccionados.", count ? "success" : "");
  }

  async function cargarReporte() {
    setStatus("Cargando reportes...");
    generarReporteBtn.disabled = true;
    try {
      const qs = queryString();
      const data = await requestJson(`${API_REPORTES}${qs ? `?${qs}` : ""}`);
      renderReport(data);
    } catch (err) {
      setStatus(err.message, "error");
      solicitudesReportTable.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
    } finally {
      generarReporteBtn.disabled = false;
    }
  }

  function abrirDetalle(id) {
    const solicitud = (reporteActual?.solicitudes || []).find((item) => String(item.id) === String(id));
    if (!solicitud) return;

    const rows = (solicitud.items || []).map((item) => `
      <tr>
        <td>${escapeHtml(item.sku || "")}</td>
        <td>${escapeHtml(item.nombre || "")}</td>
        <td>${Number(item.cantidad || 0)}</td>
        <td>${money(item.precioUnitario)}</td>
        <td>${money(item.subtotal)}</td>
      </tr>
    `).join("") || '<tr><td colspan="5">Sin items.</td></tr>';

    modalTitle.textContent = `Detalle ${solicitud.folio || "SOL"}`;
    solicitudDetails.innerHTML = `
      <div class="detail-grid">
        <p><strong>Cliente</strong><span>${escapeHtml(solicitud.cliente?.razonSocial || "")}</span></p>
        <p><strong>RUT</strong><span>${escapeHtml(solicitud.cliente?.rut || "")}</span></p>
        <p><strong>Fecha</strong><span>${fechaTexto(solicitud.fecha)}</span></p>
        <p><strong>Total</strong><span>${money(solicitud.total)}</span></p>
      </div>
      <table>
        <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    solicitudModal.style.display = "flex";
  }

  function exportarExcel() {
    if (!reporteActual || !window.XLSX) {
      setStatus("No hay datos o no esta disponible la libreria Excel.", "error");
      return;
    }

    const solicitudes = reporteActual.solicitudes || [];
    const resumenRows = [
      ["SOL aceptadas", reporteActual.resumen?.totalSolicitudes || 0],
      ["Neto", reporteActual.resumen?.neto || 0],
      ["IVA", reporteActual.resumen?.iva || 0],
      ["Total", reporteActual.resumen?.total || 0],
      ["Promedio SOL", reporteActual.resumen?.promedioSolicitud || 0],
    ];
    const solicitudRows = solicitudes.map((solicitud) => ({
      Folio: solicitud.folio,
      Cliente: solicitud.cliente?.razonSocial || "",
      RUT: solicitud.cliente?.rut || "",
      Fecha: fechaTexto(solicitud.fecha),
      Neto: solicitud.neto || 0,
      IVA: solicitud.iva || 0,
      Total: solicitud.total || 0,
    }));
    const productoRows = (reporteActual.porProducto || []).map((item) => ({
      Producto: item.nombre,
      SKU: item.sku || "",
      Cantidad: item.cantidad || 0,
      Total: item.total || 0,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resumenRows), "Resumen");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(solicitudRows), "SOL aceptadas");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productoRows), "Productos");
    XLSX.writeFile(workbook, "Reporte_SOL_Aceptadas.xlsx");
  }

  function exportarPdf() {
    const jsPdf = window.jspdf?.jsPDF;
    if (!reporteActual || !jsPdf) {
      setStatus("No hay datos o no esta disponible la libreria PDF.", "error");
      return;
    }

    const doc = new jsPdf({ orientation: "landscape", unit: "pt", format: "a4" });
    const solicitudes = reporteActual.solicitudes || [];
    let y = 42;

    doc.setFontSize(16);
    doc.text("Reporte de SOL aceptadas", 40, y);
    y += 28;
    doc.setFontSize(10);
    doc.text(`Total SOL: ${reporteActual.resumen?.totalSolicitudes || 0}`, 40, y);
    doc.text(`Neto: ${money(reporteActual.resumen?.neto)}`, 170, y);
    doc.text(`IVA: ${money(reporteActual.resumen?.iva)}`, 320, y);
    doc.text(`Total: ${money(reporteActual.resumen?.total)}`, 450, y);
    y += 26;

    doc.setFont(undefined, "bold");
    doc.text("Folio", 40, y);
    doc.text("Cliente", 130, y);
    doc.text("Fecha", 390, y);
    doc.text("Neto", 480, y);
    doc.text("IVA", 580, y);
    doc.text("Total", 670, y);
    doc.setFont(undefined, "normal");
    y += 16;

    solicitudes.slice(0, 28).forEach((solicitud) => {
      doc.text(String(solicitud.folio || ""), 40, y);
      doc.text(String(solicitud.cliente?.razonSocial || "").slice(0, 38), 130, y);
      doc.text(fechaTexto(solicitud.fecha), 390, y);
      doc.text(money(solicitud.neto), 480, y);
      doc.text(money(solicitud.iva), 580, y);
      doc.text(money(solicitud.total), 670, y);
      y += 18;
    });

    if (solicitudes.length > 28) {
      doc.text(`Se muestran 28 de ${solicitudes.length} SOL. Exporta Excel para el detalle completo.`, 40, y + 12);
    }

    doc.save("Reporte_SOL_Aceptadas.pdf");
  }

  generarReporteBtn.addEventListener("click", cargarReporte);
  exportExcelBtn.addEventListener("click", exportarExcel);
  exportPdfBtn.addEventListener("click", exportarPdf);
  solicitudesReportTable.addEventListener("click", (event) => {
    const button = event.target.closest(".btn-ver-sol");
    if (button?.dataset.id) abrirDetalle(button.dataset.id);
  });
  closeModalBtn.addEventListener("click", () => {
    solicitudModal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === solicitudModal) solicitudModal.style.display = "none";
  });

  cargarReporte();
});
