from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import DB, AdminUser, CurrentUser, get_or_404
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Usuario
from app.schemas.auth import CambioPassword, LoginRequest, TokenResponse, UsuarioCreate, UsuarioOut, UsuarioUpdate
from app.services.transversal import auditar

router = APIRouter(tags=["1-2. Autenticación y usuarios"])


def _autenticar(db, email: str, password: str) -> TokenResponse:
    usuario = db.query(Usuario).filter(Usuario.email == email.lower()).first()
    if usuario is None or not verify_password(password, usuario.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    if not usuario.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "La cuenta está desactivada")
    auditar(db, usuario, "login", "usuario", usuario.id)
    db.commit()
    token = create_access_token(usuario.id, usuario.rol.value)
    return TokenResponse(access_token=token, usuario=UsuarioOut.model_validate(usuario))


@router.post("/auth/login", response_model=TokenResponse)
def login(datos: LoginRequest, db: DB):
    return _autenticar(db, datos.email, datos.password)


@router.post("/auth/token", response_model=TokenResponse, include_in_schema=False)
def token_oauth2(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    """Endpoint compatible con OAuth2 para el botón 'Authorize' de Swagger."""
    return _autenticar(db, form.username, form.password)


@router.get("/auth/me", response_model=UsuarioOut)
def me(usuario: CurrentUser):
    return usuario


@router.post("/auth/cambiar-password", status_code=204)
def cambiar_password(datos: CambioPassword, usuario: CurrentUser, db: DB):
    if not verify_password(datos.password_actual, usuario.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta")
    usuario.hashed_password = hash_password(datos.password_nueva)
    auditar(db, usuario, "cambiar_password", "usuario", usuario.id)
    db.commit()


@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(db: DB, _: AdminUser):
    return db.query(Usuario).order_by(Usuario.nombre).all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=201)
def crear_usuario(datos: UsuarioCreate, db: DB, admin: AdminUser):
    if db.query(Usuario).filter(Usuario.email == datos.email.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo")
    usuario = Usuario(
        email=datos.email.lower(),
        nombre=datos.nombre,
        rol=datos.rol,
        activo=datos.activo,
        hashed_password=hash_password(datos.password),
    )
    db.add(usuario)
    db.flush()
    auditar(db, admin, "crear", "usuario", usuario.id, {"email": usuario.email, "rol": usuario.rol.value})
    db.commit()
    return usuario


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioOut)
def actualizar_usuario(usuario_id: int, datos: UsuarioUpdate, db: DB, admin: AdminUser):
    usuario = get_or_404(db, Usuario, usuario_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "password" in cambios:
        usuario.hashed_password = hash_password(cambios.pop("password"))
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    auditar(db, admin, "actualizar", "usuario", usuario.id, {k: v for k, v in cambios.items()})
    db.commit()
    return usuario
