const express = require('express');
const { body, param } = require('express-validator');
const legisladorController = require('../controllers/legisladorController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Validaciones
const registrarBlockchainValidation = [
  body('walletAddress')
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Dirección de wallet inválida')
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de usuario inválido')
];

// Rutas públicas para legisladores
router.get('/me/blockchain-status', legisladorController.getMyBlockchainStatus);

// Rutas solo para administradores
router.use(restrictTo('admin'));

router.get('/', legisladorController.getAllLegisladores);
router.get('/stats', legisladorController.getLegisladorStats);

router
  .route('/:id')
  .get(mongoIdValidation, legisladorController.getLegislador)
  .patch(mongoIdValidation, legisladorController.updateLegislador)
  .delete(mongoIdValidation, legisladorController.deleteLegislador);

// Rutas de blockchain
router.post(
  '/:id/register-blockchain', 
  mongoIdValidation, 
  legisladorController.registrarEnBlockchain
);

router.delete(
  '/:id/unregister-blockchain',
  mongoIdValidation,
  legisladorController.eliminarDeBlockchain
);

router.post('/sync-blockchain', legisladorController.syncronizarConBlockchain);

module.exports = router; 