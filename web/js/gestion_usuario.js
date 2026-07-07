document.addEventListener("DOMContentLoaded", () => {
  const API = "/api/usuarios";
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Debes iniciar sesion primero.");
    window.location.href = "login.html";
    return;
  }

  const headersJson = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
  };

  const usuariosTable = document.getElementById("usuariosTable");
  const formCrear = document.getElementById("crearUsuarioForm");

  const modal = document.getElementById("modalEditar");
  const cerrarModal = document.getElementById("cerrarModal");
  const formEditar = document.getElementById("editarUsuarioForm");

  let usuarioEditando = null;

  // --- MODALES ---
  const modalConfirm = document.getElementById("modalConfirm");
  const confirmMessage = document.getElementById("confirmMessage");
  const btnConfirmYes = document.getElementById("btnConfirmYes");
  const btnConfirmNo = document.getElementById("btnConfirmNo");

  const modalAlert = document.getElementById("modalAlert");
  const alertMessage = document.getElementById("alertMessage");
  const btnAlertOk = document.getElementById("btnAlertOk");

  function showConfirm(text) {
    return new Promise((resolve) => {
      confirmMessage.textContent = text;
      modalConfirm.style.display = "flex";

      btnConfirmYes.onclick = () => {
        modalConfirm.style.display = "none";
        resolve(true);
      };
      btnConfirmNo.onclick = () => {
        modalConfirm.style.display = "none";
        resolve(false);
      };
    });
  }

  function showAlert(text) {
    return new Promise((resolve) => {
      alertMessage.textContent = text;
      modalAlert.style.display = "flex";
      btnAlertOk.onclick = () => {
        modalAlert.style.display = "none";
        resolve();
      };
    });
  }

  const showError = async (res) => {
    try {
      const data = await res.json();
      await showAlert("❌ " + (data.error || data.details || "Error desconocido"));
    } catch {
      await showAlert("❌ Error desconocido");
    }
  };

  async function request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headersJson,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      await showAlert("Sesion expirada o no autorizada. Inicia sesion nuevamente.");
      window.location.href = "login.html";
      throw new Error("No autorizado");
    }

    return res;
  }

  // ============================
  // Obtener usuarios
  // ============================
  async function fetchUsuarios() {
    try {
      const res = await request(API);
      if (!res.ok) throw new Error("No se pudo obtener usuarios");
      const datos = await res.json();
      renderUsuarios(datos);
    } catch (err) {
      usuariosTable.innerHTML = `<tr><td colspan="4">⚠ Error al cargar usuarios</td></tr>`;
    }
  }

  // ============================
  // Renderizar tabla
  // ============================
  function renderUsuarios(lista) {
    usuariosTable.innerHTML = "";

    lista.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.nombre} ${u.apellido || ""}</td>
        <td>${u.email}</td>
        <td>${u.rol_id?.nombreRol || "sin rol"}</td>
        <td>
          <button class="btn-warning" data-id="${u._id}">✏ Editar</button>
          <button class="btn-danger" data-id="${u._id}">🗑 Eliminar</button>
        </td>
      `;
      usuariosTable.appendChild(tr);
    });
  }

  // ============================
  // Crear usuario
  // ============================
  formCrear.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nuevo = {
      nombre: document.getElementById("nombre").value.trim(),
      apellido: document.getElementById("apellido").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value.trim(),
      rolNombre: document.getElementById("rolNombre").value
    };

    if (!nuevo.nombre || !nuevo.email || !nuevo.password) {
      return showAlert("⚠ Completa nombre, email y contraseña.");
    }

    try {
      const res = await request(API, {
        method: "POST",
        body: JSON.stringify(nuevo)
      });

      if (!res.ok) return showError(res);

      formCrear.reset();
      fetchUsuarios();
      await showAlert("✅ Usuario creado correctamente");

    } catch (err) {
      await showAlert("❌ Error al crear usuario.");
    }
  });

  // ============================
  // Editar / Eliminar usuario
  // ============================
  usuariosTable.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    // --- ELIMINAR ---
    if (e.target.classList.contains("btn-danger")) {
      const ok = await showConfirm("¿Eliminar este usuario?");
      if (!ok) return;

      const res = await request(`${API}/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) return showError(res);

      fetchUsuarios();
      await showAlert("🗑 Usuario eliminado correctamente");
      return;
    }

    // --- EDITAR (abrir modal) ---
    if (e.target.classList.contains("btn-warning")) {
      usuarioEditando = id;

      const res = await request(`${API}/${id}`);
      if (!res.ok) return showError(res);

      const u = await res.json();

      document.getElementById("editNombre").value = u.nombre || "";
      document.getElementById("editApellido").value = u.apellido || "";
      document.getElementById("editEmail").value = u.email || "";
      document.getElementById("editRolNombre").value = u.rol_id?.nombreRol || "cliente";

      modal.style.display = "flex";
    }
  });

  // ============================
  // Guardar Edición
  // ============================
  formEditar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const update = {
      nombre: document.getElementById("editNombre").value.trim(),
      apellido: document.getElementById("editApellido").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      rolNombre: document.getElementById("editRolNombre").value
    };

    try {
      const res = await request(`${API}/${usuarioEditando}`, {
        method: "PUT",
        body: JSON.stringify(update)
      });

      if (!res.ok) return showError(res);

      modal.style.display = "none";
      fetchUsuarios();
      await showAlert("✏ Usuario actualizado correctamente");

    } catch (err) {
      await showAlert("❌ Error al actualizar usuario.");
    }
  });

  cerrarModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  fetchUsuarios();
});
