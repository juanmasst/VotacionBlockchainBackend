const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validaciones
const registroValidation = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('apellido')
    .notEmpty()
    .withMessage('El apellido es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Dirección de wallet inválida')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

const updatePasswordValidation = [
  body('passwordActual')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  body('passwordNueva')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
  body('passwordConfirmacion')
    .custom((value, { req }) => {
      if (value !== req.body.passwordNueva) {
        throw new Error('La confirmación de contraseña no coincide');
      }
      return true;
    })
];

// Rutas públicas
router.post('/registro', registroValidation, authController.registro);
router.post('/login', loginValidation, authController.login);

// Rutas protegidas
router.use(protect); // Todas las rutas siguientes requieren autenticación

router.get('/me', authController.getMe);
router.patch('/updateMe', authController.updateMe);
router.patch('/updatePassword', updatePasswordValidation, authController.updatePassword);
router.delete('/deleteMe', authController.deleteMe);

module.exports = router; 