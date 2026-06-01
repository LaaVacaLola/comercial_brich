document.addEventListener("DOMContentLoaded", () => {
  const ctx1 = document.getElementById("ventasProveedorChart");
  if (ctx1) {
    new Chart(ctx1.getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Proveedor 1", "Proveedor 2", "Proveedor 3"],
        datasets: [{
          label: "Ventas ($)",
          data: [1200000, 800000, 600000],
          backgroundColor: ["#0a2f6b", "#27ae60", "#f1c40f"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctx2 = document.getElementById("comprasClienteChart");
  if (ctx2) {
    new Chart(ctx2.getContext("2d"), {
      type: "pie",
      data: {
        labels: ["Cliente 1", "Cliente 2", "Cliente 3"],
        datasets: [{
          data: [30, 45, 25],
          backgroundColor: ["#27ae60", "#0a2f6b", "#f1c40f"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctx3 = document.getElementById("ventasRegionChart");
  if (ctx3) {
    new Chart(ctx3.getContext("2d"), {
      type: "line",
      data: {
        labels: ["Región 1", "Región 2", "Región 3"],
        datasets: [{
          label: "Ventas ($)",
          data: [300000, 900000, 700000],
          borderColor: "#0a2f6b",
          backgroundColor: "rgba(10,47,107,0.2)",
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("orderModal");
  const orderDetails = document.getElementById("orderDetails");
  const closeBtn = document.querySelector(".close-btn");

  // Datos de ejemplo de órdenes
  const orders = {
    "OC-2025-01001": {
      folio: "OC-2025-01001",
      cliente: "Hospital Regional",
      fecha: "2025-09-10",
      total: "$450.000"
    },
    "OC-2025-01002": {
      folio: "OC-2025-01002",
      cliente: "Municipalidad de Arica",
      fecha: "2025-09-09",
      total: "$1.200.000"
    }
  };

  // Evita error si no existe el modal
  if (modal && orderDetails) {
    document.querySelectorAll(".table-wrapper .btn-secondary").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest("tr");
        const folio = row.querySelector("td:first-child").textContent.trim();

        if (orders[folio]) {
          const o = orders[folio];
          orderDetails.innerHTML = `
            <p><strong>Folio:</strong> ${o.folio}</p>
            <p><strong>Cliente:</strong> ${o.cliente}</p>
            <p><strong>Fecha:</strong> ${o.fecha}</p>
            <p><strong>Total:</strong> ${o.total}</p>
          `;
        } else {
          orderDetails.innerHTML = `<p>No se encontraron datos para esta orden.</p>`;
        }

        modal.style.display = "flex";
      });
    });

    // Cerrar modal
    if (closeBtn) {
      closeBtn.addEventListener("click", () => modal.style.display = "none");
    }
    window.addEventListener("click", (e) => { 
      if (e.target === modal) modal.style.display = "none"; 
    });
  }
});


