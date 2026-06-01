document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("resultTable");
  const filterIds = ["fecha", "estado", "codigo", "codigoOrganismo", "codigoProveedor"];

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

  async function loadOrdenes() {
    try {
      MP.setMessage("Consultando ordenes en ChileCompra...");
      tbody.innerHTML = "";

      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/ordenes${query ? `?${query}` : ""}`);
      const items = MP.getListado(data);

      if (!items.length) {
        MP.renderEmpty(tbody, 7, "No se encontraron ordenes para los filtros indicados.");
        MP.setMessage("Sin resultados.");
        return;
      }

      items.forEach((item) => {
        const row = document.createElement("tr");
        const codigo = MP.pick(item, ["Codigo", "CodigoOC", "codigo"]);
        const total = MP.pick(item, ["Total", "MontoTotal", "total", "montoTotal"], "0");

        MP.appendCell(row, codigo);
        MP.appendCell(row, MP.pick(item, ["NombreProveedor", "Proveedor", "nombreProveedor"]));
        MP.appendCell(row, MP.pick(item, ["NombreOrganismo", "Organismo", "NombreComprador", "UnidadCompra"]));
        MP.appendCell(row, MP.pick(item, ["FechaEnvio", "FechaCreacion", "Fecha", "fecha"]));
        MP.appendCell(row, MP.formatMoney(total));
        MP.appendStatus(row, MP.pick(item, ["Estado", "EstadoOrdenCompra", "estado"]));
        MP.appendAction(row, "Ver", async () => {
          try {
            MP.setMessage("Cargando detalle de orden...");
            const detail = await MP.request(`/ordenes/${encodeURIComponent(codigo)}`);
            MP.showDetail([
              { label: "Codigo", keys: ["Codigo", "CodigoOC"] },
              { label: "Proveedor", keys: ["NombreProveedor", "Proveedor"] },
              { label: "Organismo", keys: ["NombreOrganismo", "Organismo", "UnidadCompra"] },
              { label: "Estado", keys: ["Estado", "EstadoOrdenCompra"] },
              { label: "Fecha", keys: ["FechaEnvio", "FechaCreacion", "Fecha"] },
              { label: "Total", keys: ["Total", "MontoTotal"] },
            ], detail);
            MP.setMessage(`Detalle cargado: ${codigo}`);
          } catch (err) {
            MP.setMessage(err.message, true);
          }
        });

        tbody.appendChild(row);
      });

      MP.setMessage(`${items.length} ordenes encontradas.`);
    } catch (err) {
      MP.renderEmpty(tbody, 7, "No fue posible cargar ordenes.");
      MP.setMessage(err.message, true);
    }
  }

  async function buscarProveedor() {
    const rut = document.getElementById("rutProveedor").value.trim();
    const result = document.getElementById("proveedorResult");
    if (!rut) {
      result.textContent = "Ingresa un RUT con puntos y guion.";
      return;
    }

    try {
      result.textContent = "Buscando proveedor...";
      const data = await MP.request(`/proveedor?rut=${encodeURIComponent(rut)}`);
      const item = MP.getListado(data)[0] || data;
      const codigo = MP.pick(item, ["CodigoEmpresa", "CodigoProveedor", "Codigo", "codigo"], "");
      const nombre = MP.pick(item, ["NombreEmpresa", "NombreProveedor", "Nombre", "nombre"], "Proveedor encontrado");
      result.textContent = codigo ? `${nombre} | Codigo: ${codigo}` : `${nombre}. Revisa el detalle en consola.`;
      if (codigo) document.getElementById("codigoProveedor").value = codigo;
    } catch (err) {
      result.textContent = err.message;
    }
  }

  document.getElementById("buscarBtn").addEventListener("click", loadOrdenes);
  document.getElementById("buscarProveedorBtn").addEventListener("click", buscarProveedor);
  document.getElementById("limpiarBtn").addEventListener("click", () => {
    MP.resetFilters(filterIds);
    MP.renderEmpty(tbody, 7, "Selecciona filtros y presiona Buscar.");
    MP.setMessage("Filtros limpiados.");
  });
});
