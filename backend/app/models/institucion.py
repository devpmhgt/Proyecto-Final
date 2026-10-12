from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Institucion(Base):
    """Datos generales de la universidad (registro único)."""

    __tablename__ = "institucion"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200))
    siglas: Mapped[str | None] = mapped_column(String(20))
    direccion: Mapped[str | None] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    sitio_web: Mapped[str | None] = mapped_column(String(200))
    rector: Mapped[str | None] = mapped_column(String(150))


class ParametroAcademico(Base):
    """Parámetros y reglas generales configurables (nota mínima, créditos máximos, etc.)."""

    __tablename__ = "parametros_academicos"

    id: Mapped[int] = mapped_column(primary_key=True)
    clave: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    valor: Mapped[str] = mapped_column(String(255))
    descripcion: Mapped[str | None] = mapped_column(Text)
