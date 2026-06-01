(function () {
  function redirectToLogin() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  function ensureAdminSession() {
    const token = localStorage.getItem("token");
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (!token || !["admin", "administrador"].includes(role)) {
      redirectToLogin();
      return false;
    }

    return true;
  }

  function initAdminNav() {
    if (!ensureAdminSession()) return;

    const navbar = document.querySelector(".navbar");
    if (!navbar || navbar.querySelector(".admin-nav")) return;

    const groups = [
      {
        label: "Catalogo",
        links: [
          { href: "dashboard_admin.html", label: "Dashboard" },
          { href: "catalogo_admin.html", label: "Catalogo" },
          { href: "ordenes_admin.html", label: "Ordenes" },
          { href: "reportes_admin.html", label: "Reportes" },
        ],
      },
      {
        label: "Mercado Publico",
        links: [
          { href: "mercado_licitaciones.html", label: "Licitaciones" },
          { href: "mercado_ordenes.html", label: "Ordenes" },
          { href: "mercado_reportes.html", label: "Analitica" },
        ],
      },
      {
        label: "Ajustes",
        links: [
          { href: "gestion_usuario.html", label: "Usuarios" },
          { href: "ajustes_mercado.html", label: "Mercado API" },
        ],
      },
    ];

    const current = window.location.pathname.split("/").pop();
    const nav = document.createElement("nav");
    nav.className = "admin-nav";
    nav.setAttribute("aria-label", "Menu administracion");

    groups.forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "admin-nav-group";

      const button = document.createElement("button");
      button.className = "admin-nav-toggle";
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.textContent = group.label;
      wrapper.appendChild(button);

      const links = document.createElement("div");
      links.className = "admin-nav-links";

      group.links.forEach((item) => {
        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.label;
        if (current === item.href) link.classList.add("active");
        links.appendChild(link);
      });

      wrapper.appendChild(links);
      nav.appendChild(wrapper);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = wrapper.classList.toggle("open");
        button.setAttribute("aria-expanded", String(isOpen));

        nav.querySelectorAll(".admin-nav-group.open").forEach((openGroup) => {
          if (openGroup === wrapper) return;
          openGroup.classList.remove("open");
          openGroup.querySelector(".admin-nav-toggle")?.setAttribute("aria-expanded", "false");
        });
      });
    });

    document.addEventListener("click", () => {
      nav.querySelectorAll(".admin-nav-group.open").forEach((group) => {
        group.classList.remove("open");
        group.querySelector(".admin-nav-toggle")?.setAttribute("aria-expanded", "false");
      });
    });

    const action = navbar.querySelector(".btn-logout, .btn-back");
    if (action) {
      navbar.insertBefore(nav, action);
    } else {
      navbar.appendChild(nav);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminNav);
  } else {
    initAdminNav();
  }
})();
