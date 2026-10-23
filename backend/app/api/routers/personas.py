from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser, GestionUser, PersonalUser, docente_de, estudiante_de, get_or_404
from app.core.security import hash_password
from app.models import Carrera, DisponibilidadDocente, Docente, EstadoEstudiante, Estudiante, Rol, Usuario
from app.schemas.auth import UsuarioOut
from app.schemas.personas import (
    Avance,
    DisponibilidadIn,
    DocenteIn,
    DocenteOut,
    DocenteUpdate,
    EstudianteIn,
    EstudianteOut,
    EstudianteUpdate,
    VincularCuenta,
)
from app.services.avance import calcular_avance
from app.services.correos import validar_correo_disponible
from app.services.transversal import auditar

router = APIRouter(tags=["3. Estudiantes y docentes"])


def _cambiar_correo(db: Session, cambios: dict, registro: Estudiante | Docente, **excluir) -> None:
    """Valida un cambio de correo y lo replica en la cuenta de acceso vinculada."""
    if "email" not in cambios:
        return
    if cambios["email"] is None:
        cambios.pop("email")
        return
    cambios["email"] = validar_correo_disponible(db, cambios["email"], usuario_id=registro.usuario_id, **excluir)
    if registro.usuario:
        registro.usuario.email = cambios["email"]


def _gestionar_acceso(db: Session, registro: Estudiante | Docente, password: str | None, rol: Rol, **excluir) -> bool:
    """Crea la cuenta vinculada si el expediente no tiene, o restablece su contraseña. Devuelve True si cambió algo."""
    if not password:
        return False
    if registro.usuario:
        registro.usuario.hashed_password = hash_password(password)
    else:
        correo = validar_correo_disponible(db, registro.email, **excluir)
        registro.usuario_id = _crear_cuenta(db, correo, f"{registro.nombres} {registro.apellidos}".strip(), password, rol).id
    return True


def _crear_cuenta(db: Session, email: str, nombre: str, password: str, rol: Rol) -> Usuario:
    """Crea la cuenta vinculada a un expediente; el correo ya fue validado por el llamador."""
    usuario = Usuario(email=email, nombre=nombre, rol=rol, hashed_password=hash_password(password))
    db.add(usuario)
    db.flush()
    return usuario


# ---------- Estudiantes ----------

@router.get("/estudiantes", response_model=list[EstudianteOut])
def listar_estudiantes(
    db: DB, _: PersonalUser, q: str | None = None, carrera_id: int | None = None, estado: EstadoEstudiante | None = None
):
    consulta = db.query(Estudiante)
    if q:
        like = f"%{q}%"
        consulta = consulta.filter(
            or_(Estudiante.carnet.ilike(like), Estudiante.nombres.ilike(like), Estudiante.apellidos.ilike(like))
        )
    if carrera_id:
        consulta = consulta.filter(Estudiante.carrera_id == carrera_id)
    if estado:
        consulta = consulta.filter(Estudiante.estado == estado)
    return consulta.order_by(Estudiante.apellidos, Estudiante.nombres).all()


@router.get("/estudiantes/me", response_model=EstudianteOut)
def mi_expediente(db: DB, usuario: CurrentUser):
    est = estudiante_de(db, usuario)
    if est is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El usuario no tiene expediente de estudiante")
    return est


@router.get("/estudiantes/me/avance", response_model=Avance)
def mi_avance(db: DB, usuario: CurrentUser):
    est = estudiante_de(db, usuario)
    if est is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El usuario no tiene expediente de estudiante")
    return calcular_avance(db, est)


@router.get("/estudiantes/{estudiante_id}/avance", response_model=Avance)
def avance_estudiante(estudiante_id: int, db: DB, _: GestionUser):
    return calcular_avance(db, get_or_404(db, Estudiante, estudiante_id))


@router.get("/estudiantes/{estudiante_id}", response_model=EstudianteOut)
def obtener_estudiante(estudiante_id: int, db: DB, usuario: CurrentUser):
    est = get_or_404(db, Estudiante, estudiante_id)
    if usuario.rol == Rol.ESTUDIANTE and est.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puede consultar su propio expediente")
    return est


