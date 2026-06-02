document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("jobsTable");
  const cacheTbody = document.getElementById("cacheTable");

  if (!MP.getTokenOrRedirect()) return;

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function progressCell(progress = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "job-progress-cell";
    const percent = Number(progress.porcentaje || 0);
    wrapper.innerHTML = `
      <strong>${percent}%</strong>
      <div class="progress-track mini">
        <div class="progress-bar" style="width:${Math.min(100, percent)}%"></div>
      </div>
    `;
    return wrapper;
  }

  function shortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  async function cargarJobs() {
    try {
      MP.setMessage("Consultando jobs de descarga...");
      const data = await MP.request("/oc-jobs", { silent: true });
      const jobs = MP.getListado(data);
      tbody.innerHTML = "";

      if (!jobs.length) {
        MP.renderEmpty(tbody, 11, "No hay jobs de descarga registrados.");
        MP.setMessage("No hay jobs registrados.");
        return;
      }

      jobs.forEach((job) => {
        const row = document.createElement("tr");
        const progress = job.progress || {};
        const logs = job.logs || [];
        const lastLog = logs[logs.length - 1];
        MP.appendCell(row, `${job.tipo || "-"} / ${job.entidadTipo || "-"}: ${job.entidadNombre || "-"}`);
        MP.appendCell(row, job.entidadCodigo || "-");
        MP.appendStatus(row, job.status || "-");

        const progressTd = document.createElement("td");
        progressTd.appendChild(progressCell(progress));
        row.appendChild(progressTd);

        MP.appendCell(row, String(progress.ocEncontradas || 0));
        MP.appendCell(row, String(progress.ocProcesadas || 0));
        MP.appendCell(row, String(progress.ocOmitidas || 0));
        MP.appendCell(row, String(progress.consultasOmitidas || 0));
        MP.appendCell(row, formatDate(job.updatedAt));
        MP.appendCell(row, lastLog ? `${formatDate(lastLog.at)} | ${lastLog.message}` : "-");

        const actionCell = document.createElement("td");
        if (["queued", "running"].includes(job.status)) {
          const stopBtn = document.createElement("button");
          stopBtn.className = "btn-secondary";
          stopBtn.type = "button";
          stopBtn.textContent = "Parar";
          stopBtn.addEventListener("click", () => cancelarJob(job.id));
          actionCell.appendChild(stopBtn);
        } else {
          actionCell.textContent = "-";
        }
        row.appendChild(actionCell);
        tbody.appendChild(row);

        if (logs.length) {
          const logsRow = document.createElement("tr");
          const logsCell = document.createElement("td");
          logsCell.colSpan = 11;
          logsCell.className = "job-logs-cell";
          logsCell.innerHTML = logs
            .slice()
            .reverse()
            .map((log) => `<div><strong>${formatDate(log.at)}</strong> ${log.message}</div>`)
            .join("");
          logsRow.appendChild(logsCell);
          tbody.appendChild(logsRow);
        }
      });

      MP.setMessage(`${jobs.length} jobs cargados.`);
    } catch (err) {
      MP.setMessage(err.message, true);
      MP.renderEmpty(tbody, 11, "No fue posible cargar jobs.");
    }
  }

  async function cancelarJob(id) {
    try {
      MP.setMessage("Cancelando job...");
      await MP.request(`/oc-jobs/${encodeURIComponent(id)}/cancel`, { method: "PUT" });
      await cargarJobs();
    } catch (err) {
      MP.setMessage(`No se pudo cancelar job: ${err.message}`, true);
    }
  }

  async function cargarCache() {
    try {
      const data = await MP.request("/oc-cache", { silent: true });
      document.getElementById("cacheTotal").textContent = data.total || 0;
      document.getElementById("cacheUltimaFecha").textContent = shortDate(data.ultimaFecha);
      document.getElementById("cachePrimeraFecha").textContent = shortDate(data.primeraFecha);

      const ordenes = MP.getListado(data);
      cacheTbody.innerHTML = "";

      if (!ordenes.length) {
        MP.renderEmpty(cacheTbody, 7, "No hay OC cacheadas.");
        return;
      }

      ordenes.forEach((orden) => {
        const row = document.createElement("tr");
        MP.appendCell(row, orden.codigo || "-");
        MP.appendCell(row, orden.proveedorNombre || "-");
        MP.appendCell(row, orden.compradorNombre || "-");
        MP.appendCell(row, shortDate(orden.fecha));
        MP.appendCell(row, MP.formatMoney(orden.total || 0));
        MP.appendStatus(row, orden.estado || "-");
        MP.appendCell(row, (orden.origenes || []).map((item) => `${item.tipo}:${item.codigo}`).join(", ") || "-");
        cacheTbody.appendChild(row);
      });
    } catch (err) {
      MP.renderEmpty(cacheTbody, 7, "No fue posible cargar cache.");
    }
  }

  async function sincronizarGuardados() {
    try {
      MP.setMessage("Iniciando jobs para proveedores y clientes guardados...");
      const data = await MP.request("/oc-jobs/sync", { method: "POST" });
      MP.setMessage(`${data.Cantidad || 0} jobs activos/iniciados para entidades guardadas.`);
      await cargarJobs();
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  document.getElementById("refreshJobsBtn").addEventListener("click", cargarJobs);
  document.getElementById("refreshCacheBtn").addEventListener("click", cargarCache);
  document.getElementById("syncJobsBtn").addEventListener("click", sincronizarGuardados);
  cargarJobs();
  cargarCache();
  setInterval(() => {
    cargarJobs();
    cargarCache();
  }, 10000);
});
