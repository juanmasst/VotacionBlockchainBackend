const { Web3 } = require('web3');
const contractABI = require('../contracts/VotacionLegislatura.json');

class BlockchainService {
  constructor() {
    this.web3 = new Web3(process.env.BLOCKCHAIN_RPC_URL);
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    
    if (this.contractAddress) {
      this.contract = new this.web3.eth.Contract(contractABI.abi, this.contractAddress);
    }
    
    // Cuenta del administrador
    if (this.adminPrivateKey) {
      this.adminAccount = this.web3.eth.accounts.privateKeyToAccount('0x' + this.adminPrivateKey);
      this.web3.eth.accounts.wallet.add(this.adminAccount);
    }
  }

  // Inicializar el contrato después de deployment
  initializeContract(contractAddress) {
    this.contractAddress = contractAddress;
    this.contract = new this.web3.eth.Contract(contractABI.abi, contractAddress);
  }

  // Funciones administrativas
  async registrarLegislador(direccionLegislador) {
    try {
      if (!this.contract || !this.adminAccount) {
        throw new Error('Contrato o cuenta de administrador no inicializados');
      }

      const transaction = this.contract.methods.registrarLegislador(direccionLegislador);
      const gas = await transaction.estimateGas({ from: this.adminAccount.address });
      
      const result = await transaction.send({
        from: this.adminAccount.address,
        gas: Math.floor(gas * 1.2) // 20% extra de gas por seguridad
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      console.error('Error registrando legislador:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  async eliminarLegislador(direccionLegislador) {
    try {
      const transaction = this.contract.methods.eliminarLegislador(direccionLegislador);
      const gas = await transaction.estimateGas({ from: this.adminAccount.address });
      
      const result = await transaction.send({
        from: this.adminAccount.address,
        gas: Math.floor(gas * 1.2)
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      console.error('Error eliminando legislador:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  // Funciones de sesión
  async crearSesion(fecha, descripcion) {
    try {
      const transaction = this.contract.methods.crearSesion(fecha, descripcion);
      const gas = await transaction.estimateGas({ from: this.adminAccount.address });
      
      const result = await transaction.send({
        from: this.adminAccount.address,
        gas: Math.floor(gas * 1.2)
      });

      // Obtener el ID de la sesión del evento
      const sesionCreatedEvent = result.events.SesionCreada;
      const sesionId = sesionCreatedEvent ? sesionCreatedEvent.returnValues.idSesion : null;

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        sesionId: parseInt(sesionId)
      };
    } catch (error) {
      console.error('Error creando sesión:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  async agregarLey(idSesion, titulo, descripcion) {
    try {
      const transaction = this.contract.methods.agregarLey(idSesion, titulo, descripcion);
      const gas = await transaction.estimateGas({ from: this.adminAccount.address });
      
      const result = await transaction.send({
        from: this.adminAccount.address,
        gas: Math.floor(gas * 1.2)
      });

      // Obtener el ID de la ley del evento
      const leyAgregadaEvent = result.events.LeyAgregada;
      const leyId = leyAgregadaEvent ? leyAgregadaEvent.returnValues.idLey : null;

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        leyId: parseInt(leyId)
      };
    } catch (error) {
      console.error('Error agregando ley:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  // Funciones de votación
  async registrarVoto(idSesion, idLey, estadoVoto, privateKeyLegislador) {
    try {
      // Crear cuenta temporal para el legislador
      const legisladorAccount = this.web3.eth.accounts.privateKeyToAccount('0x' + privateKeyLegislador);
      
      const transaction = this.contract.methods.registrarVoto(idSesion, idLey, estadoVoto);
      const gas = await transaction.estimateGas({ from: legisladorAccount.address });
      
      // Firmar y enviar transacción
      const signedTx = await legisladorAccount.signTransaction({
        to: this.contractAddress,
        data: transaction.encodeABI(),
        gas: Math.floor(gas * 1.2),
        gasPrice: await this.web3.eth.getGasPrice()
      });

      const result = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      console.error('Error registrando voto:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  async finalizarSesion(idSesion) {
    try {
      const transaction = this.contract.methods.finalizarSesion(idSesion);
      const gas = await transaction.estimateGas({ from: this.adminAccount.address });
      
      const result = await transaction.send({
        from: this.adminAccount.address,
        gas: Math.floor(gas * 1.2)
      });

      return {
        success: true,
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed
      };
    } catch (error) {
      console.error('Error finalizando sesión:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  // Funciones de consulta
  async verificarLegislador(direccion) {
    try {
      const esLegislador = await this.contract.methods.legisladores(direccion).call();
      return esLegislador;
    } catch (error) {
      console.error('Error verificando legislador:', error);
      return false;
    }
  }

  async obtenerResultadosLey(idSesion, idLey) {
    try {
      const resultados = await this.contract.methods.obtenerResultadosLey(idSesion, idLey).call();
      return {
        votosAFavor: parseInt(resultados.votosAFavor),
        votosEnContra: parseInt(resultados.votosEnContra),
        abstenciones: parseInt(resultados.abstenciones),
        ausentes: parseInt(resultados.ausentes)
      };
    } catch (error) {
      console.error('Error obteniendo resultados:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  async obtenerVotoLegislador(idSesion, idLey, direccionLegislador) {
    try {
      const voto = await this.contract.methods.obtenerVotoLegislador(idSesion, idLey, direccionLegislador).call();
      return parseInt(voto);
    } catch (error) {
      console.error('Error obteniendo voto:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  async obtenerCantidadSesiones() {
    try {
      const cantidad = await this.contract.methods.obtenerCantidadSesiones().call();
      return parseInt(cantidad);
    } catch (error) {
      console.error('Error obteniendo cantidad de sesiones:', error);
      return 0;
    }
  }

  async obtenerCantidadLeyes(idSesion) {
    try {
      const cantidad = await this.contract.methods.obtenerCantidadLeyes(idSesion).call();
      return parseInt(cantidad);
    } catch (error) {
      console.error('Error obteniendo cantidad de leyes:', error);
      return 0;
    }
  }

  async obtenerLey(idSesion, idLey) {
    try {
      const ley = await this.contract.methods.obtenerLey(idSesion, idLey).call();
      return {
        id: parseInt(ley.id),
        titulo: ley.titulo,
        descripcion: ley.descripcion,
        activa: ley.activa
      };
    } catch (error) {
      console.error('Error obteniendo ley:', error);
      throw new Error(`Error en blockchain: ${error.message}`);
    }
  }

  // Utilidades
  mapearEstadoVoto(estadoString) {
    const estados = {
      'AUSENTE': 0,
      'PRESENTE': 1,
      'A_FAVOR': 2,
      'EN_CONTRA': 3,
      'ABSTENCION': 4
    };
    return estados[estadoString] !== undefined ? estados[estadoString] : 0;
  }

  mapearEstadoVotoInverso(estadoNumero) {
    const estados = ['AUSENTE', 'PRESENTE', 'A_FAVOR', 'EN_CONTRA', 'ABSTENCION'];
    return estados[estadoNumero] || 'AUSENTE';
  }

  // Verificar conexión
  async verificarConexion() {
    try {
      const blockNumber = await this.web3.eth.getBlockNumber();
      return {
        connected: true,
        blockNumber: blockNumber,
        network: await this.web3.eth.net.getId()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = new BlockchainService(); 