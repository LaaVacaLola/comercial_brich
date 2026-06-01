const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // El token suele venir en los headers: "Authorization: Bearer <token>"
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token requerido" });

  try {
    // Verificar token con la misma clave del .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Guarda info del usuario para usar después
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token inválido" });
  }
}

module.exports = authMiddleware;
