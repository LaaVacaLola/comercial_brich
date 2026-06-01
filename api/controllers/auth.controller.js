const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Rol = require("../models/Rol");

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario + populate bien hecho
    const user = await User.findOne({ email }).populate("rol_id");
    console.log("📌 Usuario encontrado:", user);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    // Validar contraseña
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // Si falló populate, evitar crash
    const rolNombre = user.rol_id?.nombreRol || "cliente";

    // Crear token
    const token = signToken({
      uid: user._id,
      email: user.email,
      role: rolNombre,
      nombre: user.nombre,
    });

    res.json({
      message: "Login correcto",
      token,
      role: rolNombre,
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: rolNombre,
        rol_id: user.rol_id ? user.rol_id._id : null   // <-- ESTA LÍNEA ES LA CLAVE
      },
    });

  } catch (err) {
    console.error("Error en login:", err.message);
    res.status(500).json({
      message: "Error en el login",
      error: err.message,
    });
  }
};
