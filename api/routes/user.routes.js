// api/routes/user.routes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Rol = require("../models/Rol");

// ===============================
// Obtener todos
// ===============================
router.get("/", async (_req, res) => {
  try {
    const usuarios = await User.find().populate("rol_id").sort({ createdAt: -1 });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios", details: err.message });
  }
});

// ===============================
// Obtener uno
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).populate("rol_id");
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuario", details: err.message });
  }
});

// ===============================
// Crear usuario (versión con rol_id)
// ===============================
router.post("/", async (req, res) => {
  try {
    let { nombre, apellido, email, password, rolNombre } = req.body;
    console.log("–––––––––––");
    console.log("BODY COMPLETO:", req.body);
    console.log("ROL RECIBIDO:", rolNombre);
    console.log("TIPO DE ROL:", typeof rolNombre);
    console.log("–––––––––––");
    if (!nombre || !apellido || !email || !password || !rolNombre) {
      return res.status(400).json({
        error: "Faltan campos requeridos (nombre, apellido, email, password, rolNombre)"
      });
    }

    // Buscar el rol (admin / cliente)
    console.log("ROL RECIBIDO:", rolNombre);
    const rol = await Rol.findOne({ nombreRol: rolNombre });
    console.log("ROL ENCONTRADO:", rol);
    if (!rol) {
      return res.status(400).json({ error: "El rol proporcionado no existe." });
    }

    // Validación de email duplicado
    const existe = await User.findOne({ email: email.toLowerCase() });
    if (existe) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    // Encriptar password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const nuevo = new User({
      nombre,
      apellido,
      email: email.toLowerCase(),
      password: hashedPassword,
      rol_id: rol._id, // ← Aquí va el ID del rol
    });

    await nuevo.save();

    res.status(201).json({
      _id: nuevo._id,
      nombre: nuevo.nombre,
      apellido: nuevo.apellido,
      email: nuevo.email,
      rol: rol.nombreRol,
      createdAt: nuevo.createdAt
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al crear usuario", details: err.message });
  }
});

// ===============================
// Actualizar usuario
// ===============================
router.put("/:id", async (req, res) => {
  try {
    let { nombre, apellido, email, password, rolNombre } = req.body;

    const updateFields = {};

    if (nombre) updateFields.nombre = nombre;
    if (apellido) updateFields.apellido = apellido;
    if (email) updateFields.email = email.toLowerCase();

    // Si se envió un rol nuevo
    if (rolNombre) {
      const rol = await Rol.findOne({ nombreRol: rolNombre });
      if (!rol) {
        return res.status(400).json({ error: "El rol proporcionado no existe" });
      }
      updateFields.rol_id = rol._id;
    }

    // Si se envió un password nuevo
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate("rol_id");

    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: "Error al actualizar usuario", details: err.message });
  }
});

// ===============================
// Eliminar
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario", details: err.message });
  }
});

module.exports = router;
