from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

prerrequisitos = Table(
    "prerrequisitos",
    Base.metadata,
    Column("curso_id", ForeignKey("cursos.id", ondelete="CASCADE"), primary_key=True),
    Column("prerrequisito_id", ForeignKey("cursos.id", ondelete="CASCADE"), primary_key=True),
)


class Carrera(Base):
    __tablename__ = "carreras"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(150))
    facultad: Mapped[str | None] = mapped_column(String(150))
    activa: Mapped[bool] = mapped_column(Boolean, default=True)

    planes: Mapped[list["PlanEstudio"]] = relationship(back_populates="carrera")


class Curso(Base):
    __tablename__ = "cursos"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    nombre: Mapped[str] = mapped_column(String(150))
    creditos: Mapped[int] = mapped_column(Integer)
    horas_semana: Mapped[int] = mapped_column(Integer, default=4)
    descripcion: Mapped[str | None] = mapped_column(Text)

    prerrequisitos: Mapped[list["Curso"]] = relationship(
        secondary=prerrequisitos,
        primaryjoin=lambda: Curso.id == prerrequisitos.c.curso_id,
        secondaryjoin=lambda: Curso.id == prerrequisitos.c.prerrequisito_id,
    )


class PlanEstudio(Base):
    __tablename__ = "planes_estudio"

    id: Mapped[int] = mapped_column(primary_key=True)
    carrera_id: Mapped[int] = mapped_column(ForeignKey("carreras.id"))
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(150))
    anio: Mapped[int] = mapped_column(Integer)
    vigente: Mapped[bool] = mapped_column(Boolean, default=True)

    carrera: Mapped[Carrera] = relationship(back_populates="planes")
    cursos: Mapped[list["PlanCurso"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanCurso(Base):
    """Curso asignado a un plan de estudios en un semestre determinado."""

    __tablename__ = "plan_cursos"
    __table_args__ = (UniqueConstraint("plan_id", "curso_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("planes_estudio.id", ondelete="CASCADE"))
    curso_id: Mapped[int] = mapped_column(ForeignKey("cursos.id"))
    semestre: Mapped[int] = mapped_column(Integer)

    plan: Mapped[PlanEstudio] = relationship(back_populates="cursos")
    curso: Mapped[Curso] = relationship()
