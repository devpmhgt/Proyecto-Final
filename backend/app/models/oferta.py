from datetime import date, time

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.catalogo import Curso
from app.models.enums import EstadoPeriodo
from app.models.personas import Docente


class Periodo(Base):
    __tablename__ = "periodos"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(100))
    fecha_inicio: Mapped[date] = mapped_column(Date)
    fecha_fin: Mapped[date] = mapped_column(Date)
    fecha_limite_retiro: Mapped[date | None] = mapped_column(Date)
    estado: Mapped[EstadoPeriodo] = mapped_column(
        Enum(EstadoPeriodo, values_callable=lambda e: [x.value for x in e]),
        default=EstadoPeriodo.PLANIFICACION,
    )


class Aula(Base):
    __tablename__ = "aulas"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    edificio: Mapped[str | None] = mapped_column(String(100))
    capacidad: Mapped[int] = mapped_column(Integer)
    tipo: Mapped[str] = mapped_column(String(30), default="teorica")
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class Seccion(Base):
    __tablename__ = "secciones"
    __table_args__ = (UniqueConstraint("periodo_id", "curso_id", "codigo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    periodo_id: Mapped[int] = mapped_column(ForeignKey("periodos.id"))
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    docente_id: Mapped[int | None] = mapped_column(ForeignKey("docentes.id"))
    codigo: Mapped[str] = mapped_column(String(10))
    cupo: Mapped[int] = mapped_column(Integer)
    acta_cerrada: Mapped[bool] = mapped_column(Boolean, default=False)

    periodo: Mapped[Periodo] = relationship()
    curso: Mapped[Curso] = relationship()
    docente: Mapped[Docente | None] = relationship()
    horarios: Mapped[list["Horario"]] = relationship(back_populates="seccion", cascade="all, delete-orphan")


class Horario(Base):
    """Bloque de clase de una sección. dia: 1=lunes ... 7=domingo."""

    __tablename__ = "horarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    seccion_id: Mapped[int] = mapped_column(ForeignKey("secciones.id", ondelete="CASCADE"))
    aula_id: Mapped[int] = mapped_column(ForeignKey("aulas.id"))
    dia: Mapped[int] = mapped_column(Integer)
    hora_inicio: Mapped[time] = mapped_column(Time)
    hora_fin: Mapped[time] = mapped_column(Time)

    seccion: Mapped[Seccion] = relationship(back_populates="horarios")
    aula: Mapped[Aula] = relationship()
