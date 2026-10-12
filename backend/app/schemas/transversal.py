from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class AuditoriaOut(ORMModel):
    id: int
    usuario_id: int | None
    accion: str
    entidad: str
    entidad_id: int | None
    detalle: str | None
    fecha: datetime


class NotificacionIn(BaseModel):
    usuario_id: int
    titulo: str
    mensaje: str


class NotificacionOut(ORMModel):
    id: int
    titulo: str
    mensaje: str
    leida: bool
    fecha: datetime


class Indicadores(BaseModel):
    estudiantes_activos: int
    docentes_activos: int
    carreras: int
    cursos: int
    periodo_actual: str | None
    secciones_periodo: int
    inscripciones_periodo: int
    ocupacion_promedio: float
    tasa_aprobacion: float | None
    estudiantes_por_carrera: list[dict]
    estudiantes_por_estado: list[dict]
