// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotacionLegislatura {
    // Enums para los estados de voto y asistencia
    enum EstadoVoto { AUSENTE, PRESENTE, A_FAVOR, EN_CONTRA, ABSTENCION }
    
    // Estructura para representar una ley
    struct Ley {
        uint256 id;
        string titulo;
        string descripcion;
        uint256 votosAFavor;
        uint256 votosEnContra;
        uint256 abstenciones;
        uint256 ausentes;
        bool activa;
        mapping(address => EstadoVoto) votosLegisladores;
    }
    
    // Estructura para representar una sesión
    struct Sesion {
        uint256 id;
        string fecha;
        string descripcion;
        bool activa;
        Ley[] leyes;
    }
    
    // Variables de estado
    address public administrador;
    mapping(address => bool) public legisladores;
    Sesion[] public sesiones;
    
    // Eventos
    event LegisladorRegistrado(address legislador);
    event LegisladorEliminado(address legislador);
    event SesionCreada(uint256 idSesion, string fecha);
    event LeyAgregada(uint256 idSesion, uint256 idLey, string titulo);
    event VotoRegistrado(uint256 idSesion, uint256 idLey, address legislador, EstadoVoto voto);
    event SesionFinalizada(uint256 idSesion);
    
    // Modificadores
    modifier soloAdministrador() {
        require(msg.sender == administrador, "Solo el administrador puede realizar esta accion");
        _;
    }
    
    modifier soloLegislador() {
        require(legisladores[msg.sender], "Solo los legisladores pueden realizar esta accion");
        _;
    }
    
    modifier sesionActiva(uint256 _idSesion) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        require(sesiones[_idSesion].activa, "Sesion no esta activa");
        _;
    }
    
    // Constructor
    constructor() {
        administrador = msg.sender;
    }
    
    // Funciones administrativas
    function registrarLegislador(address _legislador) public soloAdministrador {
        require(!legisladores[_legislador], "Legislador ya registrado");
        legisladores[_legislador] = true;
        emit LegisladorRegistrado(_legislador);
    }
    
    function eliminarLegislador(address _legislador) public soloAdministrador {
        require(legisladores[_legislador], "Legislador no registrado");
        legisladores[_legislador] = false;
        emit LegisladorEliminado(_legislador);
    }
    
    // Funciones de sesión
    function crearSesion(string memory _fecha, string memory _descripcion) public soloAdministrador {
        uint256 idSesion = sesiones.length;
        sesiones.push(Sesion({
            id: idSesion,
            fecha: _fecha,
            descripcion: _descripcion,
            activa: true,
            leyes: new Ley[](0)
        }));
        emit SesionCreada(idSesion, _fecha);
    }
    
    function agregarLey(
        uint256 _idSesion,
        string memory _titulo,
        string memory _descripcion
    ) public soloAdministrador sesionActiva(_idSesion) {
        Ley storage nuevaLey = sesiones[_idSesion].leyes.push();
        nuevaLey.id = sesiones[_idSesion].leyes.length - 1;
        nuevaLey.titulo = _titulo;
        nuevaLey.descripcion = _descripcion;
        nuevaLey.activa = true;
        
        emit LeyAgregada(_idSesion, nuevaLey.id, _titulo);
    }
    
    // Funciones de votación
    function registrarVoto(
        uint256 _idSesion,
        uint256 _idLey,
        EstadoVoto _estadoVoto
    ) public soloLegislador sesionActiva(_idSesion) {
        require(_idLey < sesiones[_idSesion].leyes.length, "Ley no existe");
        Ley storage ley = sesiones[_idSesion].leyes[_idLey];
        require(ley.activa, "Ley no esta activa");
        
        // Actualizar conteo de votos anteriores
        EstadoVoto votoAnterior = ley.votosLegisladores[msg.sender];
        if (votoAnterior == EstadoVoto.A_FAVOR) ley.votosAFavor--;
        else if (votoAnterior == EstadoVoto.EN_CONTRA) ley.votosEnContra--;
        else if (votoAnterior == EstadoVoto.ABSTENCION) ley.abstenciones--;
        else if (votoAnterior == EstadoVoto.AUSENTE) ley.ausentes--;
        
        // Registrar nuevo voto
        ley.votosLegisladores[msg.sender] = _estadoVoto;
        
        // Actualizar conteo de nuevos votos
        if (_estadoVoto == EstadoVoto.A_FAVOR) ley.votosAFavor++;
        else if (_estadoVoto == EstadoVoto.EN_CONTRA) ley.votosEnContra++;
        else if (_estadoVoto == EstadoVoto.ABSTENCION) ley.abstenciones++;
        else if (_estadoVoto == EstadoVoto.AUSENTE) ley.ausentes++;
        
        emit VotoRegistrado(_idSesion, _idLey, msg.sender, _estadoVoto);
    }
    
    function finalizarSesion(uint256 _idSesion) public soloAdministrador sesionActiva(_idSesion) {
        sesiones[_idSesion].activa = false;
        emit SesionFinalizada(_idSesion);
    }
    
    // Funciones de consulta
    function obtenerResultadosLey(uint256 _idSesion, uint256 _idLey) public view returns (
        uint256 votosAFavor,
        uint256 votosEnContra,
        uint256 abstenciones,
        uint256 ausentes
    ) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        require(_idLey < sesiones[_idSesion].leyes.length, "Ley no existe");
        
        Ley storage ley = sesiones[_idSesion].leyes[_idLey];
        return (
            ley.votosAFavor,
            ley.votosEnContra,
            ley.abstenciones,
            ley.ausentes
        );
    }
    
    function obtenerVotoLegislador(
        uint256 _idSesion,
        uint256 _idLey,
        address _legislador
    ) public view returns (EstadoVoto) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        require(_idLey < sesiones[_idSesion].leyes.length, "Ley no existe");
        return sesiones[_idSesion].leyes[_idLey].votosLegisladores[_legislador];
    }
    
    function obtenerCantidadSesiones() public view returns (uint256) {
        return sesiones.length;
    }
    
    function obtenerCantidadLeyes(uint256 _idSesion) public view returns (uint256) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        return sesiones[_idSesion].leyes.length;
    }
} 