document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("userRole");
  const userName = localStorage.getItem("userName");

  if (!token || role !== "admin") {
    alert("Acceso denegado. Solo administradores pueden ingresar.");
    window.location.href = "login.html";
    return;
  }

// Mostrar nombre en bienvenida
  document.querySelector("h1").textContent = `Bienvenido(a), ${userName}`;

  // === Chart de Ventas ===
  const ctx1 = document.getElementById("ventasChart").getContext("2d");
  new Chart(ctx1, {
    type: "line",
    data: {
      labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
      datasets: [{
        label: "Ventas ($)",
        data: [1200, 1800, 3000, 2500, 3200, 4000],
        borderColor: "#0a2f6b",
        backgroundColor: "rgba(10, 47, 107, 0.2)",
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 1200, easing: "easeOutQuart" }
    }
  });

  // === Chart de Usuarios ===
  const ctx2 = document.getElementById("usuariosChart").getContext("2d");
  new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: ["Admins", "Clientes"],
      datasets: [{
        data: [5, 30],
        backgroundColor: ["#1f4e79", "#4db8ff"]
      }]
    },
    options: {
      responsive: true,
      animation: { animateScale: true }
    }
  });

  // Modal logout
const logoutBtn = document.getElementById("logoutBtn");
const modal = document.getElementById("logoutModal");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");

logoutBtn.addEventListener("click", () => modal.style.display = "flex");
cancelLogout.addEventListener("click", () => modal.style.display = "none");

confirmLogout.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

});