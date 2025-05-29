const { validationResult } = require('express-validator');
const Sesion = require('../models/Sesion');
const Ley = require('../models/Ley');
const blockchainService = require('../services/blockchainService');
const { catchAsync } = require('../middleware/errorHandler');

const getAllSesiones = catchAsync(async (req, res, next) => {
  const features = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    sort: req.query.sort || '-fechaCreacion',
    fields: req.query.fields
  };

  // Filtros
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Filtros avanzados
  if (req.query.estado) queryObj.estado = req.query.estado;
  if (req.query.isOnBlockchain !== undefined) {
    queryObj.isOnBlockchain = req.query.isOnBlockchain === 'true';
  }

  // Construir query
  let query = Sesion.find(queryObj);

  // Sorting
  if (features.sort) {
    const sortBy = features.sort.split(',').join(' ');
    query = query.sort(sortBy);
  }

  // Field limiting
  if (features.fields) {
    const fields = features.fields.split(',').join(' ');
    query = query.select(fields);
  }

  // Pagination
  const skip = (features.page - 1) * features.limit;
  query = query.skip(skip).limit(features.limit);

  // Ejecutar query
  const sesiones = await query;
  const total = await Sesion.countDocuments(queryObj);

  res.status(200).json({
    status: 'success',
    results: sesiones.length,
    total,
    page: features.page,
    totalPages: Math.ceil(total / features.limit),
    data: {
      sesiones
    }
  });
});

const getSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      sesion
    }
  });
});

const crearSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  // Crear sesión en la base de datos
  const nuevaSesion = await Sesion.create({
    titulo: req.body.titulo,
    descripcion: req.body.descripcion,
    fecha: req.body.fecha,
    creadoPor: req.user._id,
    tipoVotacion: req.body.tipoVotacion || 'simple',
    quorumRequerido: req.body.quorumRequerido || 50
  });

  res.status(201).json({
    status: 'success',
    message: 'Sesión creada exitosamente',
    data: {
      sesion: nuevaSesion
    }
  });
});

const updateSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const allowedFields = ['titulo', 'descripcion', 'fecha', 'tipoVotacion', 'quorumRequerido'];
  const updateData = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updateData[key] = req.body[key];
    }
  });

  const sesion = await Sesion.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      sesion
    }
  });
});

const deleteSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  // No permitir eliminar sesiones activas o finalizadas
  if (sesion.estado === 'active' || sesion.estado === 'finished') {
    return res.status(400).json({
      status: 'error',
      message: 'No se puede eliminar una sesión activa o finalizada'
    });
  }

  // Eliminar todas las leyes asociadas
  await Ley.deleteMany({ sesion: req.params.id });

  // Eliminar la sesión
  await Sesion.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

const getLeyesDeSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  const leyes = await Ley.find({ sesion: req.params.id });

  res.status(200).json({
    status: 'success',
    results: leyes.length,
    data: {
      sesion: {
        id: sesion._id,
        titulo: sesion.titulo,
        estado: sesion.estado
      },
      leyes
    }
  });
});

const agregarLey = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  // Solo se pueden agregar leyes a sesiones en estado draft o active
  if (sesion.estado === 'finished' || sesion.estado === 'cancelled') {
    return res.status(400).json({
      status: 'error',
      message: 'No se pueden agregar leyes a una sesión finalizada o cancelada'
    });
  }

  // Crear la ley en la base de datos
  const nuevaLey = await Ley.create({
    titulo: req.body.titulo,
    descripcion: req.body.descripcion,
    categoria: req.body.categoria || 'otra',
    sesion: req.params.id,
    creadoPor: req.user._id
  });

  // Agregar la ley a la sesión
  sesion.leyes.push(nuevaLey._id);
  await sesion.save();

  res.status(201).json({
    status: 'success',
    message: 'Ley agregada exitosamente a la sesión',
    data: {
      ley: nuevaLey
    }
  });
});