@router.post("/estudiantes", response_model=EstudianteOut, status_code=201)
def crear_estudiante(datos: EstudianteIn, db: DB, gestor: GestionUser):
    get_or_404(db, Carrera, datos.carrera_id)
    if db.query(Estudiante).filter(Estudiante.carnet == datos.carnet).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un estudiante con el carné {datos.carnet}")
    correo = validar_correo_disponible(db, datos.email)
    est = Estudiante(**{**datos.model_dump(exclude={"password"}), "email": correo})
    if datos.password:
        est.usuario_id = _crear_cuenta(
            db, correo, f"{datos.nombres} {datos.apellidos}", datos.password, Rol.ESTUDIANTE
        ).id
    db.add(est)
    db.flush()
    auditar(db, gestor, "crear", "estudiante", est.id, {"carnet": est.carnet})
    db.commit()
    return est


@router.patch("/estudiantes/{estudiante_id}", response_model=EstudianteOut)
def actualizar_estudiante(estudiante_id: int, datos: EstudianteUpdate, db: DB, gestor: GestionUser):
    est = get_or_404(db, Estudiante, estudiante_id)
    cambios = datos.model_dump(exclude_unset=True)
    password = cambios.pop("password", None)
    _cambiar_correo(db, cambios, est, estudiante_id=est.id)
    for campo, valor in cambios.items():
        setattr(est, campo, valor)
    if _gestionar_acceso(db, est, password, Rol.ESTUDIANTE, estudiante_id=est.id):
        cambios["acceso"] = "contraseña asignada"
    if est.usuario and "estado" in cambios:
        est.usuario.activo = est.estado == EstadoEstudiante.ACTIVO
    auditar(db, gestor, "actualizar", "estudiante", est.id, cambios)
    db.commit()
    return est


# ---------- Docentes ----------

@router.get("/docentes", response_model=list[DocenteOut])
def listar_docentes(db: DB, _: PersonalUser, q: str | None = None):
    consulta = db.query(Docente)
    if q:
        like = f"%{q}%"
        consulta = consulta.filter(
            or_(Docente.codigo.ilike(like), Docente.nombres.ilike(like), Docente.apellidos.ilike(like))
        )
    return consulta.order_by(Docente.apellidos, Docente.nombres).all()


@router.get("/docentes/me", response_model=DocenteOut)
def mi_perfil_docente(db: DB, usuario: CurrentUser):
    doc = docente_de(db, usuario)
    if doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "El usuario no tiene perfil docente")
    return doc


@router.get("/docentes/{docente_id}", response_model=DocenteOut)
def obtener_docente(docente_id: int, db: DB, _: PersonalUser):
    return get_or_404(db, Docente, docente_id)


@router.post("/docentes", response_model=DocenteOut, status_code=201)
def crear_docente(datos: DocenteIn, db: DB, gestor: GestionUser):
    if db.query(Docente).filter(Docente.codigo == datos.codigo).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe un docente con el código {datos.codigo}")
    correo = validar_correo_disponible(db, datos.email)
    doc = Docente(**{**datos.model_dump(exclude={"password"}), "email": correo})
    if datos.password:
        doc.usuario_id = _crear_cuenta(
            db, correo, f"{datos.nombres} {datos.apellidos}", datos.password, Rol.DOCENTE
        ).id
    db.add(doc)
    db.flush()
    auditar(db, gestor, "crear", "docente", doc.id, {"codigo": doc.codigo})
    db.commit()
    return doc


@router.patch("/docentes/{docente_id}", response_model=DocenteOut)
def actualizar_docente(docente_id: int, datos: DocenteUpdate, db: DB, gestor: GestionUser):
    doc = get_or_404(db, Docente, docente_id)
    cambios = datos.model_dump(exclude_unset=True)
    password = cambios.pop("password", None)
    _cambiar_correo(db, cambios, doc, docente_id=doc.id)
    for campo, valor in cambios.items():
        setattr(doc, campo, valor)
    if _gestionar_acceso(db, doc, password, Rol.DOCENTE, docente_id=doc.id):
        cambios["acceso"] = "contraseña asignada"
    auditar(db, gestor, "actualizar", "docente", doc.id, cambios)
    db.commit()
    return doc


