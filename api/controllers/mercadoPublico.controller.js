const mercadoPublico = require("../services/mercadoPublico.service");

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || "Error interno consultando Mercado Publico",
    source: status === 401 || status === 403 ? "auth_or_chilecompra" : "mercado_publico",
  });
}

exports.getLicitaciones = async (req, res) => {
  try {
    const data = await mercadoPublico.listarLicitaciones(req.query);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getLicitacionByCodigo = async (req, res) => {
  try {
    const data = await mercadoPublico.obtenerLicitacion(req.params.codigo);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getOrdenes = async (req, res) => {
  try {
    const data = await mercadoPublico.listarOrdenes(req.query);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getOrdenByCodigo = async (req, res) => {
  try {
    const data = await mercadoPublico.obtenerOrden(req.params.codigo);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getReportes = async (req, res) => {
  try {
    const data = await mercadoPublico.obtenerReportes(req.query);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getProveedor = async (req, res) => {
  try {
    const data = await mercadoPublico.buscarProveedor(req.query.rut);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getCompradores = async (req, res) => {
  try {
    const data = await mercadoPublico.buscarCompradores();
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getAjustes = async (req, res) => {
  try {
    res.json({
      sesionAdmin: true,
      usuario: {
        email: req.user?.email || null,
        role: req.user?.role || null,
      },
      mercadoPublico: await mercadoPublico.obtenerEstadoConfiguracion(),
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.saveTicket = async (req, res) => {
  try {
    const data = await mercadoPublico.guardarTicket(
      req.body.ticket,
      req.user?.email || req.user?.uid || null
    );

    res.json({
      message: "Ticket de Mercado Publico guardado correctamente.",
      mercadoPublico: data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.testConexion = async (req, res) => {
  try {
    const data = await mercadoPublico.buscarCompradores();
    const listado = Array.isArray(data?.Listado) ? data.Listado : [];

    res.json({
      ok: true,
      message: "Conexion con ChileCompra exitosa.",
      compradoresEncontrados: listado.length,
    });
  } catch (err) {
    sendError(res, err);
  }
};
