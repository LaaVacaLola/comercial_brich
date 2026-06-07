document.addEventListener("DOMContentLoaded", () => {
  const MP = window.MercadoPublico;
  const tbody = document.getElementById("jobsTable");
  const cacheTbody = document.getElementById("cacheTable");
  let currentJobs = [];
  let currentJobId = null;

  if (!MP.getTokenOrRedirect()) return;
  MP.setupModal();

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

  function metric(label, value) {
    return `
      <div class="tender-metric">
        <span>${label}</span>
        <strong>${value ?? "-"}</strong>
      </div>
    `;
  }

  function infoRow(label, value) {
    return `
      <div class="tender-info-row">
        <span>${label}</span>
        <strong>${value ?? "-"}</strong>
      </div>
    `;
  }

  function renderJobDetail(job) {
    const content = document.getElementById("detailContent");
    const progress = job.progress || {};
    const logs = job.logs || [];

    content.innerHTML = `
      <article class="tender-sheet">
        <header class="tender-header">
          <div>
            <span class="tender-code">${job.id}</span>
            <h2>${job.tipo || "-"} / ${job.entidadTipo || "-"}: ${job.entidadNombre || "-"}</h2>
          </div>
          <span class="tender-state">${job.status || "-"}</span>
        </header>

        <section class="tender-summary">
          ${metric("Avance", `${progress.porcentaje || 0}%`)}
          ${metric("OC encontradas", progress.ocEncontradas || 0)}
          ${metric("OC procesadas", progress.ocProcesadas || 0)}
          ${metric("OC omitidas", progress.ocOmitidas || 0)}
          ${metric("Consultas procesadas", progress.consultasProcesadas || 0)}
          ${metric("Consultas omitidas", progress.consultasOmitidas || 0)}
        </section>

        <section class="tender-panel">
          <h3>Informacion</h3>
          <div class="tender-info-grid">
            ${infoRow("Codigo entidad", job.entidadCodigo)}
            ${infoRow("Creado", formatDate(job.createdAt))}
            ${infoRow("Actualizado", formatDate(job.updatedAt))}
            ${infoRow("Error", job.error || "-")}
          </div>
        </section>

        <section class="tender-panel">
          <h3>Logs del job</h3>
          <div class="job-log-list">
            ${logs.length
              ? logs.slice().reverse().map((log) => `<div><strong>${formatDate(log.at)}</strong><span>${log.message}</span></div>`).join("")
              : "<p>Sin logs registrados.</p>"}
          </div>
        </section>

        <details class="tender-json">
          <summary>Ver JSON del job</summary>
          <pre class="detail-json">${JSON.stringify(job, null, 2)}</pre>
        </details>
      </article>
    `;
  }

  function showJobDetail(job) {
    const modal = document.getElementById("detailModal");
    currentJobId = job.id;
    renderJobDetail(job);

    modal.style.display = "flex";
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

  function isDetailModalOpen() {
    return document.getElementById("detailModal")?.style.display === "flex";
  }

  function refreshCurrentJobModal() {
    if (!currentJobId || !isDetailModalOpen()) return;
    const job = currentJobs.find((item) => item.id === currentJobId);
    if (job) renderJobDetail(job);
  }

  async function cargarJobs(options = {}) {
    const silent = Boolean(options.silent);
    try {
      if (!silent) MP.setMessage("Consultando jobs de descarga...");
      const data = await MP.request("/oc-jobs", { silent: true });
      const jobs = MP.getListado(data);
      currentJobs = jobs;
      tbody.innerHTML = "";

      if (!jobs.length) {
        MP.renderEmpty(tbody, 6, "No hay jobs de descarga registrados.");
        if (!silent) MP.setMessage("No hay jobs registrados.");
        return;
      }

      jobs.forEach((job) => {
        const row = document.createElement("tr");
        const progress = job.progress || {};
        MP.appendCell(row, `${job.tipo || "-"} / ${job.entidadTipo || "-"}: ${job.entidadNombre || "-"}`);
        MP.appendStatus(row, job.status || "-");

        const progressTd = document.createElement("td");
        progressTd.appendChild(progressCell(progress));
        row.appendChild(progressTd);

        MP.appendCell(row, String(progress.ocProcesadas || 0));
        MP.appendCell(row, formatDate(job.updatedAt));

        const actionCell = document.createElement("td");
        const detailBtn = document.createElement("button");
        detailBtn.className = "btn-primary";
        detailBtn.type = "button";
        detailBtn.textContent = "Ver";
        detailBtn.addEventListener("click", () => showJobDetail(job));
        actionCell.appendChild(detailBtn);

        if (["queued", "running"].includes(job.status)) {
          const stopBtn = document.createElement("button");
          stopBtn.className = "btn-secondary";
          stopBtn.type = "button";
          stopBtn.textContent = "Parar";
          stopBtn.addEventListener("click", () => cancelarJob(job.id));
          actionCell.appendChild(stopBtn);
        }
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      refreshCurrentJobModal();
      if (!silent) MP.setMessage(`${jobs.length} jobs cargados.`);
    } catch (err) {
      if (!silent) MP.setMessage(err.message, true);
      MP.renderEmpty(tbody, 6, "No fue posible cargar jobs.");
    }
  }

  async function cancelarJob(id) {
    try {
      MP.setMessage("Cancelando job...");
      await MP.request(`/oc-jobs/${encodeURIComponent(id)}/cancel`, { method: "PUT" });
      await cargarJobs({ silent: true });
      await cargarCache();
      MP.setMessage("Job cancelado.");
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
      document.getElementById("cacheUltimaDescarga").textContent = formatDate(data.ultimaDescarga);
      document.getElementById("cacheUltimaDescargaCodigo").textContent = data.ultimaDescargaCodigo
        ? `Ultima OC actualizada: ${data.ultimaDescargaCodigo}`
        : "Ultimo documento insertado o actualizado.";

      const ordenes = MP.getListado(data);
      cacheTbody.innerHTML = "";

      if (!ordenes.length) {
        MP.renderEmpty(cacheTbody, 8, "No hay OC cacheadas.");
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
        MP.appendCell(row, formatDate(orden.downloadedAt || orden.updatedAt));
        cacheTbody.appendChild(row);
      });
    } catch (err) {
      MP.renderEmpty(cacheTbody, 8, "No fue posible cargar cache.");
    }
  }

  async function sincronizarGuardados() {
    try {
      MP.setMessage("Iniciando jobs para proveedores y clientes guardados...");
      const data = await MP.request("/oc-jobs/sync", { method: "POST" });
      MP.setMessage(`${data.Cantidad || 0} jobs activos/iniciados para entidades guardadas.`);
      await cargarJobs({ silent: true });
      await cargarCache();
    } catch (err) {
      MP.setMessage(err.message, true);
    }
  }

  document.querySelector("#detailModal .close-btn")?.addEventListener("click", () => {
    currentJobId = null;
  });
  document.getElementById("refreshJobsBtn").addEventListener("click", () => cargarJobs());
  document.getElementById("refreshCacheBtn").addEventListener("click", cargarCache);
  document.getElementById("syncJobsBtn").addEventListener("click", sincronizarGuardados);
  cargarJobs();
  cargarCache();
  setInterval(() => {
    cargarJobs({ silent: true });
    cargarCache();
  }, 3000);
});
