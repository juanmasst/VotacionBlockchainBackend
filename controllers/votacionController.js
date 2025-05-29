const { validationResult } = require('express-validator');
const Sesion = require('../models/Sesion');
const Ley = require('../models/Ley');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');
const { catchAsync } = require('../middleware/errorHandler');

const registrarVoto = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { sesionId, leyId, voto } = req.body;

  // Verificar que la sesión existe y está activa
  const sesion = await Sesion.findById(sesionId);
  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  if (sesion.estado !== 'active') {
    return res.status(400).json({
      status: 'error',
      message: 'Solo se puede votar en sesiones activas'
    });
  }

  // Verificar que la ley existe en la sesión
  const ley = await Ley.findOne({ _id: leyId, sesion: sesionId });
  if (!ley) {
    return res.status(404).json({
      status: 'error',
      message: 'Ley no encontrada en esta sesión'
    });
  }

  if (ley.estado !== 'voting') {
    return res.status(400).json({
      status: 'error',
      message: 'La ley no está disponible para votación'
    });
  }

  // Verificar si el legislador ya votó
  const votoExistente = ley.votos.find(v => v.legislador.toString() === req.user._id.toString());

  try {
    // Registrar voto en blockchain
    const estadoVotoNumerico = blockchainService.mapearEstadoVoto(voto);
    
    // Para este ejemplo, asumimos que cada usuario tiene su private key
    // En un sistema real, esto debería manejarse de forma más segura
    const privateKeyLegislador = req.body.privateKey || process.env.LEGISLADOR_PRIVATE_KEY;
    
    if (!privateKeyLegislador) {
      return res.status(400).json({
        status: 'error',
        message: 'Private key del legislador requerida para votar en blockchain'
      });
    }

    const blockchainResult = await blockchainService.registrarVoto(
      sesion.blockchainId,
      ley.blockchainId,
      estadoVotoNumerico,
      privateKeyLegislador
    );

    // Actualizar contadores en la base de datos
    if (votoExistente) {
      // Decrementar contador anterior
      const votoAnterior = votoExistente.voto;
      if (votoAnterior === 'A_FAVOR') ley.votosAFavor--;
      else if (votoAnterior === 'EN_CONTRA') ley.votosEnContra--;
      else if (votoAnterior === 'ABSTENCION') ley.abstenciones--;
      else if (votoAnterior === 'PRESENTE') ley.presentes--;

      // Actualizar voto existente
      votoExistente.voto = voto;
      votoExistente.fecha = new Date();
      votoExistente.transactionHash = blockchainResult.transactionHash;
    } else {
      // Crear nuevo voto
      ley.votos.push({
        legislador: req.user._id,
        voto: voto,
        fecha: new Date(),
        transactionHash: blockchainResult.transactionHash
      });
    }

    // Incrementar contador nuevo
    if (voto === 'A_FAVOR') ley.votosAFavor++;
    else if (voto === 'EN_CONTRA') ley.votosEnContra++;
    else if (voto === 'ABSTENCION') ley.abstenciones++;
    else if (voto === 'PRESENTE') ley.presentes++;

    // Actualizar fecha de votación
    ley.fechaVotacion = new Date();
    await ley.save();

    res.status(200).json({
      status: 'success',
      message: votoExistente ? 'Voto actualizado exitosamente' : 'Voto registrado exitosamente',
      data: {
        voto: {
          sesionId,
          leyId,
          voto,
          fecha: new Date(),
          legislador: {
            id: req.user._id,
            nombre: req.user.nombreCompleto
          }
        },
        blockchain: blockchainResult,
        resultadosActuales: {
          votosAFavor: ley.votosAFavor,
          votosEnContra: ley.votosEnContra,
          abstenciones: ley.abstenciones,
          presentes: ley.presentes
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: 'Error registrando voto en blockchain',
      error: error.message
    });
  }
});

