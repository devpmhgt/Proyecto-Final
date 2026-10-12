from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Docente, Estudiante, Rol, Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

DB = Annotated[Session, Depends(get_db)]


def get_current_user(db: DB, token: Annotated[str, Depends(oauth2_scheme)]) -> Usuario:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o sesión expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credenciales_invalidas
    usuario = db.get(Usuario, user_id)
    if usuario is None or not usuario.activo:
        raise credenciales_invalidas
    return usuario


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def require_roles(*roles: Rol):
    """Dependencia RBAC: permite el acceso solo a los roles indicados."""

    def checker(usuario: CurrentUser) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tiene permisos para esta operación")
        return usuario

    return checker


ADMIN = (Rol.ADMIN,)
GESTION = (Rol.ADMIN, Rol.COORDINADOR)
PERSONAL = (Rol.ADMIN, Rol.COORDINADOR, Rol.DOCENTE)

AdminUser = Annotated[Usuario, Depends(require_roles(*ADMIN))]
GestionUser = Annotated[Usuario, Depends(require_roles(*GESTION))]
PersonalUser = Annotated[Usuario, Depends(require_roles(*PERSONAL))]


def estudiante_de(db: Session, usuario: Usuario) -> Estudiante | None:
    return db.query(Estudiante).filter(Estudiante.usuario_id == usuario.id).first()


def docente_de(db: Session, usuario: Usuario) -> Docente | None:
    return db.query(Docente).filter(Docente.usuario_id == usuario.id).first()


def get_or_404(db: Session, model, obj_id: int):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} {obj_id} no encontrado")
    return obj
