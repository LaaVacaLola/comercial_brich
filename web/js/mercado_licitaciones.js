document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("resultTable");
  const filterIds = ["fecha", "estado", "codigo", "codigoOrganismo", "codigoProveedor"];

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

  async function loadLicitaciones() {
    try {
      MP.setMessage("Consultando licitaciones en ChileCompra...");
      tbody.innerHTML = "";

      const query = MP.buildQuery(filterIds);
      const data = await MP.request(`/licitaciones${query ? `?${query}` : ""}`);
      const items = MP.getListado(data);

      if (!items.length) {
        MP.renderEmpty(tbody, 6, "No se encontraron licitaciones para los filtros indicados.");
        MP.setMessage("Sin resultados.");
        return;
      }

      items.forEach((item) => {
        const row = document.createElement("tr");
        const codigo = MP.pick(item, ["CodigoExterno", "Codigo", "codigo"]);

        MP.appendCell(row, codigo);
        MP.appendCell(row, MP.pick(item, ["Nombre", "NombreLicitacion", "Descripcion"]));
        MP.appendCell(row, MP.pick(item, ["NombreOrganismo", "Organismo", "UnidadCompra"]));
        MP.appendCell(row, MP.pick(item, ["FechaCierre", "FechaFinal", "Fecha"]));
        MP.appendStatus(row, MP.pick(item, ["Estado", "EstadoLicitacion"]));
        MP.appendAction(row, "Ver", async () => {
          try {
            MP.setMessage("Cargando detalle de licitacion...");
            const detail = await MP.request(`/licitaciones/${encodeURIComponent(codigo)}`);
            MP.showDetail([
              { label: "Codigo", keys: ["CodigoExterno", "Codigo"] },
              { label: "Nombre", keys: ["Nombre", "NombreLicitacion"] },
              { label: "Organismo", keys: ["NombreOrganismo", "Organismo", "UnidadCompra"] },
              { label: "Estado", keys: ["Estado", "EstadoLicitacion"] },
              { label: "Fecha cierre", keys: ["FechaCierre", "FechaFinal", "Fecha"] },
              { label: "Monto estimado", keys: ["MontoEstimado", "MontoDisponible"] },
            ], detail);
            MP.setMessage(`Detalle cargado: ${codigo}`);
          } catch (err) {
            MP.setMessage(err.message, true);
          }
        });

        tbody.appendChild(row);
      });

      MP.setMessage(`${items.length} licitaciones encontradas.`);
    } catch (err) {
      MP.renderEmpty(tbody, 6, "No fue posible cargar licitaciones.");
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("buscarBtn").addEventListener("click", loadLicitaciones);
  document.getElementById("limpiarBtn").addEventListener("click", () => {
    MP.resetFilters(filterIds);
    MP.renderEmpty(tbody, 6, "Selecciona filtros y presiona Buscar.");
    MP.setMessage("Filtros limpiados.");
  });

  loadLicitaciones();
});
