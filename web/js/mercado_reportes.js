document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const filterIds = ["fecha", "estado", "codigoOrganismo", "codigoProveedor"];
  const charts = {};

  if (!MP.getTokenOrRedirect()) return;

  function chart(id, type, labels, values, label) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(canvas.getContext("2d"), {
      type,
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          backgroundColor: ["#0a2f6b", "#27ae60", "#f1c40f", "#e74c3c", "#34495e", "#4db8ff", "#8e44ad", "#16a085"],
          borderColor: "#0a2f6b",
          tension: 0.35,
          fill: type === "line",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  function names(items) {
    return (items || []).map((item) => item.nombre || "Sin informacion");
  }

  function amounts(items) {
    return (items || []).map((item) => Number(item.monto || item.cantidad || 0));
  }

  async function generarReportes() {
    try {
      MP.setMessage("Generando analitica desde ChileCompra...");
      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/reportes${query ? `?${query}` : ""}`);

      document.getElementById("totalOrdenes").textContent = data.resumen?.totalOrdenes || 0;
      document.getElementById("montoTotal").textContent = MP.formatMoney(data.resumen?.montoTotal || 0);
      document.getElementById("promedioOrden").textContent = MP.formatMoney(data.resumen?.promedioOrden || 0);

      chart("proveedoresChart", "bar", names(data.topProveedores), amounts(data.topProveedores), "Monto");
      chart("compradoresChart", "bar", names(data.topCompradores), amounts(data.topCompradores), "Monto");
      chart("estadosChart", "doughnut", names(data.porEstado), (data.porEstado || []).map((item) => item.cantidad), "Cantidad");
      chart("fechasChart", "line", names(data.porFecha), amounts(data.porFecha), "Monto");

      MP.setMessage(`Analitica generada con ${data.resumen?.totalOrdenes || 0} ordenes.`);
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("generarBtn").addEventListener("click", generarReportes);
});
