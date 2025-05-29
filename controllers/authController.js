const { validationResult } = require('express-validator');
const User = require('../models/User');
const { createSendToken } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const registro = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  // Crear nuevo usuario
  const newUser = await User.create({
    nombre: req.body.nombre,
    apellido: req.body.apellido,
    email: req.body.email,
    password: req.body.password,
    walletAddress: req.body.walletAddress,
    telefono: req.body.telefono,
    numeroLegislador: req.body.numeroLegislador,
    partido: req.body.partido,
    distrito: req.body.distrito
  });

  createSendToken(newUser, 201, res);
});

const login = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Verificar si el usuario existe y la contraseña es correcta
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: 'error',
      message: 'Email o contraseña incorrectos'
    });
  }

  // Verificar si el usuario está activo
  if (!user.isActive) {
    return res.status(401).json({
      status: 'error',
      message: 'Tu cuenta ha sido desactivada. Contacta al administrador.'
    });
  }

  createSendToken(user, 200, res);
});

const getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
});

const updateMe = catchAsync(async (req, res, next) => {
  // 1) Verificar que no se intente actualizar la contraseña
  if (req.body.password || req.body.passwordConfirm) {
    return res.status(400).json({
      status: 'error',
      message: 'Esta ruta no es para actualizar contraseñas. Usa /updatePassword.'
    });
  }

  // 2) Filtrar campos no permitidos
  const filteredBody = filterObj(
    req.body, 
    'nombre', 
    'apellido', 
    'email', 
    'telefono', 
    'numeroLegislador', 
    'partido', 
    'distrito'
  );

  // 3) Actualizar documento de usuario
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

const updatePassword = catchAsync(async (req, res, next) => {
  // Verificar errores de validación
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }

  // 1) Obtener usuario de la base de datos
  const user = await User.findById(req.user.id).select('+password');

  // 2) Verificar si la contraseña actual es correcta
  if (!(await user.correctPassword(req.body.passwordActual, user.password))) {
    return res.status(401).json({
      status: 'error',
      message: 'La contraseña actual es incorrecta'
    });
  }

  // 3) Actualizar contraseña
  user.password = req.body.passwordNueva;
  user.passwordChangedAt = Date.now() - 1000; // Restar 1 segundo para evitar problemas con JWT
  await user.save();

  // 4) Enviar JWT
  createSendToken(user, 200, res);
});

const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

module.exports = {
  registro,
  login,
  getMe,
  updateMe,
  updatePassword,
  deleteMe
}; 