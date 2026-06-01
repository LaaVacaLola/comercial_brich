window.MercadoPublico = (() => {
  const API_BASE = "/api/mercado-publico";
  const API_FALLBACK_BASE = "/api/admin/mercado-publico";

  function redirectToLogin() {
    localStorage.clear();
    window.location.href = "/html/login.html";
  }

  function getTokenOrRedirect() {
    const token = localStorage.getItem("token");
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (!token || !["admin", "administrador"].includes(role)) {
      alert("Acceso denegado. Solo administradores pueden ingresar.");
      redirectToLogin();
      return null;
    }

    return token;
  }

  function setMessage(text, isError = false) {
    console.log(text);
    const element = document.getElementById("statusMessage");
    if (!element) return;
    element.textContent = text;
    element.classList.toggle("error", isError);
  }

  function backendMessage(method, path) {
    const action = method === "GET" ? "Consulta" : "Operacion";
    return `${action} backend OK: ${path}`;
  }

  function buildQuery(ids) {
    const params = new URLSearchParams();

    ids.forEach((id) => {
      const element = document.getElementById(id);
      const value = element?.value?.trim();
      if (!value) return;

      if (id === "codigoOrganismo") {
        params.set("codigoOrganismo", value);
      } else if (id === "codigoProveedor") {
        params.set("codigoProveedor", value);
      } else {
        params.set(id, value);
      }
    });

    return params.toString();
  }

  async function request(path, options = {}) {
    const token = getTokenOrRedirect();
    if (!token) return null;

    const requestOptions = {
      method: options.method || "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    let res = await fetch(`${API_BASE}${path}`, requestOptions);

    if (res.status === 404 && path.startsWith("/ajustes")) {
      setMessage(`Ruta principal no encontrada. Probando ruta admin para ${path}...`, true);
      res = await fetch(`${API_FALLBACK_BASE}${path}`, requestOptions);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || data.message || `Error HTTP ${res.status}`;

      if (res.status === 401 || ["AUTH_REQUIRED", "TOKEN_INVALID"].includes(data.code)) {
        setMessage(`${message}. Redirigiendo al login...`, true);
        redirectToLogin();
        return null;
      }

      setMessage(message, true);

      if (res.status === 403) {
        throw new Error(message || "Acceso rechazado. Revisa tu sesion admin o el ticket de ChileCompra.");
      }
      throw new Error(message);
    }

    setMessage(data.message || backendMessage(options.method || "GET", path));
    return data;
  }

  function getListado(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.Listado)) return data.Listado;
    if (Array.isArray(data?.listado)) return data.listado;
    return [];
  }

  function pick(item, keys, fallback = "-") {
    for (const key of keys) {
      const value = item?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return fallback;
  }

  function formatMoney(value) {
    const number = Number(String(value ?? "0").replace(/[^\d.-]/g, ""));
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(number) ? number : 0);
  }

  function appendCell(row, text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text;
    row.appendChild(cell);
    return cell;
  }

  function appendStatus(row, text) {
    const cell = document.createElement("td");
    const span = document.createElement("span");
    span.className = "status-pill";
    span.textContent = text;
    cell.appendChild(span);
    row.appendChild(cell);
  }

  function appendAction(row, label, onClick) {
    const cell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "btn-secondary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    cell.appendChild(button);
    row.appendChild(cell);
  }

  function renderEmpty(tbody, colspan, message) {
    tbody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = colspan;
    cell.textContent = message;
    cell.style.textAlign = "center";
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function setupModal() {
    const modal = document.getElementById("detailModal");
    const closeBtn = modal?.querySelector(".close-btn");
    if (!modal) return;

    closeBtn?.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) modal.style.display = "none";
    });
  }

  function showDetail(titleFields, data) {
    const modal = document.getElementById("detailModal");
    const content = document.getElementById("detailContent");
    if (!modal || !content) return;

    content.innerHTML = "";

    const item = getListado(data)[0] || data;
    const grid = document.createElement("div");
    grid.className = "detail-grid";

    titleFields.forEach((field) => {
      const card = document.createElement("div");
      card.className = "detail-item";
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = field.label;
      value.textContent = pick(item, field.keys);
      card.appendChild(label);
      card.appendChild(value);
      grid.appendChild(card);
    });

    const pre = document.createElement("pre");
    pre.className = "detail-json";
    pre.textContent = JSON.stringify(item, null, 2);

    content.appendChild(grid);
    content.appendChild(pre);
    modal.style.display = "flex";
  }

  function resetFilters(ids) {
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });
  }

  return {
    appendAction,
    appendCell,
    appendStatus,
    buildQuery,
    formatMoney,
    getListado,
    getTokenOrRedirect,
    pick,
    renderEmpty,
    request,
    resetFilters,
    setMessage,
    setupModal,
    showDetail,
  };
})();
