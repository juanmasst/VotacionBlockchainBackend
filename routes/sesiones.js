const express = require('express');
const { body, param } = require('express-validator');
const sesionController = require('../controllers/sesionController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Validaciones
const crearSesionValidation = [
  body('titulo')
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ min: 5, max: 200 })
    .withMessage('El título debe tener entre 5 y 200 caracteres'),
  body('descripcion')
    .notEmpty()
    .withMessage('La descripción es requerida')
    .isLength({ min: 10, max: 1000 })
    .withMessage('La descripción debe tener entre 10 y 1000 caracteres'),
  body('fecha')
    .notEmpty()
    .withMessage('La fecha es requerida')
];

const agregarLeyValidation = [
  body('titulo')
    .notEmpty()
    .withMessage('El título de la ley es requerido')
    .isLength({ min: 5, max: 300 })
    .withMessage('El título debe tener entre 5 y 300 caracteres'),
  body('descripcion')
    .notEmpty()
    .withMessage('La descripción de la ley es requerida')
    .isLength({ min: 10, max: 2000 })
    .withMessage('La descripción debe tener entre 10 y 2000 caracteres'),
  body('categoria')
    .optional()
    .isIn(['economica', 'social', 'educacion', 'salud', 'seguridad', 'ambiental', 'otra'])
    .withMessage('Categoría inválida')
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de sesión inválido')
];

// Rutas públicas (para todos los usuarios autenticados)
router.get('/', sesionController.getAllSesiones);
router.get('/stats', sesionController.getSesionStats);
router.get('/:id', mongoIdValidation, sesionController.getSesion);
router.get('/:id/leyes', mongoIdValidation, sesionController.getLeyesDeSesion);

// Rutas solo para administradores
router.use(restrictTo('admin'));

router.post('/', crearSesionValidation, sesionController.crearSesion);

router
  .route('/:id')
  .patch(mongoIdValidation, sesionController.updateSesion)
  .delete(mongoIdValidation, sesionController.deleteSesion);

// Gestión de leyes en sesiones
router.post(
  '/:id/leyes',
  mongoIdValidation,
  agregarLeyValidation,
  sesionController.agregarLey
);

router
  .route('/:id/leyes/:leyId')
  .patch(mongoIdValidation, sesionController.updateLey)
  .delete(mongoIdValidation, sesionController.eliminarLey);

// Gestión de estado de sesión
router.post('/:id/activate', mongoIdValidation, sesionController.activarSesion);
router.post('/:id/finish', mongoIdValidation, sesionController.finalizarSesion);
router.post('/:id/cancel', mongoIdValidation, sesionController.cancelarSesion);

// Sincronización con blockchain
router.post('/:id/sync-blockchain', mongoIdValidation, sesionController.sincronizarConBlockchain);

module.exports = router; 