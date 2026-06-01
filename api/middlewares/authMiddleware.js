const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      code: "AUTH_REQUIRED",
      error: "Token requerido",
      message: "Token requerido",
      redirectTo: "/html/login.html",
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({
      code: "TOKEN_INVALID",
      error: "Token invalido",
      message: "Token invalido",
      redirectTo: "/html/login.html",
    });
  }
}

module.exports = authMiddleware;
