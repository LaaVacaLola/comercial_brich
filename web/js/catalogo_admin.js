document.addEventListener("DOMContentLoaded", () => {
  // ============================================
  // 0) VERIFICAR TOKEN (protección de la ruta)
  // ============================================
  const token = localStorage.getItem("token");

  if (!token) {
    alert("⚠ Debes iniciar sesión primero.");
    window.location.href = "login.html";
    return; // 👈 no sigue ejecutando el script
  }

  // ============================================
  // 1) Referencias a elementos del DOM
  // ============================================
  const API = "/api/productos";

  const tabla = document.getElementById("tablaProductos");
  const selectCatalogo = document.getElementById("selectCatalogo");
  const btnAgregarProducto = document.getElementById("btnAgregarProducto");

  const modal = document.getElementById("ofertaModal");
  const closeModal = document.getElementById("closeModal");
  const productoNombre = document.getElementById("productoNombre");

  let productoOfertaID = null;

  // ============================================
  // 2) Cargar productos desde el backend
  // ============================================
  async function cargarProductos() {
    try {
      const res = await fetch(API, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token // 👈 AQUÍ VA EL TOKEN
        }
      });

      if (!res.ok) {
        console.error("Error HTTP:", res.status);
        tabla.innerHTML = `
          <tr>
            <td colspan="7">⚠ Error cargando productos (HTTP ${res.status})</td>
          </tr>`;
        return;
      }

      const productos = await res.json();
      renderTabla(productos);
      rellenarSelect(productos);

    } catch (err) {
      console.error(err);
      tabla.innerHTML = `
        <tr>
          <td colspan="7">⚠ Error cargando productos</td>
        </tr>`;
    }
  }

  // ============================================
  // 3) Rellenar SELECT superior
  // ============================================
  function rellenarSelect(lista) {
    selectCatalogo.innerHTML =
      `<option value="">Seleccionar producto del catálogo...</option>`;

    lista.forEach(p => {
      const op = document.createElement("option");
      op.value = p.nombre;
      op.textContent = p.nombre;
      selectCatalogo.appendChild(op);
    });
  }

  // ============================================
  // 4) Renderizar la tabla
  // ============================================
  function renderTabla(lista) {
    tabla.innerHTML = "";

    lista.forEach(p => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${p.id_padre || "-"}</td>
        <td>
          <img 
            src="${p.imagen || '../img/no-image.png'}" 
            alt="${p.nombre}" 
            class="img-producto"
          >
        <td>${p.region || "-"}</td>
        </td>
        <td>${p.nombre}</td>

        <td>
          <input class="precio-input" type="number" value="${p.precio}">
        </td>

        <td>
          <select class="select-activo">
            <option value="activo"   ${p.estado === "activo"   ? "selected" : ""}>Sí</option>
            <option value="inactivo" ${p.estado === "inactivo" ? "selected" : ""}>No</option>
          </select>
        </td>

        <td>
          <span class="status ${p.aprobado ? "success" : "danger"}">
            ${p.aprobado ? "Aprobado" : "Desaprobado"}
          </span>
        </td>

        <td>
          <button class="btn-warning btn-guardar" 
                  data-id="${p._id}">
            💾 Guardar
          </button>
          <button class="btn-secondary btn-oferta" 
                  data-id="${p._id}" 
                  data-nombre="${p.nombre}">
            + Oferta
          </button>
        </td>
      `;

      tabla.appendChild(tr);
    });
  }

  // ============================================
  // 5) Guardar cambios (PUT)
  // ============================================
  tabla.addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    // GUARDAR
    if (e.target.classList.contains("btn-guardar")) {
      const fila = e.target.closest("tr");

      const data = {
        precio: fila.querySelector(".precio-input").value,
        estado: fila.querySelector(".select-activo").value
      };

      try {
        const res = await fetch(`${API}/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token // 👈 token aquí también
          },
          body: JSON.stringify(data)
        });

        if (!res.ok) {
          alert("❌ Error al guardar (HTTP " + res.status + ")");
          return;
        }

        alert("✅ Producto actualizado correctamente");
        cargarProductos();
      } catch (err) {
        console.error(err);
        alert("❌ Error al guardar producto");
      }
    }

    // ABRIR MODAL OFERTA
    if (e.target.classList.contains("btn-oferta")) {
      productoOfertaID = id;
      productoNombre.textContent = e.target.dataset.nombre;
      modal.style.display = "flex";
    }
  });

  // ============================================
  // 6) Agregar producto (POST)
  // ============================================
  btnAgregarProducto.addEventListener("click", async () => {
    const nombre = selectCatalogo.value;
    if (!nombre) {
      alert("⚠ Selecciona un producto del catálogo");
      return;
    }

    const nuevo = {
      nombre,
      precio: 0,
      estado: "activo",
      aprobado: false
    };

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token // 👈 también aquí
        },
        body: JSON.stringify(nuevo)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("❌ Error al crear: " + (err.error || "HTTP " + res.status));
        return;
      }

      alert("📦 Producto agregado correctamente");
      cargarProductos();
    } catch (err) {
      console.error(err);
      alert("❌ Error al crear producto");
    }
  });

  // ============================================
  // 7) Modal Oferta (solo visual por ahora)
  // ============================================
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  document.getElementById("ofertaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    alert("✨ Oferta guardada (lógica a BD la hacemos después)");
    modal.style.display = "none";
  });

  // ============================================
  // 8) Cargar datos al iniciar
  // ============================================
  cargarProductos();
});
