const { validationResult } = require('express-validator');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');
const { catchAsync } = require('../middleware/errorHandler');

const getAllLegisladores = catchAsync(async (req, res, next) => {
  const features = {
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 10,
    sort: req.query.sort || '-fechaRegistro',
    fields: req.query.fields
  };

  // Filtros
  const queryObj = { ...req.query };
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  excludedFields.forEach(el => delete queryObj[el]);

  // Filtros avanzados
  if (req.query.partido) queryObj.partido = { $regex: req.query.partido, $options: 'i' };
  if (req.query.distrito) queryObj.distrito = { $regex: req.query.distrito, $options: 'i' };
  if (req.query.isRegisteredOnBlockchain !== undefined) {
    queryObj.isRegisteredOnBlockchain = req.query.isRegisteredOnBlockchain === 'true';
  }

  // Construir query
  let query = User.find(queryObj);

  // Sorting
  if (features.sort) {
    const sortBy = features.sort.split(',').join(' ');
    query = query.sort(sortBy);
  }

  // Field limiting
  if (features.fields) {
    const fields = features.fields.split(',').join(' ');
    query = query.select(fields);
  } else {
    query = query.select('-password');
  }

  // Pagination
  const skip = (features.page - 1) * features.limit;
  query = query.skip(skip).limit(features.limit);

  // Ejecutar query
  const legisladores = await query;
  const total = await User.countDocuments(queryObj);

  res.status(200).json({
    status: 'success',
    results: legisladores.length,
    total,
    page: features.page,
    totalPages: Math.ceil(total / features.limit),
    data: {
      legisladores
    }
  });
});

const getLegislador = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const legislador = await User.findById(req.params.id).select('-password');

  if (!legislador) {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  // Verificar estado en blockchain si está registrado
  let blockchainStatus = null;
  if (legislador.isRegisteredOnBlockchain) {
    try {
      const isRegistered = await blockchainService.verificarLegislador(legislador.walletAddress);
      blockchainStatus = {
        registeredOnBlockchain: isRegistered,
        syncStatus: isRegistered === legislador.isRegisteredOnBlockchain ? 'sync' : 'out-of-sync'
      };
    } catch (error) {
      blockchainStatus = {
        registeredOnBlockchain: null,
        syncStatus: 'error',
        error: error.message
      };
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      legislador,
      blockchainStatus
    }
  });
});

const updateLegislador = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  // Campos permitidos para actualizar
  const allowedFields = [
    'nombre', 'apellido', 'email', 'telefono', 
    'numeroLegislador', 'partido', 'distrito', 'isActive'
  ];

  const updateData = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updateData[key] = req.body[key];
    }
  });

  const legislador = await User.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  if (!legislador) {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      legislador
    }
  });
});

