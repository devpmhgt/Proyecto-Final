from datetime import date, time

from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.catalogo import Carrera, PlanEstudio
from app.models.enums import EstadoDocente, EstadoEstudiante
from app.models.usuario import Usuario

_values = lambda e: [x.value for x in e]  # noqa: E731


class Estudiante(Base):
    __tablename__ = "estudiantes"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    carnet: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombres: Mapped[str] = mapped_column(String(100))
    apellidos: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    telefono: Mapped[str | None] = mapped_column(String(30))
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date)
    carrera_id: Mapped[int] = mapped_column(ForeignKey("carreras.id"))
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("planes_estudio.id"))
    estado: Mapped[EstadoEstudiante] = mapped_column(
        Enum(EstadoEstudiante, values_callable=_values), default=EstadoEstudiante.ACTIVO
    )
    fecha_ingreso: Mapped[date | None] = mapped_column(Date)

    usuario: Mapped[Usuario | None] = relationship()
    carrera: Mapped[Carrera] = relationship()
    plan: Mapped[PlanEstudio | None] = relationship()


class Docente(Base):
    __tablename__ = "docentes"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nombres: Mapped[str] = mapped_column(String(100))
    apellidos: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), unique=True)
    telefono: Mapped[str | None] = mapped_column(String(30))
    especialidad: Mapped[str | None] = mapped_column(String(150))
    max_horas_semana: Mapped[int] = mapped_column(Integer, default=20)
    estado: Mapped[EstadoDocente] = mapped_column(
        Enum(EstadoDocente, values_callable=_values), default=EstadoDocente.ACTIVO
    )

    usuario: Mapped[Usuario | None] = relationship()
    disponibilidad: Mapped[list["DisponibilidadDocente"]] = relationship(
        back_populates="docente", cascade="all, delete-orphan"
    )


class DisponibilidadDocente(Base):
    """Franja horaria en la que un docente puede impartir clases. dia: 1=lunes ... 7=domingo."""

    __tablename__ = "disponibilidad_docente"

    id: Mapped[int] = mapped_column(primary_key=True)
    docente_id: Mapped[int] = mapped_column(ForeignKey("docentes.id", ondelete="CASCADE"))
    dia: Mapped[int] = mapped_column(Integer)
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fin: Mapped[time] = mapped_column(Time)

    docente: Mapped[Docente] = relationship(back_populates="disponibilidad")
