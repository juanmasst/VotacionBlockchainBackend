const express = require('express');
const { body, param } = require('express-validator');
const votacionController = require('../controllers/votacionController');
const { protect, verificarLegisladorRegistrado } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Validaciones
const votarValidation = [
  body('sesionId')
    .isMongoId()
    .withMessage('ID de sesión inválido'),
  body('leyId')
    .isMongoId()
    .withMessage('ID de ley inválido'),
  body('voto')
    .isIn(['PRESENTE', 'A_FAVOR', 'EN_CONTRA', 'ABSTENCION'])
    .withMessage('Tipo de voto inválido')
];

const mongoIdValidation = [
  param('sesionId')
    .isMongoId()
    .withMessage('ID de sesión inválido'),
  param('leyId')
    .isMongoId()
    .withMessage('ID de ley inválido')
];

// Rutas para votación (requiere legislador registrado en blockchain)
router.post('/votar', votarValidation, verificarLegisladorRegistrado, votacionController.registrarVoto);

// Rutas para consultar resultados (todos los usuarios autenticados)
router.get('/resultados/:sesionId/:leyId', mongoIdValidation, votacionController.obtenerResultados);
router.get('/mi-voto/:sesionId/:leyId', mongoIdValidation, votacionController.obtenerMiVoto);
router.get('/sesion/:sesionId/mis-votos', votacionController.obtenerMisVotos);

// Rutas para estadísticas
router.get('/stats/general', votacionController.getEstadisticasGenerales);
router.get('/stats/sesion/:sesionId', votacionController.getEstadisticasSesion);
router.get('/stats/legislador/:legisladorId', votacionController.getEstadisticasLegislador);

// Rutas históricas
router.get('/historial/mis-votos', votacionController.getHistorialMisVotos);
router.get('/historial/sesion/:sesionId', votacionController.getHistorialSesion);

module.exports = router;

