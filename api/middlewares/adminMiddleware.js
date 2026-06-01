const jwt = require("jsonwebtoken");

function adminMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token requerido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Aquí decoded.role es "admin" o "cliente"
    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Acceso denegado. Solo administradores.",
      });
    }

    req.user = decoded;
    next();

  } catch (err) {
    return res.status(403).json({ message: "Token inválido" });
  }
}

module.exports = adminMiddleware;
