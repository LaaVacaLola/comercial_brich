document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;

  if (!MP.getTokenOrRedirect()) return;

  function text(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "-";
  }

  async function cargarAjustes() {
    try {
      MP.setMessage("Revisando configuracion del backend...");
      const data = await MP.request("/ajustes");

      text("adminStatus", data.sesionAdmin ? "OK" : "No validada");
      text("adminEmail", data.usuario?.email || "-");
      text("adminRole", data.usuario?.role || "-");
      text("ticketStatus", data.mercadoPublico?.ticketConfigurado ? "Configurado" : "No configurado");
      text("ticketSource", data.mercadoPublico?.ticketFuente || "-");
      text("ticketMasked", data.mercadoPublico?.ticketEnmascarado || "-");
      text("ticketLength", data.mercadoPublico?.ticketLargo || 0);
      text("ticketUpdated", data.mercadoPublico?.actualizadoEn || "-");
      text("baseUrl", data.mercadoPublico?.baseUrl || "-");

      MP.setMessage("Configuracion cargada.");
    } catch (err) {
      MP.setMessage(err.message, true);
      text("adminStatus", "Error");
    }
  }

  async function guardarTicket(event) {
    event.preventDefault();

    const input = document.getElementById("ticketInput");
    const ticket = input.value.trim();

    if (!ticket) {
      MP.setMessage("Ingresa un ticket antes de guardar.", true);
      return;
    }

    try {
      MP.setMessage("Guardando ticket en MongoDB...");
      const data = await MP.request("/ajustes/ticket", {
        method: "PUT",
        body: { ticket },
      });

      input.value = "";
      text("ticketStatus", "Configurado");
      text("ticketSource", data.mercadoPublico?.ticketFuente || "mongodb");
      text("ticketMasked", data.mercadoPublico?.ticketEnmascarado || "-");
      text("ticketLength", data.mercadoPublico?.ticketLargo || 0);
      text("ticketUpdated", data.mercadoPublico?.actualizadoEn || "-");
      MP.setMessage(data.message || "Ticket guardado correctamente.");
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  async function probarConexion() {
    const result = document.getElementById("testResult");

    try {
      MP.setMessage("Probando conexion con ChileCompra...");
      result.textContent = "Consultando compradores en ChileCompra...";
      const data = await MP.request("/ajustes/test");

      result.textContent = `${data.message} Compradores encontrados: ${data.compradoresEncontrados}.`;
      MP.setMessage("Conexion OK.");
    } catch (err) {
      result.textContent = err.message;
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("testBtn").addEventListener("click", probarConexion);
  document.getElementById("ticketForm").addEventListener("submit", guardarTicket);
  cargarAjustes();
});
