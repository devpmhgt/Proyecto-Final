from decimal import Decimal

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DB, CurrentUser, GestionUser, PersonalUser, docente_de, estudiante_de, get_or_404
from app.models import Calificacion, EstadoInscripcion, Estudiante, Evaluacion, Inscripcion, Rol, Seccion, Usuario
from app.schemas.escolar import (
    Acta,
    EvaluacionIn,
    EvaluacionOut,
    FilaActa,
    InscripcionIn,
    InscripcionOut,
    NotasLote,
)
from app.services import escolar as svc
from app.services.transversal import auditar

router = APIRouter(tags=["6. Gestión escolar"])


def _verificar_docente_de_seccion(db, usuario: Usuario, seccion: Seccion) -> None:
    if usuario.rol in (Rol.ADMIN, Rol.COORDINADOR):
        return
    doc = docente_de(db, usuario)
    if doc is None or seccion.docente_id != doc.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo el docente asignado puede gestionar esta sección")


def _abierta(seccion: Seccion) -> None:
    if seccion.acta_cerrada:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El acta de la sección está cerrada")


# ---------- Inscripciones y retiros ----------

@router.get("/inscripciones", response_model=list[InscripcionOut])
def listar_inscripciones(
    db: DB, usuario: CurrentUser, periodo_id: int | None = None, estudiante_id: int | None = None,
    seccion_id: int | None = None,
):
    q = db.query(Inscripcion).join(Seccion)
    if usuario.rol == Rol.ESTUDIANTE:
        est = estudiante_de(db, usuario)
        estudiante_id = est.id if est else -1
    elif usuario.rol == Rol.DOCENTE:
        doc = docente_de(db, usuario)
        q = q.filter(Seccion.docente_id == (doc.id if doc else -1))
    if estudiante_id:
        q = q.filter(Inscripcion.estudiante_id == estudiante_id)
    if periodo_id:
        q = q.filter(Seccion.periodo_id == periodo_id)
    if seccion_id:
        q = q.filter(Inscripcion.seccion_id == seccion_id)
    return q.order_by(Inscripcion.fecha_inscripcion.desc()).all()


@router.post("/inscripciones", response_model=InscripcionOut, status_code=201)
def inscribir(datos: InscripcionIn, db: DB, usuario: CurrentUser):
    if usuario.rol == Rol.ESTUDIANTE:
        estudiante = estudiante_de(db, usuario)
        if estudiante is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "El usuario no tiene expediente de estudiante")
    elif usuario.rol in (Rol.ADMIN, Rol.COORDINADOR):
        if datos.estudiante_id is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Debe indicar estudiante_id")
        estudiante = get_or_404(db, Estudiante, datos.estudiante_id)
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Los docentes no pueden inscribir estudiantes")

    seccion = get_or_404(db, Seccion, datos.seccion_id)
    inscripcion = svc.inscribir(db, estudiante, seccion)
    db.flush()
    auditar(db, usuario, "inscribir", "inscripcion", inscripcion.id,
            {"estudiante": estudiante.carnet, "seccion_id": seccion.id})
    db.commit()
    db.refresh(inscripcion)
    return inscripcion


@router.post("/inscripciones/{inscripcion_id}/retiro", response_model=InscripcionOut)
def retirar(inscripcion_id: int, db: DB, usuario: CurrentUser):
    inscripcion = get_or_404(db, Inscripcion, inscripcion_id)
    if usuario.rol == Rol.ESTUDIANTE:
        est = estudiante_de(db, usuario)
        if est is None or inscripcion.estudiante_id != est.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puede retirar sus propias inscripciones")
    elif usuario.rol == Rol.DOCENTE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Los docentes no pueden registrar retiros")
    svc.retirar(db, inscripcion)
    auditar(db, usuario, "retirar", "inscripcion", inscripcion.id)
    db.commit()
    return inscripcion


# ---------- Ponderaciones (evaluaciones) ----------

@router.get("/secciones/{seccion_id}/evaluaciones", response_model=list[EvaluacionOut])
def listar_evaluaciones(seccion_id: int, db: DB, _: CurrentUser):
    return db.query(Evaluacion).filter(Evaluacion.seccion_id == seccion_id).order_by(Evaluacion.id).all()


