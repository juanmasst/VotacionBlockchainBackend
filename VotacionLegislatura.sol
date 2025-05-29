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
    }
    
    // Estructura para representar una sesión
    struct Sesion {
        uint256 id;
        string fecha;
        string descripcion;
        bool activa;
        uint256[] leyesIds; // Array de IDs de leyes en lugar de array de Ley
    }
    
    // Variables de estado
    address public administrador;
    mapping(address => bool) public legisladores;
    Sesion[] public sesiones;
    
    // Mappings para almacenar las leyes y votos
    mapping(uint256 => mapping(uint256 => Ley)) public leyes; // sesionId => leyId => Ley
    mapping(uint256 => mapping(uint256 => mapping(address => EstadoVoto))) public votosLegisladores; // sesionId => leyId => legislador => voto
    
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
            leyesIds: new uint256[](0)
        }));
        emit SesionCreada(idSesion, _fecha);
    }
    
    function agregarLey(
        uint256 _idSesion,
        string memory _titulo,
        string memory _descripcion
    ) public soloAdministrador sesionActiva(_idSesion) {
        uint256 idLey = sesiones[_idSesion].leyesIds.length;
        
        leyes[_idSesion][idLey] = Ley({
            id: idLey,
            titulo: _titulo,
            descripcion: _descripcion,
            votosAFavor: 0,
            votosEnContra: 0,
            abstenciones: 0,
            ausentes: 0,
            activa: true
        });
        
        sesiones[_idSesion].leyesIds.push(idLey);
        emit LeyAgregada(_idSesion, idLey, _titulo);
    }
    
    // Funciones de votación
    function registrarVoto(
        uint256 _idSesion,
        uint256 _idLey,
        EstadoVoto _estadoVoto
    ) public soloLegislador sesionActiva(_idSesion) {
        // Verificación de que el legislador está registrado (aunque ya está en el modificador, lo dejamos explícito)
        require(legisladores[msg.sender], "Error: La cuenta no esta registrada como legislador");
        
        // Verificación de que la sesión existe
        require(_idSesion < sesiones.length, "Error: La sesion no existe");
        
        // Verificación de que la sesión está activa (aunque ya está en el modificador, lo dejamos explícito)
        require(sesiones[_idSesion].activa, "Error: La sesion no esta activa");
        
        // Verificación de que la ley existe en la sesión
        require(_idLey < sesiones[_idSesion].leyesIds.length, "Error: La ley no existe en esta sesion");
        
        // Verificación de que la ley está activa
        Ley storage ley = leyes[_idSesion][_idLey];
        require(ley.activa, "Error: La ley no esta activa");
        
        // Verificación de que el estado de voto es válido
        require(
            _estadoVoto == EstadoVoto.A_FAVOR || 
            _estadoVoto == EstadoVoto.EN_CONTRA || 
            _estadoVoto == EstadoVoto.ABSTENCION || 
            _estadoVoto == EstadoVoto.AUSENTE || 
            _estadoVoto == EstadoVoto.PRESENTE,
            "Error: Estado de voto invalido"
        );
        
        // Obtener el voto anterior
        EstadoVoto votoAnterior = votosLegisladores[_idSesion][_idLey][msg.sender];
        
        // Verificar si el legislador ya había votado antes
        bool yaHabiaVotado = (
            votoAnterior == EstadoVoto.A_FAVOR || 
            votoAnterior == EstadoVoto.EN_CONTRA || 
            votoAnterior == EstadoVoto.ABSTENCION ||
            votoAnterior == EstadoVoto.PRESENTE
        );
        
        // Solo actualizar conteo de votos anteriores si ya había votado antes
        if (yaHabiaVotado) {
            if (votoAnterior == EstadoVoto.A_FAVOR) {
                require(ley.votosAFavor > 0, "Error: Contador de votos a favor inconsistente");
                ley.votosAFavor--;
            }
            else if (votoAnterior == EstadoVoto.EN_CONTRA) {
                require(ley.votosEnContra > 0, "Error: Contador de votos en contra inconsistente");
                ley.votosEnContra--;
            }
            else if (votoAnterior == EstadoVoto.ABSTENCION) {
                require(ley.abstenciones > 0, "Error: Contador de abstenciones inconsistente");
                ley.abstenciones--;
            }
            else if (votoAnterior == EstadoVoto.PRESENTE) {
                // PRESENTE no afecta ningún contador de resultados, solo registra asistencia
            }
        }
        
        // Registrar nuevo voto
        votosLegisladores[_idSesion][_idLey][msg.sender] = _estadoVoto;
        
        // Actualizar conteo de nuevos votos
        if (_estadoVoto == EstadoVoto.A_FAVOR) ley.votosAFavor++;
        else if (_estadoVoto == EstadoVoto.EN_CONTRA) ley.votosEnContra++;
        else if (_estadoVoto == EstadoVoto.ABSTENCION) ley.abstenciones++;
        else if (_estadoVoto == EstadoVoto.AUSENTE) ley.ausentes++;
        // PRESENTE no afecta ningún contador de resultados
        
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
        require(_idLey < sesiones[_idSesion].leyesIds.length, "Ley no existe");
        
        Ley storage ley = leyes[_idSesion][_idLey];
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
        require(_idLey < sesiones[_idSesion].leyesIds.length, "Ley no existe");
        return votosLegisladores[_idSesion][_idLey][_legislador];
    }
    
    function obtenerCantidadSesiones() public view returns (uint256) {
        return sesiones.length;
    }
    
    function obtenerCantidadLeyes(uint256 _idSesion) public view returns (uint256) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        return sesiones[_idSesion].leyesIds.length;
    }
    
    function obtenerLey(uint256 _idSesion, uint256 _idLey) public view returns (
        uint256 id,
        string memory titulo,
        string memory descripcion,
        bool activa
    ) {
        require(_idSesion < sesiones.length, "Sesion no existe");
        require(_idLey < sesiones[_idSesion].leyesIds.length, "Ley no existe");
        Ley storage ley = leyes[_idSesion][_idLey];
        return (ley.id, ley.titulo, ley.descripcion, ley.activa);
    }
} 