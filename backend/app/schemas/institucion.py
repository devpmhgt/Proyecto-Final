from pydantic import BaseModel

from app.schemas.common import ORMModel


class InstitucionIn(BaseModel):
    nombre: str
    siglas: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None
    sitio_web: str | None = None
    rector: str | None = None


class InstitucionOut(ORMModel, InstitucionIn):
    id: int


class ParametroIn(BaseModel):
    clave: str
    valor: str
    descripcion: str | None = None


class ParametroOut(ORMModel, ParametroIn):
    id: int
