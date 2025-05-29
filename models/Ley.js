const mongoose = require('mongoose');

const leySchema = new mongoose.Schema({
  // ID en blockchain
  blockchainId: {
    type: Number,
    sparse: true // Permite null hasta que se registre en blockchain
  },
  
  // Información básica
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [300, 'El título no puede tener más de 300 caracteres']
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [2000, 'La descripción no puede tener más de 2000 caracteres']
  },
  categoria: {
    type: String,
    enum: ['economica', 'social', 'educacion', 'salud', 'seguridad', 'ambiental', 'otra'],
    default: 'otra'
  },
  
  // Referencia a sesión
  sesion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sesion',
    required: true
  },
  
  // Estado de la ley
  estado: {
    type: String,
    enum: ['draft', 'voting', 'approved', 'rejected', 'cancelled'],
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
  
  // Contadores de votos (sincronizados con blockchain)
  votosAFavor: {
    type: Number,
    default: 0,
    min: 0
  },
  votosEnContra: {
    type: Number,
    default: 0,
    min: 0
  },
  abstenciones: {
    type: Number,
    default: 0,
    min: 0
  },
  ausentes: {
    type: Number,
    default: 0,
    min: 0
  },
  presentes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Votos individuales (para tracking y auditoria)
  votos: [{
    legislador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    voto: {
      type: String,
      enum: ['AUSENTE', 'PRESENTE', 'A_FAVOR', 'EN_CONTRA', 'ABSTENCION'],
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    transactionHash: {
      type: String,
      match: [/^0x[a-fA-F0-9]{64}$/, 'Hash de transacción inválido']
    }
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
  fechaVotacion: Date,
  fechaAprobacion: Date,
  
  // Documentos adjuntos
  documentos: [{
    nombre: String,
    url: String,
    tipo: String,
    tamaño: Number
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals para cálculos
leySchema.virtual('totalVotos').get(function() {
  return this.votosAFavor + this.votosEnContra + this.abstenciones;
});

leySchema.virtual('porcentajeAprobacion').get(function() {
  const total = this.totalVotos;
  return total > 0 ? ((this.votosAFavor / total) * 100).toFixed(2) : 0;
});

leySchema.virtual('porcentajeRechazo').get(function() {
  const total = this.totalVotos;
  return total > 0 ? ((this.votosEnContra / total) * 100).toFixed(2) : 0;
});

leySchema.virtual('porcentajeAbstencion').get(function() {
  const total = this.totalVotos;
  return total > 0 ? ((this.abstenciones / total) * 100).toFixed(2) : 0;
});

// Método para verificar si está aprobada
leySchema.methods.estaAprobada = function() {
  return this.votosAFavor > this.votosEnContra;
};

// Método para obtener voto de un legislador específico
leySchema.methods.obtenerVotoLegislador = function(legisladorId) {
  const voto = this.votos.find(v => v.legislador.toString() === legisladorId.toString());
  return voto ? voto.voto : 'AUSENTE';
};

// Middleware para poblar referencias
leySchema.pre(/^find/, function(next) {
  this.populate({
    path: 'creadoPor',
    select: 'nombre apellido email'
  }).populate({
    path: 'votos.legislador',
    select: 'nombre apellido numeroLegislador'
  });
  next();
});

// Índices para optimizar consultas
leySchema.index({ sesion: 1 });
leySchema.index({ estado: 1 });
leySchema.index({ categoria: 1 });
leySchema.index({ blockchainId: 1, sesion: 1 }, { unique: true, sparse: true });
leySchema.index({ 'votos.legislador': 1 });

module.exports = mongoose.model('Ley', leySchema); 