const obtenerResultados = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { sesionId, leyId } = req.params;

  // Verificar que la ley existe
  const ley = await Ley.findOne({ _id: leyId, sesion: sesionId })
    .populate('votos.legislador', 'nombre apellido numeroLegislador partido');

  if (!ley) {
    return res.status(404).json({
      status: 'error',
      message: 'Ley no encontrada en esta sesión'
    });
  }

  // Obtener resultados desde blockchain si está disponible
  let resultadosBlockchain = null;
  if (ley.isOnBlockchain && ley.blockchainId !== null) {
    try {
      const sesion = await Sesion.findById(sesionId);
      if (sesion && sesion.isOnBlockchain) {
        resultadosBlockchain = await blockchainService.obtenerResultadosLey(
          sesion.blockchainId,
          ley.blockchainId
        );
      }
    } catch (error) {
      console.warn('Error obteniendo resultados de blockchain:', error.message);
    }
  }

  // Calcular estadísticas adicionales
  const totalVotos = ley.totalVotos;
  const totalLegisladores = await User.countDocuments({ 
    role: 'legislador', 
    isActive: true,
    isRegisteredOnBlockchain: true 
  });

  const participacion = totalLegisladores > 0 ? 
    ((totalVotos / totalLegisladores) * 100).toFixed(2) : 0;

  res.status(200).json({
    status: 'success',
    data: {
      ley: {
        id: ley._id,
        titulo: ley.titulo,
        descripcion: ley.descripcion,
        categoria: ley.categoria,
        estado: ley.estado
      },
      resultados: {
        baseDeDatos: {
          votosAFavor: ley.votosAFavor,
          votosEnContra: ley.votosEnContra,
          abstenciones: ley.abstenciones,
          presentes: ley.presentes,
          ausentes: ley.ausentes,
          totalVotos: totalVotos
        },
        blockchain: resultadosBlockchain,
        porcentajes: {
          aprobacion: ley.porcentajeAprobacion,
          rechazo: ley.porcentajeRechazo,
          abstencion: ley.porcentajeAbstencion,
          participacion: participacion
        }
      },
      estadisticas: {
        totalLegisladores,
        estaAprobada: ley.estaAprobada(),
        fechaVotacion: ley.fechaVotacion
      },
      votos: ley.votos.map(voto => ({
        legislador: {
          id: voto.legislador._id,
          nombre: voto.legislador.nombreCompleto,
          numeroLegislador: voto.legislador.numeroLegislador,
          partido: voto.legislador.partido
        },
        voto: voto.voto,
        fecha: voto.fecha
      }))
    }
  });
});

const obtenerMiVoto = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { sesionId, leyId } = req.params;

  const ley = await Ley.findOne({ _id: leyId, sesion: sesionId });

  if (!ley) {
    return res.status(404).json({
      status: 'error',
      message: 'Ley no encontrada en esta sesión'
    });
  }

  const miVoto = ley.votos.find(v => v.legislador.toString() === req.user._id.toString());

  res.status(200).json({
    status: 'success',
    data: {
      ley: {
        id: ley._id,
        titulo: ley.titulo
      },
      miVoto: miVoto ? {
        voto: miVoto.voto,
        fecha: miVoto.fecha,
        transactionHash: miVoto.transactionHash
      } : null,
      puedeVotar: ley.estado === 'voting'
    }
  });
});

const obtenerMisVotos = catchAsync(async (req, res, next) => {
  const { sesionId } = req.params;

  const sesion = await Sesion.findById(sesionId);
  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  const leyes = await Ley.find({ sesion: sesionId });
  
  const misVotos = leyes.map(ley => {
    const miVoto = ley.votos.find(v => v.legislador.toString() === req.user._id.toString());
    
    return {
      ley: {
        id: ley._id,
        titulo: ley.titulo,
        categoria: ley.categoria,
        estado: ley.estado
      },
      miVoto: miVoto ? {
        voto: miVoto.voto,
        fecha: miVoto.fecha,
        transactionHash: miVoto.transactionHash
      } : null,
      puedeVotar: ley.estado === 'voting'
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      sesion: {
        id: sesion._id,
        titulo: sesion.titulo,
        estado: sesion.estado
      },
      misVotos: misVotos
    }
  });
});

