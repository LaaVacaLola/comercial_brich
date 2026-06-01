function adminMiddleware(req, res, next) {
  const user = req.user;
  const role = String(user?.role || user?.rol || user?.nombreRol || "")
    .trim()
    .toLowerCase();

  if (!user) {
    return res.status(401).json({
      code: "AUTH_REQUIRED",
      error: "Token requerido",
      message: "Token requerido",
      redirectTo: "/html/login.html",
    });
  }

  if (!["admin", "administrador"].includes(role)) {
    return res.status(403).json({
      code: "ADMIN_REQUIRED",
      error: "Acceso denegado. Solo administradores.",
      message: "Acceso denegado. Solo administradores.",
      redirectTo: "/html/login.html",
      role: role || null,
    });
  }

  next();
}

module.exports = adminMiddleware;
