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

  async function exportarExcel() {
    if (!reporteActual || !window.ExcelJS) {
      setStatus("No hay datos o no esta disponible la libreria Excel.", "error");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const generatedAt = new Date();
    const solicitudes = reporteActual.solicitudes || [];
    const resumen = reporteActual.resumen || {};
    const filtros = reporteActual.filtros || {};

    const brandBlue = "083C6F";
    const brandCyan = "0097C9";
    const brandGreen = "16A34A";
    const brandYellow = "FFC107";
    const lightBlue = "EAF3F8";
    const darkText = "1E293B";
    const mutedText = "64748B";
    const borderColor = "CBD5E1";
    const moneyFormat = '"$"#,##0';

    workbook.creator = "Comercial Brich";
    workbook.created = generatedAt;
    workbook.subject = "Reporte de Solicitudes de Compra";

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    async function loadLogo() {
      const paths = ["/img/logo.png", "../img/logo.png"];
      const errors = [];

      for (const path of paths) {
        try {
          const response = await fetch(path, { cache: "no-cache" });
          if (!response.ok) {
            errors.push(`${path}: HTTP ${response.status}`);
            continue;
          }

          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          const base64Data = String(dataUrl).split(",")[1] || "";

          if (!base64Data) {
            errors.push(`${path}: base64 vacio`);
            continue;
          }

          try {
            return workbook.addImage({ base64: dataUrl, extension: "png" });
          } catch (dataUrlErr) {
            console.warn("No se pudo insertar logo como Data URL, reintentando base64 limpio:", dataUrlErr.message);
            return workbook.addImage({ base64: base64Data, extension: "png" });
          }
        } catch (err) {
          errors.push(`${path}: ${err.message}`);
        }
      }

      console.warn("No se pudo cargar el logo para el Excel:", errors.join(" | "));
      return null;
    }

    const logoId = await loadLogo();

    function styleCell(cell, options = {}) {
      if (options.font) cell.font = options.font;
      if (options.fill) cell.fill = options.fill;
      if (options.alignment) cell.alignment = options.alignment;
      cell.border = options.border || {
        top: { style: "thin", color: { argb: borderColor } },
        left: { style: "thin", color: { argb: borderColor } },
        bottom: { style: "thin", color: { argb: borderColor } },
        right: { style: "thin", color: { argb: borderColor } },
      };
    }

    function addHeader(sheet, title, subtitle) {
      sheet.mergeCells("A1:B4");
      styleCell(sheet.getCell("A1"), {
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } },
        border: {
          top: { style: "medium", color: { argb: brandBlue } },
          left: { style: "medium", color: { argb: brandBlue } },
          bottom: { style: "medium", color: { argb: brandBlue } },
          right: { style: "medium", color: { argb: brandBlue } },
        },
      });

      if (logoId) {
        sheet.addImage(logoId, { tl: { col: 0.35, row: 0.35 }, ext: { width: 132, height: 78 } });
      } else {
        sheet.getCell("A1").value = "Comercial\nBrich";
        sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: brandBlue } };
        sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }

      sheet.mergeCells("C1:H2");
      sheet.getCell("C1").value = "Comercial Brich";
      styleCell(sheet.getCell("C1"), {
        font: { bold: true, size: 20, color: { argb: "FFFFFF" } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: brandBlue } },
        alignment: { horizontal: "center", vertical: "middle" },
      });

      sheet.mergeCells("C3:H3");
      sheet.getCell("C3").value = title;
      styleCell(sheet.getCell("C3"), {
        font: { bold: true, size: 14, color: { argb: brandBlue } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "middle" },
      });

      sheet.mergeCells("C4:H4");
      sheet.getCell("C4").value = subtitle;
      styleCell(sheet.getCell("C4"), {
        font: { italic: true, size: 10, color: { argb: mutedText } },
        alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      });

      sheet.getRow(1).height = 26;
      sheet.getRow(2).height = 24;
      sheet.getRow(3).height = 24;
      sheet.getRow(4).height = 22;
    }

    function styleHeaderRow(row) {
      row.height = 26;
      row.eachCell((cell) => {
        styleCell(cell, {
          font: { bold: true, color: { argb: "FFFFFF" } },
          fill: { type: "pattern", pattern: "solid", fgColor: { argb: brandBlue } },
          alignment: { horizontal: "center", vertical: "middle", wrapText: true },
          border: {
            top: { style: "thin", color: { argb: brandBlue } },
            left: { style: "thin", color: { argb: brandBlue } },
            bottom: { style: "thin", color: { argb: brandBlue } },
            right: { style: "thin", color: { argb: brandBlue } },
          },
        });
      });
    }

    function styleDataRow(row, index, textColumns = []) {
      row.eachCell((cell, colNumber) => {
        styleCell(cell, {
          fill: index % 2 === 1 ? { type: "pattern", pattern: "solid", fgColor: { argb: "F8FAFC" } } : undefined,
          alignment: {
            horizontal: textColumns.includes(colNumber) ? "left" : "center",
            vertical: "top",
            wrapText: textColumns.includes(colNumber),
          },
        });
      });
    }

    function addSectionTitle(sheet, rowNumber, title) {
      sheet.mergeCells(`A${rowNumber}:H${rowNumber}`);
      sheet.getCell(`A${rowNumber}`).value = title;
      styleCell(sheet.getCell(`A${rowNumber}`), {
        font: { bold: true, size: 12, color: { argb: "FFFFFF" } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: brandCyan } },
        alignment: { horizontal: "left", vertical: "middle" },
      });
      sheet.getRow(rowNumber).height = 24;
    }

    function setMoney(cells) {
      cells.forEach((cell) => {
        cell.numFmt = moneyFormat;
      });
    }

    const resumenSheet = workbook.addWorksheet("Resumen", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    resumenSheet.columns = [
      { width: 26 }, { width: 30 }, { width: 6 }, { width: 20 },
      { width: 24 }, { width: 6 }, { width: 18 }, { width: 24 },
    ];
    addHeader(resumenSheet, "Reporte de Solicitudes de Compra", "SOL aceptadas - resumen ejecutivo");

    const filtroRows = [
      ["Fecha de generacion", generatedAt.toLocaleString("es-CL"), "", "Desde", filtros.fromDate || "Sin filtro", "", "Hasta", filtros.toDate || "Sin filtro"],
      ["Cliente", filtros.cliente || "Todos los clientes", "", "Estado", filtros.estado || "aceptada", "", "Registros", resumen.totalSolicitudes || 0],
    ];
    filtroRows.forEach((values, index) => {
      const row = resumenSheet.getRow(5 + index);
      row.values = values;
      row.height = index === 1 ? 34 : 28;
      [1, 4, 7].forEach((col) => {
        styleCell(row.getCell(col), {
          font: { bold: true, color: { argb: brandBlue } },
          fill: { type: "pattern", pattern: "solid", fgColor: { argb: lightBlue } },
        });
      });
      [2, 5, 8].forEach((col) => {
        styleCell(row.getCell(col), {
          font: { bold: true, color: { argb: darkText } },
          alignment: { vertical: "middle", wrapText: true },
        });
      });
    });

    addSectionTitle(resumenSheet, 8, "Resumen financiero");
    const summaryCards = [
      ["SOL aceptadas", resumen.totalSolicitudes || 0],
      ["Neto", resumen.neto || 0],
      ["IVA", resumen.iva || 0],
      ["Total", resumen.total || 0],
      ["Promedio SOL", resumen.promedioSolicitud || 0],
    ];
    summaryCards.forEach((item, index) => {
      const startCol = 1 + index;
      const labelCell = resumenSheet.getRow(10).getCell(startCol);
      const valueCell = resumenSheet.getRow(11).getCell(startCol);
      labelCell.value = item[0];
      valueCell.value = item[1];
      styleCell(labelCell, {
        font: { bold: true, color: { argb: "FFFFFF" } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: brandBlue } },
        alignment: { horizontal: "center", vertical: "middle" },
      });
      styleCell(valueCell, {
        font: { bold: true, size: 12, color: { argb: index === 3 ? "FFFFFF" : darkText } },
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: index === 3 ? brandGreen : lightBlue } },
        alignment: { horizontal: "center", vertical: "middle" },
      });
      if (index > 0) valueCell.numFmt = moneyFormat;
    });
    resumenSheet.getRow(10).height = 24;
    resumenSheet.getRow(11).height = 34;

    addSectionTitle(resumenSheet, 14, "Top clientes por total");
    const clientesHeader = resumenSheet.getRow(16);
    clientesHeader.values = ["Cliente", "RUT", "SOL", "Total"];
    styleHeaderRow(clientesHeader);
    (reporteActual.porCliente || []).forEach((item, index) => {
      const row = resumenSheet.getRow(17 + index);
      row.values = [item.nombre || "Sin cliente", item.rut || "", item.cantidad || 0, item.total || 0];
      row.height = Math.max(28, Math.min(64, 22 + Math.ceil(String(item.nombre || "").length / 34) * 12));
      styleDataRow(row, index, [1, 2]);
      row.getCell(4).numFmt = moneyFormat;
    });

    const solSheet = workbook.addWorksheet("SOL aceptadas", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    solSheet.columns = [
      { width: 20 }, { width: 44 }, { width: 18 }, { width: 14 },
      { width: 18 }, { width: 18 }, { width: 18 }, { width: 12 },
    ];
    addHeader(solSheet, "SOL aceptadas", "Detalle de solicitudes aceptadas");
    const solHeader = solSheet.getRow(5);
    solHeader.values = ["Folio", "Cliente", "RUT", "Fecha", "Neto", "IVA", "Total", "Items"];
    styleHeaderRow(solHeader);
    solicitudes.forEach((solicitud, index) => {
      const row = solSheet.getRow(6 + index);
      row.values = [
        solicitud.folio || "",
        solicitud.cliente?.razonSocial || "",
        solicitud.cliente?.rut || "",
        fechaTexto(solicitud.fecha),
        solicitud.neto || 0,
        solicitud.iva || 0,
        solicitud.total || 0,
        (solicitud.items || []).length,
      ];
      row.height = Math.max(30, Math.min(72, 22 + Math.ceil(String(row.getCell(2).value || "").length / 36) * 14));
      styleDataRow(row, index, [1, 2, 3]);
      setMoney([row.getCell(5), row.getCell(6), row.getCell(7)]);
    });
    solSheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + solicitudes.length, column: 8 } };

    const productosSheet = workbook.addWorksheet("Productos", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    productosSheet.columns = [
      { width: 64 }, { width: 28 }, { width: 14 }, { width: 20 },
    ];
    addHeader(productosSheet, "Productos vendidos", "Ranking por monto en SOL aceptadas");
    const productosHeader = productosSheet.getRow(5);
    productosHeader.values = ["Producto", "SKU", "Cantidad", "Total"];
    styleHeaderRow(productosHeader);
    (reporteActual.porProducto || []).forEach((item, index) => {
      const row = productosSheet.getRow(6 + index);
      row.values = [item.nombre || "", item.sku || "", item.cantidad || 0, item.total || 0];
      row.height = Math.max(30, Math.min(78, 22 + Math.ceil(String(item.nombre || "").length / 46) * 14));
      styleDataRow(row, index, [1, 2]);
      row.getCell(4).numFmt = moneyFormat;
    });
    productosSheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + (reporteActual.porProducto || []).length, column: 4 } };

    const detalleSheet = workbook.addWorksheet("Detalle items", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    detalleSheet.columns = [
      { width: 20 }, { width: 14 }, { width: 42 }, { width: 20 },
      { width: 64 }, { width: 12 }, { width: 20 }, { width: 20 },
    ];
    addHeader(detalleSheet, "Detalle de items", "Productos incluidos en cada SOL aceptada");
    const detalleHeader = detalleSheet.getRow(5);
    detalleHeader.values = ["Folio", "Fecha", "Cliente", "SKU", "Producto", "Cantidad", "Precio unitario", "Subtotal"];
    styleHeaderRow(detalleHeader);
    let detailRowNumber = 6;
    solicitudes.forEach((solicitud) => {
      (solicitud.items || []).forEach((item) => {
        const row = detalleSheet.getRow(detailRowNumber);
        row.values = [
          solicitud.folio || "",
          fechaTexto(solicitud.fecha),
          solicitud.cliente?.razonSocial || "",
          item.sku || "",
          item.nombre || "",
          item.cantidad || 0,
          item.precioUnitario || 0,
          item.subtotal || 0,
        ];
        const longestText = Math.max(
          String(solicitud.cliente?.razonSocial || "").length / 34,
          String(item.nombre || "").length / 46,
          String(item.sku || "").length / 18
        );
        row.height = Math.max(30, Math.min(86, 22 + Math.ceil(longestText) * 14));
        styleDataRow(row, detailRowNumber, [1, 2, 3, 4, 5]);
        setMoney([row.getCell(7), row.getCell(8)]);
        detailRowNumber += 1;
      });
    });
    detalleSheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, detailRowNumber - 1), column: 8 } };

    workbook.eachSheet((sheet) => {
      sheet.views = [{ showGridLines: false }];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Reporte_SOL_Aceptadas_${generatedAt.toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Excel generado correctamente.", "success");
  }

  async function exportarPdf() {
    const jsPdf = window.jspdf?.jsPDF;
    if (!reporteActual || !jsPdf) {
      setStatus("No hay datos o no esta disponible la libreria PDF.", "error");
      return;
    }

    const doc = new jsPdf({ orientation: "landscape", unit: "pt", format: "a4" });
    const solicitudes = reporteActual.solicitudes || [];
    const resumen = reporteActual.resumen || {};
    const generatedAt = new Date();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 34;
    const colors = {
      primary: [10, 47, 107],
      accent: [39, 174, 96],
      gold: [241, 196, 15],
      text: [33, 37, 41],
      muted: [91, 105, 120],
      border: [215, 224, 235],
      soft: [244, 248, 252],
      white: [255, 255, 255],
    };

    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const loadLogo = async () => {
      const sources = ["/img/logo.png", "../img/logo.png"];
      for (const source of sources) {
        try {
          const response = await fetch(source);
          if (!response.ok) continue;
          return await blobToDataUrl(await response.blob());
        } catch (error) {
          console.warn("No se pudo cargar el logo para PDF", error);
        }
      }
      return "";
    };

    const logoDataUrl = await loadLogo();
    const split = (text, width) => doc.splitTextToSize(String(text || ""), width);
    const addText = (text, x, y, options = {}) => {
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(options.size || 8);
      doc.setTextColor(...(options.color || colors.text));
      if (options.align) {
        doc.text(String(text || ""), x, y, { align: options.align });
        return;
      }
      doc.text(String(text || ""), x, y);
    };
    const filterText = [
      fromDate.value ? `Desde ${fechaTexto(fromDate.value)}` : "Desde: sin filtro",
      toDate.value ? `Hasta ${fechaTexto(toDate.value)}` : "Hasta: sin filtro",
      clienteFilter.value ? `Cliente: ${clienteFilter.options[clienteFilter.selectedIndex]?.text || clienteFilter.value}` : "Cliente: todos",
    ].join("  |  ");

    const addHeader = () => {
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 96, "F");
      doc.setFillColor(...colors.accent);
      doc.rect(0, 92, pageWidth, 4, "F");

      if (logoDataUrl) {
        doc.setFillColor(...colors.white);
        doc.roundedRect(margin, 20, 86, 48, 8, 8, "F");
        doc.addImage(logoDataUrl, "PNG", margin + 10, 27, 66, 34, undefined, "FAST");
      } else {
        doc.setFillColor(...colors.white);
        doc.roundedRect(margin, 20, 86, 48, 8, 8, "F");
        addText("Comercial", margin + 43, 39, { size: 9, bold: true, color: colors.primary, align: "center" });
        addText("Brich", margin + 43, 52, { size: 9, bold: true, color: colors.primary, align: "center" });
      }

      addText("Reporte de Solicitudes de Compra", 136, 34, { size: 18, bold: true, color: colors.white });
      addText("SOL aceptadas - resumen ejecutivo y detalle comercial", 136, 54, { size: 9, color: [226, 236, 248] });
      addText(filterText, 136, 72, { size: 8, color: [226, 236, 248] });
      addText(`Generado: ${generatedAt.toLocaleString("es-CL")}`, pageWidth - margin, 34, {
        size: 8,
        color: [226, 236, 248],
        align: "right",
      });
    };

    const addFooter = () => {
      const page = doc.internal.getNumberOfPages();
      doc.setDrawColor(...colors.border);
      doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);
      addText("Comercial Brich - Reporte interno de solicitudes de compra", margin, pageHeight - 14, {
        size: 7,
        color: colors.muted,
      });
      addText(`Pagina ${page}`, pageWidth - margin, pageHeight - 14, { size: 7, color: colors.muted, align: "right" });
    };

    const newPage = () => {
      addFooter();
      doc.addPage();
      addHeader();
      return 124;
    };

    const summaryCards = [
      ["SOL aceptadas", resumen.totalSolicitudes || 0, colors.primary],
      ["Neto", money(resumen.neto), colors.accent],
      ["IVA", money(resumen.iva), colors.gold],
      ["Total", money(resumen.total), colors.primary],
      ["Promedio", money(resumen.promedioSolicitud), colors.accent],
    ];

    addHeader();
    let y = 124;
    const cardWidth = (pageWidth - margin * 2 - 32) / 5;
    summaryCards.forEach(([label, value, color], index) => {
      const x = margin + index * (cardWidth + 8);
      doc.setFillColor(...colors.soft);
      doc.roundedRect(x, y, cardWidth, 54, 6, 6, "F");
      doc.setFillColor(...color);
      doc.rect(x, y, cardWidth, 5, "F");
      addText(label, x + 10, y + 23, { size: 7, bold: true, color: colors.muted });
      addText(value, x + 10, y + 43, { size: 11, bold: true, color: colors.text });
    });
    y += 82;

    const drawRanking = (title, rows, x, startY, columns) => {
      addText(title, x, startY, { size: 11, bold: true, color: colors.primary });
      let rowY = startY + 16;
      doc.setFillColor(...colors.primary);
      doc.roundedRect(x, rowY, 370, 22, 5, 5, "F");
      columns.forEach((column) => addText(column.label, x + column.offset, rowY + 14, {
        size: 7,
        bold: true,
        color: colors.white,
        align: column.align,
      }));
      rowY += 24;
      rows.slice(0, 5).forEach((row, index) => {
        doc.setFillColor(...(index % 2 ? colors.white : colors.soft));
        doc.rect(x, rowY - 2, 370, 24, "F");
        addText(String(row.nombre || "Sin informacion").slice(0, 42), x + 10, rowY + 12, { size: 7, color: colors.text });
        addText(money(row.total), x + 270, rowY + 12, { size: 7, bold: true, color: colors.text, align: "right" });
        addText(String(row.cantidad || 0), x + 350, rowY + 12, { size: 7, color: colors.text, align: "right" });
        rowY += 24;
      });
      if (!rows.length) addText("Sin informacion para mostrar.", x + 10, rowY + 12, { size: 8, color: colors.muted });
    };

    drawRanking("Clientes con mayor venta", reporteActual.porCliente || [], margin, y, [
      { label: "Cliente", offset: 10 },
      { label: "Total", offset: 270, align: "right" },
      { label: "SOL", offset: 350, align: "right" },
    ]);
    drawRanking("Productos con mayor monto", reporteActual.porProducto || [], margin + 402, y, [
      { label: "Producto", offset: 10 },
      { label: "Total", offset: 270, align: "right" },
      { label: "Cant.", offset: 350, align: "right" },
    ]);
    y += 174;

    addText("Detalle de solicitudes aceptadas", margin, y, { size: 12, bold: true, color: colors.primary });
    y += 16;

    const columns = [
      { label: "Folio", x: margin + 8, width: 72 },
      { label: "Cliente", x: margin + 88, width: 225 },
      { label: "Fecha", x: margin + 322, width: 72 },
      { label: "Items", x: margin + 405, width: 42, align: "right" },
      { label: "Neto", x: margin + 502, width: 84, align: "right" },
      { label: "IVA", x: margin + 610, width: 74, align: "right" },
      { label: "Total", x: margin + 744, width: 74, align: "right" },
    ];

    const drawTableHeader = () => {
      doc.setFillColor(...colors.primary);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 5, 5, "F");
      columns.forEach((column) => addText(column.label, column.x, y + 15, {
        size: 7,
        bold: true,
        color: colors.white,
        align: column.align,
      }));
      y += 28;
    };

    drawTableHeader();
    solicitudes.forEach((solicitud, index) => {
      const clienteLines = split(solicitud.cliente?.razonSocial || "Sin cliente", 218).slice(0, 2);
      const rowHeight = Math.max(28, 16 + clienteLines.length * 10);
      if (y + rowHeight > pageHeight - 42) {
        y = newPage();
        addText("Detalle de solicitudes aceptadas", margin, y, { size: 12, bold: true, color: colors.primary });
        y += 16;
        drawTableHeader();
      }

      doc.setFillColor(...(index % 2 ? colors.white : colors.soft));
      doc.rect(margin, y - 2, pageWidth - margin * 2, rowHeight, "F");
      addText(solicitud.folio || "", columns[0].x, y + 13, { size: 7, bold: true, color: colors.text });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...colors.text);
      doc.text(clienteLines, columns[1].x, y + 12);
      addText(fechaTexto(solicitud.fecha), columns[2].x, y + 13, { size: 7, color: colors.text });
      addText(String((solicitud.items || []).length), columns[3].x, y + 13, { size: 7, color: colors.text, align: "right" });
      addText(money(solicitud.neto), columns[4].x, y + 13, { size: 7, color: colors.text, align: "right" });
      addText(money(solicitud.iva), columns[5].x, y + 13, { size: 7, color: colors.text, align: "right" });
      addText(money(solicitud.total), columns[6].x, y + 13, { size: 7, bold: true, color: colors.text, align: "right" });
      y += rowHeight;
    });

    if (!solicitudes.length) {
      addText("No hay solicitudes aceptadas para los filtros seleccionados.", margin + 10, y + 18, {
        size: 9,
        color: colors.muted,
      });
    }

    addFooter();
    doc.save(`Reporte_SOL_Aceptadas_${generatedAt.toISOString().slice(0, 10)}.pdf`);
    setStatus("PDF generado correctamente.", "success");
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
