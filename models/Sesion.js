const mongoose = require('mongoose');

const sesionSchema = new mongoose.Schema({
  // ID en blockchain
  blockchainId: {
    type: Number,
    unique: true,
    sparse: true // Permite null hasta que se registre en blockchain
  },
  
  // Información básica
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [200, 'El título no puede tener más de 200 caracteres']
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [1000, 'La descripción no puede tener más de 1000 caracteres']
  },
  fecha: {
    type: String,
    required: [true, 'La fecha es requerida']
  },
  
  // Estado de la sesión
  estado: {
    type: String,
    enum: ['draft', 'active', 'finished', 'cancelled'],
    default: 'draft'
  },
  
  // Información de blockchain
  isOnBlockchain: {
    type: Boolean,
    default: false
  },
  transactionHash: {
    type: String,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Hash de transacción inválido']
  },
  
  // Referencias a leyes
  leyes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ley'
  }],
  
  // Metadata
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaInicio: Date,
  fechaFin: Date,
  
  // Configuración de votación
  tipoVotacion: {
    type: String,
    enum: ['simple', 'calificada'],
    default: 'simple'
  },
  quorumRequerido: {
    type: Number,
    min: 1,
    max: 100,
    default: 50 // Porcentaje
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para contar leyes
sesionSchema.virtual('cantidadLeyes').get(function() {
  return this.leyes ? this.leyes.length : 0;
});

// Middleware para poblar leyes automáticamente
sesionSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'leyes',
    select: 'titulo descripcion estado votosAFavor votosEnContra abstenciones'
  }).populate({
    path: 'creadoPor',
    select: 'nombre apellido email'
  });
  next();
});

// Índices
sesionSchema.index({ blockchainId: 1 });
sesionSchema.index({ estado: 1 });
sesionSchema.index({ creadoPor: 1 });
sesionSchema.index({ fechaCreacion: -1 });

module.exports = mongoose.model('Sesion', sesionSchema); 