import enum


class Rol(str, enum.Enum):
    ADMIN = "admin"
    COORDINADOR = "coordinador"
    DOCENTE = "docente"
    ESTUDIANTE = "estudiante"


class EstadoEstudiante(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    SUSPENDIDO = "suspendido"
    EGRESADO = "egresado"
    GRADUADO = "graduado"


class EstadoDocente(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    LICENCIA = "licencia"


class EstadoPeriodo(str, enum.Enum):
    PLANIFICACION = "planificacion"
    INSCRIPCION = "inscripcion"
    EN_CURSO = "en_curso"
    CERRADO = "cerrado"


class EstadoInscripcion(str, enum.Enum):
    INSCRITO = "inscrito"
    RETIRADO = "retirado"
    APROBADO = "aprobado"
    REPROBADO = "reprobado"