@router.put("/docentes/{docente_id}/disponibilidad", response_model=DocenteOut)
def definir_disponibilidad(docente_id: int, franjas: list[DisponibilidadIn], db: DB, usuario: PersonalUser):
    doc = get_or_404(db, Docente, docente_id)
    if usuario.rol == Rol.DOCENTE and doc.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puede modificar su propia disponibilidad")
    doc.disponibilidad = [DisponibilidadDocente(**f.model_dump()) for f in franjas]
    auditar(db, usuario, "actualizar_disponibilidad", "docente", doc.id, {"franjas": len(franjas)})
    db.commit()
    db.refresh(doc)
    return doc


# ---------- Vincular cuentas de acceso existentes ----------

def _cuenta_libre(db: Session, usuario_id: int, rol: Rol) -> Usuario:
    usuario = get_or_404(db, Usuario, usuario_id)
    if usuario.rol != rol:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            f"La cuenta {usuario.email} tiene rol {usuario.rol.value}; debe ser {rol.value}")
    if (db.query(Estudiante).filter(Estudiante.usuario_id == usuario.id).first()
            or db.query(Docente).filter(Docente.usuario_id == usuario.id).first()):
        raise HTTPException(status.HTTP_409_CONFLICT, f"La cuenta {usuario.email} ya está vinculada a otro expediente")
    return usuario


def _vincular(db: Session, registro: Estudiante | Docente, usuario_id: int, rol: Rol, **excluir) -> Usuario:
    if registro.usuario_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "El expediente ya tiene una cuenta vinculada; desvincúlela primero")
    usuario = _cuenta_libre(db, usuario_id, rol)
    # El expediente adopta el correo de la cuenta, para que ambos coincidan
    registro.email = validar_correo_disponible(db, usuario.email, usuario_id=usuario.id, **excluir)
    registro.usuario_id = usuario.id
    return usuario


@router.get("/cuentas-sin-expediente", response_model=list[UsuarioOut])
def cuentas_sin_expediente(db: DB, _: GestionUser, rol: Rol):
    """Cuentas de estudiante o docente que todavía no están vinculadas a un expediente."""
    vinculadas = {u for (u,) in db.query(Estudiante.usuario_id).filter(Estudiante.usuario_id.isnot(None))}
    vinculadas |= {u for (u,) in db.query(Docente.usuario_id).filter(Docente.usuario_id.isnot(None))}
    cuentas = db.query(Usuario).filter(Usuario.rol == rol).order_by(Usuario.nombre).all()
    return [u for u in cuentas if u.id not in vinculadas]


@router.post("/estudiantes/{estudiante_id}/vincular", response_model=EstudianteOut)
def vincular_estudiante(estudiante_id: int, datos: VincularCuenta, db: DB, gestor: GestionUser):
    est = get_or_404(db, Estudiante, estudiante_id)
    usuario = _vincular(db, est, datos.usuario_id, Rol.ESTUDIANTE, estudiante_id=est.id)
    auditar(db, gestor, "vincular_cuenta", "estudiante", est.id, {"usuario_id": usuario.id, "email": usuario.email})
    db.commit()
    return est


@router.post("/estudiantes/{estudiante_id}/desvincular", response_model=EstudianteOut)
def desvincular_estudiante(estudiante_id: int, db: DB, gestor: GestionUser):
    est = get_or_404(db, Estudiante, estudiante_id)
    if not est.usuario_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El expediente no tiene cuenta vinculada")
    auditar(db, gestor, "desvincular_cuenta", "estudiante", est.id, {"usuario_id": est.usuario_id})
    est.usuario_id = None
    db.commit()
    return est


@router.post("/docentes/{docente_id}/vincular", response_model=DocenteOut)
def vincular_docente(docente_id: int, datos: VincularCuenta, db: DB, gestor: GestionUser):
    doc = get_or_404(db, Docente, docente_id)
    usuario = _vincular(db, doc, datos.usuario_id, Rol.DOCENTE, docente_id=doc.id)
    auditar(db, gestor, "vincular_cuenta", "docente", doc.id, {"usuario_id": usuario.id, "email": usuario.email})
    db.commit()
    return doc


@router.post("/docentes/{docente_id}/desvincular", response_model=DocenteOut)
def desvincular_docente(docente_id: int, db: DB, gestor: GestionUser):
    doc = get_or_404(db, Docente, docente_id)
    if not doc.usuario_id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El docente no tiene cuenta vinculada")
    auditar(db, gestor, "desvincular_cuenta", "docente", doc.id, {"usuario_id": doc.usuario_id})
    doc.usuario_id = None
    db.commit()
    return doc
