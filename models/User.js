const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Información personal
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede tener más de 100 caracteres']
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [100, 'El apellido no puede tener más de 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Formato de email inválido'
    ]
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede tener más de 20 caracteres']
  },
  
  // Información de legislador
  numeroLegislador: {
    type: String,
    unique: true,
    sparse: true, // Permite null pero debe ser único si existe
    trim: true
  },
  partido: {
    type: String,
    trim: true,
    maxlength: [100, 'El partido no puede tener más de 100 caracteres']
  },
  distrito: {
    type: String,
    trim: true,
    maxlength: [100, 'El distrito no puede tener más de 100 caracteres']
  },
  
  // Información de blockchain
  walletAddress: {
    type: String,
    required: [true, 'La dirección de wallet es requerida'],
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Formato de dirección Ethereum inválido']
  },
  
  // Autenticación
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
    select: false // No incluir por defecto en las consultas
  },
  
  // Roles y permisos
  role: {
    type: String,
    enum: ['admin', 'legislador'],
    default: 'legislador'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isRegisteredOnBlockchain: {
    type: Boolean,
    default: false
  },
  
  // Metadata
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  ultimoLogin: {
    type: Date
  },
  
  // Tokens de verificación
  emailVerificationToken: String,
  emailVerified: {
    type: Boolean,
    default: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para nombre completo
userSchema.virtual('nombreCompleto').get(function() {
  return `${this.nombre} ${this.apellido}`;
});

// Middleware para hashear password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para comparar passwords
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Método para verificar si el password fue cambiado después de emitir el JWT
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Índices para optimizar consultas
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ numeroLegislador: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema); 