@router.post("/secciones/{seccion_id}/evaluaciones", response_model=EvaluacionOut, status_code=201)
def crear_evaluacion(seccion_id: int, datos: EvaluacionIn, db: DB, usuario: PersonalUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    _abierta(seccion)
    if svc.total_ponderacion(db, seccion_id) + datos.ponderacion > 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La suma de ponderaciones excedería el 100%")
    ev = Evaluacion(seccion_id=seccion_id, **datos.model_dump())
    db.add(ev)
    db.flush()
    auditar(db, usuario, "crear", "evaluacion", ev.id, {"seccion_id": seccion_id, **datos.model_dump()})
    db.commit()
    return ev


@router.put("/evaluaciones/{evaluacion_id}", response_model=EvaluacionOut)
def actualizar_evaluacion(evaluacion_id: int, datos: EvaluacionIn, db: DB, usuario: PersonalUser):
    ev = get_or_404(db, Evaluacion, evaluacion_id)
    seccion = get_or_404(db, Seccion, ev.seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    _abierta(seccion)
    if svc.total_ponderacion(db, seccion.id, excluir_id=ev.id) + datos.ponderacion > 100:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La suma de ponderaciones excedería el 100%")
    ev.nombre, ev.ponderacion = datos.nombre, datos.ponderacion
    auditar(db, usuario, "actualizar", "evaluacion", ev.id, datos.model_dump())
    db.commit()
    return ev


@router.delete("/evaluaciones/{evaluacion_id}", status_code=204)
def eliminar_evaluacion(evaluacion_id: int, db: DB, usuario: PersonalUser):
    ev = get_or_404(db, Evaluacion, evaluacion_id)
    seccion = get_or_404(db, Seccion, ev.seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    _abierta(seccion)
    db.query(Calificacion).filter(Calificacion.evaluacion_id == ev.id).delete()
    auditar(db, usuario, "eliminar", "evaluacion", ev.id, {"nombre": ev.nombre})
    db.delete(ev)
    db.commit()


# ---------- Registro de notas y actas ----------

@router.get("/secciones/{seccion_id}/acta", response_model=Acta)
def ver_acta(seccion_id: int, db: DB, usuario: PersonalUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    evaluaciones = db.query(Evaluacion).filter(Evaluacion.seccion_id == seccion_id).order_by(Evaluacion.id).all()
    inscripciones = (
        db.query(Inscripcion)
        .join(Estudiante)
        .filter(Inscripcion.seccion_id == seccion_id, Inscripcion.estado != EstadoInscripcion.RETIRADO)
        .order_by(Estudiante.apellidos)
        .all()
    )
    filas = [
        FilaActa(
            inscripcion_id=i.id,
            estudiante=i.estudiante,
            estado=i.estado,
            notas={c.evaluacion_id: c.nota for c in i.calificaciones},
            nota_acumulada=svc.nota_acumulada(i, evaluaciones),
            nota_final=i.nota_final,
        )
        for i in inscripciones
    ]
    return Acta(seccion_id=seccion.id, acta_cerrada=seccion.acta_cerrada,
                evaluaciones=evaluaciones, filas=filas)


@router.put("/secciones/{seccion_id}/notas", response_model=Acta)
def registrar_notas(seccion_id: int, datos: NotasLote, db: DB, usuario: PersonalUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    _abierta(seccion)
    evals = {e.id for e in db.query(Evaluacion).filter(Evaluacion.seccion_id == seccion_id)}
    inscs = {i.id: i for i in db.query(Inscripcion).filter(Inscripcion.seccion_id == seccion_id,
                                                           Inscripcion.estado == EstadoInscripcion.INSCRITO)}
    for n in datos.notas:
        if n.evaluacion_id not in evals or n.inscripcion_id not in inscs:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                                f"Evaluación {n.evaluacion_id} o inscripción {n.inscripcion_id} no válida para la sección")
        cal = (
            db.query(Calificacion)
            .filter_by(inscripcion_id=n.inscripcion_id, evaluacion_id=n.evaluacion_id)
            .first()
        )
        if cal:
            cal.nota = Decimal(n.nota)
        else:
            db.add(Calificacion(inscripcion_id=n.inscripcion_id, evaluacion_id=n.evaluacion_id, nota=n.nota))
    auditar(db, usuario, "registrar_notas", "seccion", seccion.id, {"cantidad": len(datos.notas)})
    db.commit()
    db.expire_all()
    return ver_acta(seccion_id, db, usuario)


@router.post("/secciones/{seccion_id}/cerrar-acta", response_model=Acta)
def cerrar_acta(seccion_id: int, db: DB, usuario: PersonalUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    _verificar_docente_de_seccion(db, usuario, seccion)
    procesadas = svc.cerrar_acta(db, seccion)
    auditar(db, usuario, "cerrar_acta", "seccion", seccion.id, {"estudiantes": len(procesadas)})
    db.commit()
    return ver_acta(seccion_id, db, usuario)


@router.post("/secciones/{seccion_id}/reabrir-acta", response_model=Acta)
def reabrir_acta(seccion_id: int, db: DB, gestor: GestionUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    if not seccion.acta_cerrada:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El acta no está cerrada")
    for i in db.query(Inscripcion).filter(Inscripcion.seccion_id == seccion_id,
                                          Inscripcion.estado.in_([EstadoInscripcion.APROBADO, EstadoInscripcion.REPROBADO])):
        i.estado, i.nota_final = EstadoInscripcion.INSCRITO, None
    seccion.acta_cerrada = False
    auditar(db, gestor, "reabrir_acta", "seccion", seccion.id)
    db.commit()
    return ver_acta(seccion_id, db, gestor)