const getEstadisticasGenerales = catchAsync(async (req, res, next) => {
  // Stats generales de votación
  const statsGenerales = await Ley.aggregate([
    {
      $group: {
        _id: null,
        totalLeyes: { $sum: 1 },
        leyesAprobadas: { $sum: { $cond: [{ $gt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        leyesRechazadas: { $sum: { $cond: [{ $lt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        leyesEmpate: { $sum: { $cond: [{ $eq: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        totalVotos: { $sum: { $add: ['$votosAFavor', '$votosEnContra', '$abstenciones'] } }
      }
    }
  ]);

  // Stats por categoría
  const statsPorCategoria = await Ley.aggregate([
    {
      $group: {
        _id: '$categoria',
        total: { $sum: 1 },
        aprobadas: { $sum: { $cond: [{ $gt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        rechazadas: { $sum: { $cond: [{ $lt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  // Stats por estado
  const statsPorEstado = await Ley.aggregate([
    {
      $group: {
        _id: '$estado',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      general: statsGenerales[0] || {
        totalLeyes: 0,
        leyesAprobadas: 0,
        leyesRechazadas: 0,
        leyesEmpate: 0,
        totalVotos: 0
      },
      porCategoria: statsPorCategoria,
      porEstado: statsPorEstado
    }
  });
});

const getEstadisticasSesion = catchAsync(async (req, res, next) => {
  const { sesionId } = req.params;

  const sesion = await Sesion.findById(sesionId);
  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  // Stats de la sesión
  const statsSesion = await Ley.aggregate([
    {
      $match: { sesion: sesion._id }
    },
    {
      $group: {
        _id: null,
        totalLeyes: { $sum: 1 },
        leyesAprobadas: { $sum: { $cond: [{ $gt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        leyesRechazadas: { $sum: { $cond: [{ $lt: ['$votosAFavor', '$votosEnContra'] }, 1, 0] } },
        totalVotos: { $sum: { $add: ['$votosAFavor', '$votosEnContra', '$abstenciones'] } },
        promedioAbstenciones: { $avg: '$abstenciones' }
      }
    }
  ]);

  // Participación por ley
  const participacionPorLey = await Ley.find({ sesion: sesionId }, 
    'titulo votosAFavor votosEnContra abstenciones presentes')
    .lean();

  const totalLegisladores = await User.countDocuments({ 
    role: 'legislador', 
    isActive: true,
    isRegisteredOnBlockchain: true 
  });

  const participacionDetallada = participacionPorLey.map(ley => ({
    ley: {
      id: ley._id,
      titulo: ley.titulo
    },
    votos: {
      aFavor: ley.votosAFavor,
      enContra: ley.votosEnContra,
      abstenciones: ley.abstenciones,
      presentes: ley.presentes,
      total: ley.votosAFavor + ley.votosEnContra + ley.abstenciones
    },
    participacion: totalLegisladores > 0 ? 
      (((ley.votosAFavor + ley.votosEnContra + ley.abstenciones) / totalLegisladores) * 100).toFixed(2) : 0
  }));

  res.status(200).json({
    status: 'success',
    data: {
      sesion: {
        id: sesion._id,
        titulo: sesion.titulo,
        estado: sesion.estado,
        fecha: sesion.fecha
      },
      estadisticas: statsSesion[0] || {
        totalLeyes: 0,
        leyesAprobadas: 0,
        leyesRechazadas: 0,
        totalVotos: 0,
        promedioAbstenciones: 0
      },
      participacion: {
        totalLegisladores,
        detallePorLey: participacionDetallada
      }
    }
  });
});

const getEstadisticasLegislador = catchAsync(async (req, res, next) => {
  const { legisladorId } = req.params;

  const legislador = await User.findById(legisladorId);
  if (!legislador || legislador.role !== 'legislador') {
    return res.status(404).json({
      status: 'error',
      message: 'Legislador no encontrado'
    });
  }

  // Obtener todos los votos del legislador
  const leyes = await Ley.find({
    'votos.legislador': legisladorId
  }).populate('sesion', 'titulo fecha estado');

  let estadisticas = {
    totalVotos: 0,
    votosAFavor: 0,
    votosEnContra: 0,
    abstenciones: 0,
    presentes: 0,
    participacion: 0
  };

  const historialVotos = [];

  leyes.forEach(ley => {
    const voto = ley.votos.find(v => v.legislador.toString() === legisladorId);
    if (voto) {
      estadisticas.totalVotos++;
      
      switch (voto.voto) {
        case 'A_FAVOR':
          estadisticas.votosAFavor++;
          break;
        case 'EN_CONTRA':
          estadisticas.votosEnContra++;
          break;
        case 'ABSTENCION':
          estadisticas.abstenciones++;
          break;
        case 'PRESENTE':
          estadisticas.presentes++;
          break;
      }

      historialVotos.push({
        ley: {
          id: ley._id,
          titulo: ley.titulo,
          categoria: ley.categoria
        },
        sesion: {
          id: ley.sesion._id,
          titulo: ley.sesion.titulo,
          fecha: ley.sesion.fecha
        },
        voto: voto.voto,
        fecha: voto.fecha,
        resultado: ley.estaAprobada() ? 'aprobada' : 'rechazada'
      });
    }
  });

  // Calcular participación total
  const totalLeyesDisponibles = await Ley.countDocuments({ estado: { $in: ['voting', 'approved', 'rejected'] } });
  estadisticas.participacion = totalLeyesDisponibles > 0 ? 
    ((estadisticas.totalVotos / totalLeyesDisponibles) * 100).toFixed(2) : 0;

  res.status(200).json({
    status: 'success',
    data: {
      legislador: {
        id: legislador._id,
        nombre: legislador.nombreCompleto,
        numeroLegislador: legislador.numeroLegislador,
        partido: legislador.partido,
        distrito: legislador.distrito
      },
      estadisticas,
      historial: historialVotos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    }
  });
});

const getHistorialMisVotos = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Obtener leyes donde el usuario actual ha votado
  const leyes = await Ley.find({
    'votos.legislador': req.user._id
  })
  .populate('sesion', 'titulo fecha estado')
  .sort({ 'votos.fecha': -1 })
  .skip(skip)
  .limit(limit);

  const total = await Ley.countDocuments({
    'votos.legislador': req.user._id
  });

  const historial = leyes.map(ley => {
    const miVoto = ley.votos.find(v => v.legislador.toString() === req.user._id.toString());
    
    return {
      ley: {
        id: ley._id,
        titulo: ley.titulo,
        categoria: ley.categoria,
        estado: ley.estado
      },
      sesion: {
        id: ley.sesion._id,
        titulo: ley.sesion.titulo,
        fecha: ley.sesion.fecha,
        estado: ley.sesion.estado
      },
      miVoto: {
        voto: miVoto.voto,
        fecha: miVoto.fecha,
        transactionHash: miVoto.transactionHash
      },
      resultado: {
        aprobada: ley.estaAprobada(),
        votosAFavor: ley.votosAFavor,
        votosEnContra: ley.votosEnContra
      }
    };
  });

  res.status(200).json({
    status: 'success',
    results: historial.length,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      historial
    }
  });
});

const getHistorialSesion = catchAsync(async (req, res, next) => {
  const { sesionId } = req.params;

  const sesion = await Sesion.findById(sesionId);
  if (!sesion) {
    return res.status(404).json({
      status: 'error',
      message: 'Sesión no encontrada'
    });
  }

  const leyes = await Ley.find({ sesion: sesionId })
    .populate('votos.legislador', 'nombre apellido numeroLegislador partido')
    .sort({ fechaCreacion: 1 });

  const historial = leyes.map(ley => ({
    ley: {
      id: ley._id,
      titulo: ley.titulo,
      categoria: ley.categoria,
      estado: ley.estado,
      fechaCreacion: ley.fechaCreacion,
      fechaVotacion: ley.fechaVotacion
    },
    resultados: {
      votosAFavor: ley.votosAFavor,
      votosEnContra: ley.votosEnContra,
      abstenciones: ley.abstenciones,
      presentes: ley.presentes,
      estaAprobada: ley.estaAprobada()
    },
    votos: ley.votos.map(voto => ({
      legislador: {
        id: voto.legislador._id,
        nombre: voto.legislador.nombreCompleto,
        numeroLegislador: voto.legislador.numeroLegislador,
        partido: voto.legislador.partido
      },
      voto: voto.voto,
      fecha: voto.fecha
    })).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  }));

  res.status(200).json({
    status: 'success',
    data: {
      sesion: {
        id: sesion._id,
        titulo: sesion.titulo,
        descripcion: sesion.descripcion,
        fecha: sesion.fecha,
        estado: sesion.estado,
        fechaInicio: sesion.fechaInicio,
        fechaFin: sesion.fechaFin
      },
      historial
    }
  });
});

module.exports = {
  registrarVoto,
  obtenerResultados,
  obtenerMiVoto,
  obtenerMisVotos,
  getEstadisticasGenerales,
  getEstadisticasSesion,
  getEstadisticasLegislador,
  getHistorialMisVotos,
  getHistorialSesion
}; 