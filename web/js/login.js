document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  let email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMessage = document.getElementById("error-message");

  email = email.replace(/\s+/g, "");   // <---- 🔥 ELIMINA espacios internos

  console.log("EMAIL ENVIADO:", JSON.stringify(email)); // <--- para verificar

  if (!email || !password) {
    errorMessage.textContent = "Todos los campos son obligatorios.";
    return;
  }

  try {
    const resp = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await resp.json();

    if (!resp.ok) {
      errorMessage.textContent = data.message || "Error en login";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userName", data.user.nombre);
    localStorage.setItem("userRole", data.user.role);

    if (data.user.role === "admin") {
      window.location.href = "../html/dashboard_admin.html";
    } else {
      window.location.href = "../html/dashboard_cliente.html";
    }

  } catch (err) {
    errorMessage.textContent = "Error de conexión con el servidor";
  }
});
