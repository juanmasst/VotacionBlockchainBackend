# Sistema de Votación Blockchain - Backend API

Backend completo para sistema de votación legislativa usando blockchain (Ethereum), Node.js, Express y MongoDB.

## 🚀 Características

- **Autenticación JWT** con roles de administrador y legislador
- **Integración blockchain** con contratos inteligentes en Ethereum
- **Base de datos MongoDB** para gestión de usuarios y datos
- **API RESTful** completa con validaciones
- **Sincronización** entre base de datos y blockchain
- **Middleware de seguridad** y manejo de errores

## 📋 Prerrequisitos

- Node.js v16 o superior
- MongoDB (local o Atlas)
- Red Ethereum (Ganache, testnet o mainnet)
- Postman o herramienta similar para pruebas de API

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd VotacionBlockchainBackend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp config.env .env
   ```
   
   Editar `.env` con tus configuraciones:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/votacion-blockchain
   BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
   CONTRACT_ADDRESS=0x... # Dirección del contrato desplegado
   ADMIN_PRIVATE_KEY=... # Private key del administrador (sin 0x)
   JWT_SECRET=tu_jwt_secret_muy_seguro
   JWT_EXPIRE=7d
   NODE_ENV=development
   ```

4. **Iniciar MongoDB**
   ```bash
   mongod
   ```

5. **Iniciar Ganache** (para desarrollo local)
   ```bash
   ganache-cli
   ```

6. **Desplegar el contrato inteligente**
   - Usar Remix IDE o Truffle
   - Copiar la dirección del contrato a `CONTRACT_ADDRESS`
   - Copiar la private key del administrador a `ADMIN_PRIVATE_KEY`

7. **Iniciar el servidor**
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## 📖 API Endpoints

### Autenticación

#### Registro de Usuario
```http
POST /api/auth/registro
Content-Type: application/json

{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com",
  "password": "123456",
  "walletAddress": "0x742d35Cc6C5027B6d0F6d1b9B4F5f3F1234567890",
  "numeroLegislador": "LEG001",
  "partido": "Partido Democrático",
  "distrito": "Distrito 1"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "123456"
}
```

#### Obtener Perfil
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Gestión de Legisladores (Solo Admin)

#### Listar Legisladores
```http
GET /api/legisladores
Authorization: Bearer <admin-token>
```

#### Registrar Legislador en Blockchain
```http
POST /api/legisladores/:id/register-blockchain
Authorization: Bearer <admin-token>
```

#### Eliminar Legislador de Blockchain
```http
DELETE /api/legisladores/:id/unregister-blockchain
Authorization: Bearer <admin-token>
```

### Gestión de Sesiones

#### Crear Sesión
```http
POST /api/sesiones
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "titulo": "Sesión Ordinaria",
  "descripcion": "Sesión para votar leyes importantes",
  "fecha": "2024-01-15"
}
```

#### Listar Sesiones
```http
GET /api/sesiones
Authorization: Bearer <token>
```

#### Agregar Ley a Sesión
```http
POST /api/sesiones/:id/leyes
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "titulo": "Ley de Presupuesto 2024",
  "descripcion": "Asignación presupuestaria para el año 2024",
  "categoria": "economica"
}
```

### Votación

#### Registrar Voto
```http
POST /api/votaciones/votar
Authorization: Bearer <legislador-token>
Content-Type: application/json

{
  "sesionId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "leyId": "64a1b2c3d4e5f6g7h8i9j0k2",
  "voto": "A_FAVOR"
}
```

Opciones de voto:
- `PRESENTE`: Solo registra asistencia
- `A_FAVOR`: Voto a favor
- `EN_CONTRA`: Voto en contra
- `ABSTENCION`: Abstención
- `AUSENTE`: Ausencia (usado internamente)

#### Obtener Resultados
```http
GET /api/votaciones/resultados/:sesionId/:leyId
Authorization: Bearer <token>
```

## 🔧 Estructura del Proyecto

```
├── controllers/          # Controladores de la API
├── middleware/          # Middleware de autenticación y errores
├── models/             # Modelos de MongoDB
├── routes/             # Definición de rutas
├── services/           # Servicios (blockchain, etc.)
├── contracts/          # ABI del contrato inteligente
├── server.js          # Punto de entrada
├── package.json       # Dependencias y scripts
└── config.env         # Variables de entorno
```

## 🗃️ Modelos de Datos

### Usuario/Legislador
```javascript
{
  nombre: String,
  apellido: String,
  email: String (único),
  walletAddress: String (único),
  numeroLegislador: String,
  partido: String,
  distrito: String,
  role: 'admin' | 'legislador',
  isActive: Boolean,
  isRegisteredOnBlockchain: Boolean
}
```

### Sesión
```javascript
{
  titulo: String,
  descripcion: String,
  fecha: String,
  estado: 'draft' | 'active' | 'finished' | 'cancelled',
  blockchainId: Number,
  isOnBlockchain: Boolean,
  leyes: [ObjectId],
  creadoPor: ObjectId
}
```

### Ley
```javascript
{
  titulo: String,
  descripcion: String,
  categoria: String,
  sesion: ObjectId,
  estado: 'draft' | 'voting' | 'approved' | 'rejected',
  blockchainId: Number,
  votosAFavor: Number,
  votosEnContra: Number,
  abstenciones: Number,
  votos: [{
    legislador: ObjectId,
    voto: String,
    fecha: Date,
    transactionHash: String
  }]
}
```

## 🔐 Seguridad

- **JWT Tokens** para autenticación
- **Bcrypt** para hash de contraseñas
- **Rate limiting** para prevenir ataques
- **Helmet** para headers de seguridad
- **Validación** de entrada con express-validator
- **CORS** configurado

## 🚦 Flujo de Trabajo

1. **Admin registra legisladores** en la base de datos
2. **Admin registra legisladores** en blockchain
3. **Admin crea sesión** y la registra en blockchain
4. **Admin agrega leyes** a la sesión en blockchain
5. **Legisladores votan** (se registra en blockchain y BD)
6. **Admin finaliza sesión** cuando termine la votación

## 🧪 Pruebas

### Usar con Postman

1. Importar la colección de Postman (si está disponible)
2. Configurar variables de entorno:
   - `baseUrl`: http://localhost:3000
   - `adminToken`: Token del administrador
   - `legisladorToken`: Token del legislador

### Ejemplo de flujo completo

```bash
# 1. Registrar admin
POST /api/auth/registro (con role: admin)

# 2. Login admin
POST /api/auth/login

# 3. Registrar legisladores
POST /api/auth/registro (para cada legislador)

# 4. Registrar legisladores en blockchain
POST /api/legisladores/:id/register-blockchain

# 5. Crear sesión
POST /api/sesiones

# 6. Agregar leyes
POST /api/sesiones/:id/leyes

# 7. Legisladores votan
POST /api/votaciones/votar

# 8. Ver resultados
GET /api/votaciones/resultados/:sesionId/:leyId
```

## 🐛 Solución de Problemas

### Error de conexión a blockchain
- Verificar que Ganache esté corriendo
- Verificar la URL en `BLOCKCHAIN_RPC_URL`
- Verificar que el contrato esté desplegado

### Error de autenticación
- Verificar que el token JWT sea válido
- Verificar que el usuario esté activo

### Error de permisos
- Verificar el rol del usuario
- Verificar que el legislador esté registrado en blockchain

## 📝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Para soporte, crear un issue en GitHub o contactar al equipo de desarrollo.
