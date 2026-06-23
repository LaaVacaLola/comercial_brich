(function () {
  const API = "/api/empresa";

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function setStatus(msg, isError) {
    const el = document.getElementById("statusMessage");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("error", Boolean(isError));
  }

  function fillForm(data) {
    const fields = ["razonSocial", "rut", "email", "direccion", "telefono", "nombreContacto"];
    fields.forEach((field) => {
      const input = document.getElementById(field);
      if (input) input.value = data[field] || "";
    });
  }

  async function loadEmpresa() {
    setStatus("Cargando datos...");
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      fillForm(data);
      setStatus(data.razonSocial ? "Datos cargados correctamente." : "Aun no hay datos guardados.");
    } catch (err) {
      setStatus(`No se pudieron cargar los datos: ${err.message}`, true);
    }
  }

  async function saveEmpresa(event) {
    event.preventDefault();
    setStatus("Guardando...");

    const body = {
      razonSocial: document.getElementById("razonSocial")?.value || "",
      rut: document.getElementById("rut")?.value || "",
      email: document.getElementById("email")?.value || "",
      direccion: document.getElementById("direccion")?.value || "",
      telefono: document.getElementById("telefono")?.value || "",
      nombreContacto: document.getElementById("nombreContacto")?.value || "",
    };

    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setStatus("Datos guardados correctamente.");
    } catch (err) {
      setStatus(`Error al guardar: ${err.message}`, true);
    }
  }

  function init() {
    const form = document.getElementById("empresaForm");
    if (form) form.addEventListener("submit", saveEmpresa);
    loadEmpresa();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
