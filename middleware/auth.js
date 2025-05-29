const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remover password del output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

const protect = async (req, res, next) => {
  try {
    // 1) Obtener token y verificar que existe
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'No estás autenticado. Por favor inicia sesión para acceder.'
      });
    }

    // 2) Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Verificar si el usuario existe
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'El token pertenece a un usuario que ya no existe.'
      });
    }

    // 4) Verificar si el usuario está activo
    if (!currentUser.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
      });
    }

    // 5) Verificar si el usuario cambió la password después de emitir el token
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'error',
        message: 'El usuario cambió la contraseña recientemente. Por favor inicia sesión de nuevo.'
      });
    }

    // 6) Actualizar último login
    currentUser.ultimoLogin = new Date();
    await currentUser.save({ validateBeforeSave: false });

    // Otorgar acceso al usuario
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido. Por favor inicia sesión de nuevo.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expirado. Por favor inicia sesión de nuevo.'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Error de autenticación'
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para realizar esta acción'
      });
    }
    next();
  };
};

const verificarLegisladorRegistrado = async (req, res, next) => {
  try {
    if (!req.user.isRegisteredOnBlockchain) {
      return res.status(403).json({
        status: 'error',
        message: 'Debes estar registrado en blockchain antes de poder votar'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Error verificando estado de blockchain'
    });
  }
};

module.exports = {
  signToken,
  createSendToken,
  protect,
  restrictTo,
  verificarLegisladorRegistrado
}; 