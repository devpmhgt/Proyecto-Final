from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Rol
from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioOut"


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str = Field(min_length=2, max_length=150)
    rol: Rol
    activo: bool = True


class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=8)


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    rol: Rol | None = None
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class UsuarioOut(ORMModel, UsuarioBase):
    id: int
    creado_en: datetime | None = None


class CambioPassword(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8)


TokenResponse.model_rebuild()
