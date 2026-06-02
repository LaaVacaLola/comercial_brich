document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const filterIds = ["fechaDesde", "fechaHasta", "estado", "codigoOrganismo", "codigoProveedor"];
  const charts = {};

  if (!MP.getTokenOrRedirect()) return;

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

    const fechaDesde = document.getElementById("fechaDesde") || document.getElementById("fecha");
    const fechaHasta = document.getElementById("fechaHasta");
    const estado = document.getElementById("estado");

    if (fechaDesde) fechaDesde.value = isoDate(weekAgo);
    if (fechaHasta) fechaHasta.value = isoDate(today);
    if (estado) estado.value = "todos";
  }

  function ensureReportInputs() {
    const oldFecha = document.getElementById("fecha");
    if (oldFecha && !document.getElementById("fechaDesde")) {
      oldFecha.id = "fechaDesde";
      oldFecha.setAttribute("aria-label", "Fecha desde");
      const hasta = document.createElement("input");
      hasta.type = "date";
      hasta.id = "fechaHasta";
      hasta.setAttribute("aria-label", "Fecha hasta");
      oldFecha.insertAdjacentElement("afterend", hasta);
    }
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

  function counts(items) {
    return (items || []).map((item) => Number(item.cantidad || 0));
  }

  async function generarReportes() {
    try {
      MP.setMessage("Generando analitica desde ChileCompra...");
      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/reportes${query ? `?${query}` : ""}`);
      if (!data) return;

      document.getElementById("totalOrdenes").textContent = data.resumen?.totalOrdenes || 0;
      document.getElementById("montoTotal").textContent = MP.formatMoney(data.resumen?.montoTotal || 0);
      document.getElementById("promedioOrden").textContent = MP.formatMoney(data.resumen?.promedioOrden || 0);

      const proveedores = (data.topProveedores || []).filter((item) => item.nombre !== "Sin informacion");
      const compradores = (data.topCompradores || []).filter((item) => item.nombre !== "Sin informacion");

      chart("proveedoresChart", "bar", names(proveedores), counts(proveedores), "Cantidad");
      chart("compradoresChart", "bar", names(compradores), counts(compradores), "Cantidad");
      chart("estadosChart", "doughnut", names(data.porEstado), counts(data.porEstado), "Cantidad");
      chart("fechasChart", "line", names(data.porFecha), counts(data.porFecha), "Cantidad");

      MP.setMessage(`Analitica generada con ${data.resumen?.totalOrdenes || 0} ordenes.`);
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  ensureReportInputs();
  setDefaultFilters();
  document.getElementById("generarBtn").addEventListener("click", generarReportes);
  generarReportes();
});