const deleteLegislador = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const legislador = await User.findById(req.params.id);

  if (!legislador) {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  // Si está registrado en blockchain, eliminarlo primero
  if (legislador.isRegisteredOnBlockchain) {
    try {
      await blockchainService.eliminarLegislador(legislador.walletAddress);
    } catch (error) {
      console.warn('Error eliminando de blockchain:', error.message);
    }
  }

  // Soft delete - marcar como inactivo
  await User.findByIdAndUpdate(req.params.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

const registrarEnBlockchain = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const legislador = await User.findById(req.params.id);

  if (!legislador) {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  if (legislador.isRegisteredOnBlockchain) {
    return res.status(400).json({
      status: 'error',
      message: 'El legislador ya está registrado en blockchain'
    });
  }

  try {
    // Registrar en blockchain
    const result = await blockchainService.registrarLegislador(legislador.walletAddress);

    // Actualizar estado en BD
    legislador.isRegisteredOnBlockchain = true;
    await legislador.save();

    res.status(200).json({
      status: 'success',
      message: 'Legislador registrado exitosamente en blockchain',
      data: {
        legislador,
        blockchain: result
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error registrando en blockchain',
      error: error.message
    });
  }
});

const eliminarDeBlockchain = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const legislador = await User.findById(req.params.id);

  if (!legislador) {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  if (!legislador.isRegisteredOnBlockchain) {
    return res.status(400).json({
      status: 'error',
      message: 'El legislador no está registrado en blockchain'
    });
  }

  try {
    // Eliminar de blockchain
    const result = await blockchainService.eliminarLegislador(legislador.walletAddress);

    // Actualizar estado en BD
    legislador.isRegisteredOnBlockchain = false;
    await legislador.save();

    res.status(200).json({
      status: 'success',
      message: 'Legislador eliminado exitosamente de blockchain',
      data: {
        legislador,
        blockchain: result
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error eliminando de blockchain',
      error: error.message
    });
  }
});

const syncronizarConBlockchain = catchAsync(async (req, res, next) => {
  try {
    const legisladores = await User.find({ role: 'legislador' });
    const syncResults = [];

    for (const legislador of legisladores) {
      try {
        const isRegisteredOnBlockchain = await blockchainService.verificarLegislador(legislador.walletAddress);
        const needsUpdate = isRegisteredOnBlockchain !== legislador.isRegisteredOnBlockchain;

        if (needsUpdate) {
          legislador.isRegisteredOnBlockchain = isRegisteredOnBlockchain;
          await legislador.save();
        }

        syncResults.push({
          legislador: {
            id: legislador._id,
            nombre: legislador.nombreCompleto,
            walletAddress: legislador.walletAddress
          },
          beforeSync: !isRegisteredOnBlockchain,
          afterSync: isRegisteredOnBlockchain,
          updated: needsUpdate
        });
      } catch (error) {
        syncResults.push({
          legislador: {
            id: legislador._id,
            nombre: legislador.nombreCompleto,
            walletAddress: legislador.walletAddress
          },
          error: error.message
        });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Sincronización completada',
      data: {
        totalLegisladores: legisladores.length,
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

const getMyBlockchainStatus = catchAsync(async (req, res, next) => {
  try {
    const isRegisteredOnBlockchain = await blockchainService.verificarLegislador(req.user.walletAddress);
    const syncStatus = isRegisteredOnBlockchain === req.user.isRegisteredOnBlockchain ? 'sync' : 'out-of-sync';

    res.status(200).json({
      status: 'success',
      data: {
        walletAddress: req.user.walletAddress,
        databaseStatus: req.user.isRegisteredOnBlockchain,
        blockchainStatus: isRegisteredOnBlockchain,
        syncStatus,
        canVote: isRegisteredOnBlockchain && req.user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error verificando estado de blockchain',
      error: error.message
    });
  }
});

const getLegisladorStats = catchAsync(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $match: { role: 'legislador' }
    },
    {
      $group: {
        _id: null,
        totalLegisladores: { $sum: 1 },
        activosEnBD: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
        registradosEnBlockchain: { $sum: { $cond: [{ $eq: ['$isRegisteredOnBlockchain', true] }, 1, 0] } },
        inactivosEnBD: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } }
      }
    }
  ]);

  // Stats por partido
  const statsPorPartido = await User.aggregate([
    {
      $match: { role: 'legislador', isActive: true }
    },
    {
      $group: {
        _id: '$partido',
        total: { $sum: 1 },
        registradosEnBlockchain: { $sum: { $cond: [{ $eq: ['$isRegisteredOnBlockchain', true] }, 1, 0] } }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  // Stats por distrito
  const statsPorDistrito = await User.aggregate([
    {
      $match: { role: 'legislador', isActive: true }
    },
    {
      $group: {
        _id: '$distrito',
        total: { $sum: 1 },
        registradosEnBlockchain: { $sum: { $cond: [{ $eq: ['$isRegisteredOnBlockchain', true] }, 1, 0] } }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      general: stats[0] || {
        totalLegisladores: 0,
        activosEnBD: 0,
        registradosEnBlockchain: 0,
        inactivosEnBD: 0
      },
      porPartido: statsPorPartido,
      porDistrito: statsPorDistrito
    }
  });
});

module.exports = {
  getAllLegisladores,
  getLegislador,
  updateLegislador,
  deleteLegislador,
  registrarEnBlockchain,
  eliminarDeBlockchain,
  syncronizarConBlockchain,
  getMyBlockchainStatus,
  getLegisladorStats
}; 