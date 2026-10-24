from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import EstadoInscripcion
from app.schemas.common import FechaHora, ORMModel
from app.schemas.oferta import SeccionOut


class InscripcionIn(BaseModel):
    seccion_id: int
    # Solo administradores/coordinadores pueden indicar el estudiante; un estudiante se inscribe a sí mismo
    estudiante_id: int | None = None


class EstudianteResumen(ORMModel):
    id: int
    carnet: str
    nombres: str
    apellidos: str


class InscripcionOut(ORMModel):
    id: int
    estado: EstadoInscripcion
    fecha_inscripcion: FechaHora | None
    fecha_retiro: FechaHora | None
    nota_final: Decimal | None
    estudiante: EstudianteResumen
    seccion: SeccionOut


class EvaluacionIn(BaseModel):
    nombre: str
    ponderacion: Decimal = Field(gt=0, le=100)


class EvaluacionOut(ORMModel, EvaluacionIn):
    id: int
    seccion_id: int


class NotaIn(BaseModel):
    inscripcion_id: int
    evaluacion_id: int
    nota: Decimal = Field(ge=0, le=100)


class NotasLote(BaseModel):
    notas: list[NotaIn]


class CalificacionOut(ORMModel):
    id: int
    inscripcion_id: int
    evaluacion_id: int
    nota: Decimal


class FilaActa(BaseModel):
    inscripcion_id: int
    estudiante: EstudianteResumen
    estado: EstadoInscripcion
    notas: dict[int, Decimal]
    nota_acumulada: Decimal
    nota_final: Decimal | None


class Acta(BaseModel):
    seccion_id: int
    acta_cerrada: bool
    evaluaciones: list[EvaluacionOut]
    filas: list[FilaActa]
