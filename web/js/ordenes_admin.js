document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("orderModal");
  const closeBtn = document.querySelector(".close-btn");
  const details = document.getElementById("orderDetails");

  // Datos de ejemplo
  const orders = {
    1: {
      folio: "OC-2025-00123",
      cliente: "Municipalidad de Arica",
      organismo: "Cárcel de Arica",
      fecha: "2025-09-08",
      total: "$1.250.000",
      estado: "Pendiente",
      contacto: "Juan Pérez (juan@compra.cl)",
      direccion: "Av. Principal 123, Arica"
    },
    2: {
      folio: "OC-2025-00124",
      cliente: "Hospital Regional",
      organismo: "CCP",
      fecha: "2025-09-07",
      total: "$320.000",
      estado: "Aceptada",
      contacto: "Ana López (ana@compra.cl)",
      direccion: "Av. Central 456, Arica"
    }
  };

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const o = orders[id];

      details.innerHTML = `
        <p><strong>Folio:</strong> ${o.folio}</p>
        <p><strong>Cliente:</strong> ${o.cliente}</p>
        <p><strong>Organismo:</strong> ${o.organismo}</p>
        <p><strong>Fecha emisión:</strong> ${o.fecha}</p>
        <p><strong>Total:</strong> ${o.total}</p>
        <p><strong>Estado:</strong> ${o.estado}</p>
        <p><strong>Contacto:</strong> ${o.contacto}</p>
        <p><strong>Dirección:</strong> ${o.direccion}</p>
      `;

      modal.style.display = "flex";
    });
  });

  closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });
});