const updateLey = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const ley = await Ley.findOne({ 
    _id: req.params.leyId, 
    sesion: req.params.id 
  });

  if (!ley) {
    return res.status(404).json({
      status: 'error',
      message: 'Ley no encontrada en esta sesión'
    });
  }

  const allowedFields = ['titulo', 'descripcion', 'categoria'];
  const updateData = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updateData[key] = req.body[key];
    }
  });

  const leyActualizada = await Ley.findByIdAndUpdate(
    req.params.leyId,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      ley: leyActualizada
    }
  });
});

const eliminarLey = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const ley = await Ley.findOne({ 
    _id: req.params.leyId, 
    sesion: req.params.id 
  });

  if (!ley) {
    return res.status(404).json({
      status: 'error',
      message: 'Ley no encontrada en esta sesión'
    });
  }

  // No permitir eliminar leyes que ya tienen votos
  if (ley.votos.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: 'No se puede eliminar una ley que ya tiene votos registrados'
    });
  }

  // Eliminar la ley de la sesión
  await Sesion.findByIdAndUpdate(
    req.params.id,
    { $pull: { leyes: req.params.leyId } }
  );

  // Eliminar la ley
  await Ley.findByIdAndDelete(req.params.leyId);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

const activarSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  if (sesion.estado !== 'draft') {
    return res.status(400).json({
      status: 'error',
      message: 'Solo se pueden activar sesiones en estado borrador'
    });
  }

  // Verificar que la sesión tenga al menos una ley
  if (sesion.leyes.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'La sesión debe tener al menos una ley para ser activada'
    });
  }

  try {
    // Registrar sesión en blockchain
    const blockchainResult = await blockchainService.crearSesion(
      sesion.fecha, 
      sesion.descripcion
    );

    // Actualizar sesión con datos de blockchain
    sesion.estado = 'active';
    sesion.blockchainId = blockchainResult.sesionId;
    sesion.isOnBlockchain = true;
    sesion.transactionHash = blockchainResult.transactionHash;
    sesion.fechaInicio = new Date();

    await sesion.save();

    // Registrar todas las leyes en blockchain
    const leyesConBlockchain = [];
    for (const leyId of sesion.leyes) {
      const ley = await Ley.findById(leyId);
      if (ley) {
        try {
          const leyBlockchainResult = await blockchainService.agregarLey(
            blockchainResult.sesionId,
            ley.titulo,
            ley.descripcion
          );

          ley.blockchainId = leyBlockchainResult.leyId;
          ley.isOnBlockchain = true;
          ley.transactionHash = leyBlockchainResult.transactionHash;
          ley.estado = 'voting';
          await ley.save();

          leyesConBlockchain.push(ley);
        } catch (error) {
          console.error(`Error registrando ley ${ley.titulo} en blockchain:`, error);
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Sesión activada y registrada en blockchain exitosamente',
      data: {
        sesion,
        blockchain: blockchainResult,
        leyesRegistradas: leyesConBlockchain.length
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error activando sesión en blockchain',
      error: error.message
    });
  }
});

const finalizarSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  if (sesion.estado !== 'active') {
    return res.status(400).json({
      status: 'error',
      message: 'Solo se pueden finalizar sesiones activas'
    });
  }

  try {
    // Finalizar sesión en blockchain si está registrada
    if (sesion.isOnBlockchain && sesion.blockchainId !== null) {
      await blockchainService.finalizarSesion(sesion.blockchainId);
    }

    // Actualizar estado de la sesión
    sesion.estado = 'finished';
    sesion.fechaFin = new Date();
    await sesion.save();

    // Actualizar estado de todas las leyes
    const leyes = await Ley.find({ sesion: req.params.id });
    for (const ley of leyes) {
      if (ley.estaAprobada()) {
        ley.estado = 'approved';
        ley.fechaAprobacion = new Date();
      } else {
        ley.estado = 'rejected';
      }
      await ley.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Sesión finalizada exitosamente',
      data: {
        sesion,
        leyesActualizadas: leyes.length
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error finalizando sesión',
      error: error.message
    });
  }
});

