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
  const btnNormalizarPrecios = document.getElementById("btnNormalizarPrecios");

  const modal = document.getElementById("ofertaModal");
  const closeModal = document.getElementById("closeModal");
  const productoNombre = document.getElementById("productoNombre");
  const ofertaForm = document.getElementById("ofertaForm");
  const ofertaPorcentaje = document.getElementById("ofertaPorcentaje");
  const ofertaMonto = document.getElementById("ofertaMonto");
  const ofertaInicio = document.getElementById("ofertaInicio");
  const ofertaFin = document.getElementById("ofertaFin");
  const normalizarPreciosModal = document.getElementById("normalizarPreciosModal");
  const closeNormalizarPreciosModal = document.getElementById("closeNormalizarPreciosModal");
  const confirmNormalizarPrecios = document.getElementById("confirmNormalizarPrecios");
  const normalizarPreciosResultado = document.getElementById("normalizarPreciosResultado");

  let productoOfertaID = null;
  let productoOfertaPrecio = 0;

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
      tr.className = "hover:bg-gray-50 transition";

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
          <input class="precio-input w-28 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" type="number" value="${p.precio}">
        </td>

        <td>
          <select class="select-activo rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
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
          <button class="btn-warning btn-guardar rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600" 
                  data-id="${p._id}">
            💾 Guardar
          </button>
          <button class="btn-secondary btn-oferta rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800" 
                  data-id="${p._id}" 
                  data-nombre="${p.nombre}"
                  data-precio="${p.precio}">
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
      productoOfertaPrecio = Number(e.target.dataset.precio || 0);
      productoNombre.textContent = e.target.dataset.nombre;
      ofertaForm.reset();
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
  // 7) Modal Oferta
  // ============================================
  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
    if (e.target === normalizarPreciosModal) normalizarPreciosModal.style.display = "none";
  });

  function calcularMontoDesdePorcentaje() {
    const porcentaje = Number(ofertaPorcentaje.value);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || !productoOfertaPrecio) return;
    ofertaMonto.value = Math.round((productoOfertaPrecio * porcentaje) / 100);
  }

  function calcularPorcentajeDesdeMonto() {
    const monto = Number(ofertaMonto.value);
    if (!Number.isFinite(monto) || monto < 0 || !productoOfertaPrecio) return;
    ofertaPorcentaje.value = ((monto / productoOfertaPrecio) * 100).toFixed(2);
  }

  ofertaPorcentaje.addEventListener("input", calcularMontoDesdePorcentaje);
  ofertaMonto.addEventListener("input", calcularPorcentajeDesdeMonto);

  ofertaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!productoOfertaID) return;

    if (!ofertaPorcentaje.value && !ofertaMonto.value) {
      alert("Ingresa porcentaje o monto de descuento");
      return;
    }

    try {
      const res = await fetch(`${API}/${productoOfertaID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          oferta: {
            fecha_inicio: ofertaInicio.value,
            fecha_termino: ofertaFin.value,
            porcentaje_descuento: ofertaPorcentaje.value,
            monto_descuento: ofertaMonto.value
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Error al guardar oferta: " + (err.details || err.error || "HTTP " + res.status));
        return;
      }

      alert("Oferta guardada correctamente");
      modal.style.display = "none";
      cargarProductos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar oferta");
    }

    return;
    alert("✨ Oferta guardada (lógica a BD la hacemos después)");
    modal.style.display = "none";
  });

  // ============================================
  // 8) Normalizar precios
  // ============================================
  btnNormalizarPrecios.addEventListener("click", () => {
    normalizarPreciosResultado.textContent = "Todavia no se ha ejecutado el proceso.";
    confirmNormalizarPrecios.disabled = false;
    confirmNormalizarPrecios.textContent = "Ejecutar normalizacion";
    normalizarPreciosModal.style.display = "flex";
  });

  closeNormalizarPreciosModal.addEventListener("click", () => {
    normalizarPreciosModal.style.display = "none";
  });

  confirmNormalizarPrecios.addEventListener("click", async () => {
    confirmNormalizarPrecios.disabled = true;
    confirmNormalizarPrecios.textContent = "Procesando...";
    normalizarPreciosResultado.textContent = "Normalizando precios, espera un momento...";

    try {
      const res = await fetch(`${API}/precios/normalizar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        normalizarPreciosResultado.textContent = data.details || data.error || `Error HTTP ${res.status}`;
        confirmNormalizarPrecios.disabled = false;
        confirmNormalizarPrecios.textContent = "Reintentar";
        return;
      }

      normalizarPreciosResultado.innerHTML = `
        <strong>Proceso completado.</strong><br>
        Productos revisados: ${data.total}<br>
        Productos actualizados: ${data.actualizados}<br>
        Sin cambios: ${data.sinCambios}<br>
        Omitidos por precio invalido: ${data.omitidos}
      `;
      confirmNormalizarPrecios.textContent = "Proceso ejecutado";
      cargarProductos();
    } catch (err) {
      console.error(err);
      normalizarPreciosResultado.textContent = "Error de conexion al normalizar precios";
      confirmNormalizarPrecios.disabled = false;
      confirmNormalizarPrecios.textContent = "Reintentar";
    }
  });

  // ============================================
  // 9) Cargar datos al iniciar
  // ============================================
  cargarProductos();
});
