const mercadoPublico = require("../services/mercadoPublico.service");

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: err.message || "Error interno consultando Mercado Publico",
    message: err.message || "Error interno consultando Mercado Publico",
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

exports.startReporteJob = async (req, res) => {
  try {
    const data = mercadoPublico.iniciarReporteJob(req.body || {});
    res.status(202).json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getReporteJob = async (req, res) => {
  try {
    const data = mercadoPublico.obtenerReporteJob(req.params.id);
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getDescargaOrdenesJobs = async (req, res) => {
  try {
    const data = await mercadoPublico.listarDescargaOrdenesJobs();
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.cancelJob = async (req, res) => {
  try {
    const data = await mercadoPublico.cancelarJob(req.params.id);
    res.json({
      ok: true,
      message: "Job cancelado.",
      job: data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.syncEntidadesGuardadas = async (req, res) => {
  try {
    const data = await mercadoPublico.sincronizarEntidadesGuardadas();
    res.status(202).json({
      ok: true,
      message: "Jobs de descarga iniciados para entidades guardadas.",
      ...data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getOrdenesCache = async (req, res) => {
  try {
    const data = await mercadoPublico.listarOrdenesCacheResumen();
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.getAnalisisGuardados = async (req, res) => {
  try {
    const data = await mercadoPublico.listarAnalisisGuardados();
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

exports.getProveedoresGuardados = async (req, res) => {
  try {
    const data = await mercadoPublico.listarProveedoresGuardados();
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.saveProveedorGuardado = async (req, res) => {
  try {
    const data = await mercadoPublico.guardarProveedorObservado(
      req.body,
      req.user?.email || req.user?.uid || null
    );

    res.json({
      ok: true,
      message: "Proveedor guardado para analitica.",
      proveedor: data,
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getClientesGuardados = async (req, res) => {
  try {
    const data = await mercadoPublico.listarClientesGuardados();
    res.json(data);
  } catch (err) {
    sendError(res, err);
  }
};

exports.saveClienteGuardado = async (req, res) => {
  try {
    const data = await mercadoPublico.guardarClienteObservado(
      req.body,
      req.user?.email || req.user?.uid || null
    );

    res.json({
      ok: true,
      message: "Cliente observado guardado para analitica.",
      cliente: data,
    });
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
      ok: true,
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