const cancelarSesion = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  if (sesion.estado === 'finished' || sesion.estado === 'cancelled') {
    return res.status(400).json({
      status: 'error',
      message: 'No se puede cancelar una sesión ya finalizada o cancelada'
    });
  }

  // Actualizar estado
  sesion.estado = 'cancelled';
  await sesion.save();

  // Cancelar todas las leyes
  await Ley.updateMany(
    { sesion: req.params.id },
    { estado: 'cancelled' }
  );

  res.status(200).json({
    status: 'success',
    message: 'Sesión cancelada exitosamente',
    data: {
      sesion
    }
  });
});

const sincronizarConBlockchain = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const sesion = await Sesion.findById(req.params.id);

  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  if (!sesion.isOnBlockchain || sesion.blockchainId === null) {
    return res.status(400).json({
      status: 'error',
      message: 'La sesión no está registrada en blockchain'
    });
  }

  try {
    const syncResults = [];
    const leyes = await Ley.find({ sesion: req.params.id });

    for (const ley of leyes) {
      if (ley.isOnBlockchain && ley.blockchainId !== null) {
        try {
          // Sincronizar resultados de votación desde blockchain
          const resultadosBlockchain = await blockchainService.obtenerResultadosLey(
            sesion.blockchainId,
            ley.blockchainId
          );

          // Actualizar contadores en la base de datos
          const needsUpdate = (
            ley.votosAFavor !== resultadosBlockchain.votosAFavor ||
            ley.votosEnContra !== resultadosBlockchain.votosEnContra ||
            ley.abstenciones !== resultadosBlockchain.abstenciones ||
            ley.ausentes !== resultadosBlockchain.ausentes
          );

          if (needsUpdate) {
            ley.votosAFavor = resultadosBlockchain.votosAFavor;
            ley.votosEnContra = resultadosBlockchain.votosEnContra;
            ley.abstenciones = resultadosBlockchain.abstenciones;
            ley.ausentes = resultadosBlockchain.ausentes;
            await ley.save();
          }

          syncResults.push({
            ley: {
              id: ley._id,
              titulo: ley.titulo,
              blockchainId: ley.blockchainId
            },
            updated: needsUpdate,
            resultados: resultadosBlockchain
          });
        } catch (error) {
          syncResults.push({
            ley: {
              id: ley._id,
              titulo: ley.titulo
            },
            error: error.message
          });
        }
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Sincronización completada',
      data: {
        sesion: {
          id: sesion._id,
          titulo: sesion.titulo,
          blockchainId: sesion.blockchainId
        },
        results: syncResults
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error en sincronización',
      error: error.message
    });
  }
});

const getSesionStats = catchAsync(async (req, res, next) => {
  const stats = await Sesion.aggregate([
    {
      $group: {
        _id: null,
        totalSesiones: { $sum: 1 },
        draft: { $sum: { $cond: [{ $eq: ['$estado', 'draft'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$estado', 'active'] }, 1, 0] } },
        finished: { $sum: { $cond: [{ $eq: ['$estado', 'finished'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$estado', 'cancelled'] }, 1, 0] } },
        onBlockchain: { $sum: { $cond: [{ $eq: ['$isOnBlockchain', true] }, 1, 0] } }
      }
    }
  ]);

  // Stats por mes
  const statsPorMes = await Sesion.aggregate([
    {
      $group: {
        _id: {
          year: { $year: '$fechaCreacion' },
          month: { $month: '$fechaCreacion' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': -1, '_id.month': -1 }
    },
    {
      $limit: 12
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      general: stats[0] || {
        totalSesiones: 0,
        draft: 0,
        active: 0,
        finished: 0,
        cancelled: 0,
        onBlockchain: 0
      },
      porMes: statsPorMes
    }
  });
});

module.exports = {
  getAllSesiones,
  getSesion,
  crearSesion,
  updateSesion,
  deleteSesion,
  getLeyesDeSesion,
  agregarLey,
  updateLey,
  eliminarLey,
  activarSesion,
  finalizarSesion,
  cancelarSesion,
  sincronizarConBlockchain,
  getSesionStats
}; 