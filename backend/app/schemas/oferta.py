from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.models.enums import EstadoPeriodo
from app.schemas.catalogo import CursoResumen
from app.schemas.common import ORMModel


class PeriodoIn(BaseModel):
    codigo: str
    nombre: str
    fecha_inicio: date
    fecha_fin: date
    fecha_limite_retiro: date | None = None
    estado: EstadoPeriodo = EstadoPeriodo.PLANIFICACION

    @model_validator(mode="after")
    def _fechas(self):
        if self.fecha_fin <= self.fecha_inicio:
            raise ValueError("fecha_fin debe ser posterior a fecha_inicio")
        if self.fecha_limite_retiro and not self.fecha_inicio <= self.fecha_limite_retiro <= self.fecha_fin:
            raise ValueError("la fecha límite de retiro debe estar entre el inicio y el fin del periodo")
        return self


class PeriodoOut(ORMModel, PeriodoIn):
    id: int


class AulaIn(BaseModel):
    codigo: str
    edificio: str | None = None
    capacidad: int = Field(ge=1)
    tipo: str = "teorica"
    activa: bool = True


class AulaOut(ORMModel, AulaIn):
    id: int


class HorarioIn(BaseModel):
    aula_id: int
    dia: int = Field(ge=1, le=7)
    hora_inicio: time
    hora_fin: time

    @model_validator(mode="after")
    def _rango(self):
        if self.hora_fin <= self.hora_inicio:
            raise ValueError("hora_fin debe ser mayor que hora_inicio")
        return self


class HorarioOut(ORMModel):
    id: int
    aula_id: int
    dia: int
    hora_inicio: time
    hora_fin: time
    aula: AulaOut


class SeccionIn(BaseModel):
    periodo_id: int
    curso_id: int
    docente_id: int | None = None
    codigo: str
    cupo: int = Field(ge=1)


class SeccionUpdate(BaseModel):
    docente_id: int | None = None
    cupo: int | None = Field(default=None, ge=1)


class DocenteResumen(ORMModel):
    id: int
    nombres: str
    apellidos: str


class SeccionOut(ORMModel):
    id: int
    periodo_id: int
    codigo: str
    cupo: int
    acta_cerrada: bool
    inscritos: int = 0
    curso: CursoResumen
    docente: DocenteResumen | None
    horarios: list[HorarioOut] = []
