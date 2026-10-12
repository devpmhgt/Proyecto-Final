from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import EstadoInscripcion
from app.models.oferta import Seccion
from app.models.personas import Estudiante


class Inscripcion(Base):
    __tablename__ = "inscripciones"
    __table_args__ = (UniqueConstraint("estudiante_id", "seccion_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    estudiante_id: Mapped[int] = mapped_column(ForeignKey("estudiantes.id"))
    seccion_id: Mapped[int] = mapped_column(ForeignKey("secciones.id"))
    estado: Mapped[EstadoInscripcion] = mapped_column(
        Enum(EstadoInscripcion, values_callable=lambda e: [x.value for x in e]),
        default=EstadoInscripcion.INSCRITO,
    )
    fecha_inscripcion: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    fecha_retiro: Mapped[datetime | None] = mapped_column(DateTime)
    nota_final: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    estudiante: Mapped[Estudiante] = relationship()
    seccion: Mapped[Seccion] = relationship()
    calificaciones: Mapped[list["Calificacion"]] = relationship(
        back_populates="inscripcion", cascade="all, delete-orphan"
    )


class Evaluacion(Base):
    """Componente evaluativo de una sección con su ponderación (porcentaje)."""

    __tablename__ = "evaluaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    seccion_id: Mapped[int] = mapped_column(ForeignKey("secciones.id", ondelete="CASCADE"))
    nombre: Mapped[str] = mapped_column(String(100))
    ponderacion: Mapped[Decimal] = mapped_column(Numeric(5, 2))


class Calificacion(Base):
    __tablename__ = "calificaciones"
    __table_args__ = (UniqueConstraint("inscripcion_id", "evaluacion_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    inscripcion_id: Mapped[int] = mapped_column(ForeignKey("inscripciones.id", ondelete="CASCADE"))
    evaluacion_id: Mapped[int] = mapped_column(ForeignKey("evaluaciones.id", ondelete="CASCADE"))
    nota: Mapped[Decimal] = mapped_column(Numeric(5, 2))

    inscripcion: Mapped[Inscripcion] = relationship(back_populates="calificaciones")
    evaluacion: Mapped[Evaluacion] = relationship()
