from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import DB, CurrentUser, GestionUser, PersonalUser, docente_de, estudiante_de, get_or_404
from app.core.security import hash_password
from app.models import Carrera, DisponibilidadDocente, Docente, EstadoEstudiante, Estudiante, Rol, Usuario
from app.schemas.personas import (
    Avance,
    DisponibilidadIn,
    DocenteIn,
    DocenteOut,
    DocenteUpdate,
    EstudianteIn,
    EstudianteOut,
    EstudianteUpdate,
)
from app.services.avance import calcular_avance
from app.services.transversal import auditar

router = APIRouter(tags=["3. Estudiantes y docentes"])


def _crear_cuenta(db: Session, email: str, nombre: str, password: str, rol: Rol) -> Usuario:
    if db.query(Usuario).filter(Usuario.email == email.lower()).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Ya existe una cuenta con el correo {email}")
    usuario = Usuario(email=email.lower(), nombre=nombre, rol=rol, hashed_password=hash_password(password))
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
    if db.query(Estudiante).filter(or_(Estudiante.carnet == datos.carnet, Estudiante.email == datos.email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un estudiante con ese carnet o correo")
    valores = datos.model_dump(exclude={"password"})
    est = Estudiante(**valores)
    if datos.password:
        est.usuario_id = _crear_cuenta(
            db, datos.email, f"{datos.nombres} {datos.apellidos}", datos.password, Rol.ESTUDIANTE
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
    for campo, valor in cambios.items():
        setattr(est, campo, valor)
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
    if db.query(Docente).filter(or_(Docente.codigo == datos.codigo, Docente.email == datos.email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un docente con ese código o correo")
    doc = Docente(**datos.model_dump(exclude={"password"}))
    if datos.password:
        doc.usuario_id = _crear_cuenta(
            db, datos.email, f"{datos.nombres} {datos.apellidos}", datos.password, Rol.DOCENTE
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
    for campo, valor in cambios.items():
        setattr(doc, campo, valor)
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
