from datetime import date, time
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import EstadoDocente, EstadoEstudiante
from app.schemas.common import ORMModel


class EstudianteIn(BaseModel):
    carnet: str
    nombres: str
    apellidos: str
    email: EmailStr
    telefono: str | None = None
    fecha_nacimiento: date | None = None
    carrera_id: int
    plan_id: int | None = None
    estado: EstadoEstudiante = EstadoEstudiante.ACTIVO
    fecha_ingreso: date | None = None
    # Si se envía, se crea una cuenta de acceso con rol estudiante
    password: str | None = Field(default=None, min_length=8)


class EstudianteUpdate(BaseModel):
    nombres: str | None = None
    apellidos: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    fecha_nacimiento: date | None = None
    carrera_id: int | None = None
    plan_id: int | None = None
    estado: EstadoEstudiante | None = None
    # Crea la cuenta de acceso si no tiene, o restablece su contraseña
    password: str | None = Field(default=None, min_length=8)


class EstudianteOut(ORMModel):
    id: int
    usuario_id: int | None
    carnet: str
    nombres: str
    apellidos: str
    email: str
    telefono: str | None
    fecha_nacimiento: date | None
    carrera_id: int
    plan_id: int | None
    estado: EstadoEstudiante
    fecha_ingreso: date | None


class DisponibilidadIn(BaseModel):
    dia: int = Field(ge=1, le=7)
    hora_inicio: time
    hora_fin: time

    @model_validator(mode="after")
    def _rango(self):
        if self.hora_fin <= self.hora_inicio:
            raise ValueError("hora_fin debe ser mayor que hora_inicio")
        return self


class DisponibilidadOut(ORMModel, DisponibilidadIn):
    id: int


class DocenteIn(BaseModel):
    codigo: str
    nombres: str
    apellidos: str
    email: EmailStr
    telefono: str | None = None
    especialidad: str | None = None
    max_horas_semana: int = Field(default=20, ge=1, le=60)
    estado: EstadoDocente = EstadoDocente.ACTIVO
    password: str | None = Field(default=None, min_length=8)


class DocenteUpdate(BaseModel):
    nombres: str | None = None
    apellidos: str | None = None
    email: EmailStr | None = None
    telefono: str | None = None
    especialidad: str | None = None
    max_horas_semana: int | None = None
    estado: EstadoDocente | None = None
    # Crea la cuenta de acceso si no tiene, o restablece su contraseña
    password: str | None = Field(default=None, min_length=8)


class DocenteOut(ORMModel):
    id: int
    usuario_id: int | None
    codigo: str
    nombres: str
    apellidos: str
    email: str
    telefono: str | None
    especialidad: str | None
    max_horas_semana: int
    estado: EstadoDocente
    disponibilidad: list[DisponibilidadOut] = []


class PrerrequisitoAvance(BaseModel):
    id: int
    codigo: str
    nombre: str


class CursoAvance(BaseModel):
    id: int
    codigo: str
    nombre: str
    creditos: int
    semestre: int
    estado: str  # aprobado | en_curso | disponible | bloqueado
    nota: Decimal | None
    intentos_reprobados: int
    prerrequisitos: list[PrerrequisitoAvance]
    creditos_requeridos: int | None
    faltantes: list[str]
    creditos_faltantes: int
    desbloquea: list[int]


class CicloAvance(BaseModel):
    semestre: int
    cursos: list[CursoAvance]


class PlanResumen(BaseModel):
    id: int
    codigo: str
    nombre: str


class Avance(BaseModel):
    estudiante: dict
    carrera: str
    plan: PlanResumen | None
    creditos_aprobados: int
    creditos_aprobados_total: int
    creditos_totales: int
    porcentaje: float
    promedio: Decimal | None
    cursos_aprobados: int
    cursos_totales: int
    en_curso: int
    disponibles: int
    ciclos: list[CicloAvance]


class VincularCuenta(BaseModel):
    usuario_id: int
