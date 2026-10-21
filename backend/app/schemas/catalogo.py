from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CarreraIn(BaseModel):
    codigo: str
    nombre: str
    facultad: str | None = None
    activa: bool = True


class CarreraOut(ORMModel, CarreraIn):
    id: int


class CursoIn(BaseModel):
    codigo: str
    nombre: str
    creditos: int = Field(ge=0, le=20)
    horas_semana: int = Field(default=4, ge=0, le=40)
    descripcion: str | None = None
    creditos_requeridos: int | None = Field(default=None, ge=0)
    prerrequisito_ids: list[int] = []


class CursoResumen(ORMModel):
    id: int
    codigo: str
    nombre: str
    creditos: int


class CursoOut(ORMModel):
    id: int
    codigo: str
    nombre: str
    creditos: int
    horas_semana: int
    descripcion: str | None
    creditos_requeridos: int | None = None
    prerrequisitos: list[CursoResumen] = []


class PlanCursoIn(BaseModel):
    curso_id: int
    semestre: int = Field(ge=1, le=20)


class PlanCursoOut(ORMModel):
    id: int
    semestre: int
    curso: CursoResumen


class PlanIn(BaseModel):
    carrera_id: int
    codigo: str
    nombre: str
    anio: int
    vigente: bool = True


class PlanOut(ORMModel, PlanIn):
    id: int
    cursos: list[PlanCursoOut] = []


class FilaPensumOut(BaseModel):
    linea: int
    ciclo: str
    semestre: int
    codigo: str
    nombre: str
    creditos: int
    prerrequisitos: list[str]
    creditos_requeridos: int | None
    accion: str


class ImportacionPensumOut(BaseModel):
    cursos: list[FilaPensumOut]
    errores: list[str]
    advertencias: list[str]
    total_creditos: int
    ciclos: int
    guardado: bool
    plan_id: int | None = None
