const handleCastErrorDB = (err) => {
  const message = `Recurso inválido: ${err.path}: ${err.value}`;
  return new Error(message);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} duplicado: ${value}. Por favor usa otro valor.`;
  return new Error(message);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Datos inválidos: ${errors.join('. ')}`;
  return new Error(message);
};

const handleJWTError = () =>
  new Error('Token inválido. Por favor inicia sesión de nuevo.');

const handleJWTExpiredError = () =>
  new Error('Token expirado. Por favor inicia sesión de nuevo.');

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: 'error',
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Errores operacionales confiables: enviar mensaje al cliente
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: 'error',
      message: err.message
    });
  } 
  // Errores de programación u otros errores desconocidos: no filtrar detalles
  else {
    console.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Algo salió mal!'
    });
  }
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') error = handleCastErrorDB(error);

  // Mongoose duplicate key
  if (err.code === 11000) error = handleDuplicateFieldsDB(error);

  // Mongoose validation error
  if (err.name === 'ValidationError') error = handleValidationErrorDB(error);

  // JWT invalid token
  if (err.name === 'JsonWebTokenError') error = handleJWTError();

  // JWT expired token
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Blockchain errors
  if (err.message && err.message.includes('Error en blockchain')) {
    error.statusCode = 400;
    error.isOperational = true;
  }

  // Web3 connection errors
  if (err.message && err.message.includes('connection')) {
    error.statusCode = 503;
    error.message = 'Error de conexión con blockchain. Intenta más tarde.';
    error.isOperational = true;
  }

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  errorHandler,
  catchAsync
}; 