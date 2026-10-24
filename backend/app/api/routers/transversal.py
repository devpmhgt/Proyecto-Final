from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func

from app.api.deps import DB, AdminUser, CurrentUser, GestionUser, get_or_404
from app.models import (
    Auditoria,
    Carrera,
    Curso,
    Docente,
    EstadoDocente,
    EstadoEstudiante,
    EstadoInscripcion,
    EstadoPeriodo,
    Estudiante,
    Inscripcion,
    Notificacion,
    Periodo,
    Seccion,
)
from app.schemas.transversal import AuditoriaOut, Indicadores, NotificacionIn, NotificacionOut
from app.services.escolar import inscritos_en
from app.services.transversal import auditar, notificar

router = APIRouter(tags=["7. Servicios transversales"])


@router.get("/indicadores", response_model=Indicadores)
def indicadores(db: DB, _: GestionUser, periodo_id: int | None = None):
    if periodo_id:
        periodo = get_or_404(db, Periodo, periodo_id)
    else:
        periodo = (
            db.query(Periodo)
            .filter(Periodo.estado != EstadoPeriodo.PLANIFICACION)
            .order_by(Periodo.fecha_inicio.desc())
            .first()
        ) or db.query(Periodo).order_by(Periodo.fecha_inicio.desc()).first()

    secciones = db.query(Seccion).filter(Seccion.periodo_id == periodo.id).all() if periodo else []
    ocupaciones = [inscritos_en(db, s.id) / s.cupo for s in secciones if s.cupo]
    inscripciones = (
        db.query(Inscripcion).join(Seccion).filter(Seccion.periodo_id == periodo.id).all() if periodo else []
    )
    cerradas = [i for i in inscripciones if i.estado in (EstadoInscripcion.APROBADO, EstadoInscripcion.REPROBADO)]
    aprobadas = sum(1 for i in cerradas if i.estado == EstadoInscripcion.APROBADO)

    por_carrera = (
        db.query(Carrera.nombre, func.count(Estudiante.id))
        .join(Estudiante, Estudiante.carrera_id == Carrera.id)
        .filter(Estudiante.estado == EstadoEstudiante.ACTIVO)
        .group_by(Carrera.nombre)
        .all()
    )
    por_estado = db.query(Estudiante.estado, func.count(Estudiante.id)).group_by(Estudiante.estado).all()

    return Indicadores(
        estudiantes_activos=db.query(Estudiante).filter(Estudiante.estado == EstadoEstudiante.ACTIVO).count(),
        docentes_activos=db.query(Docente).filter(Docente.estado == EstadoDocente.ACTIVO).count(),
        carreras=db.query(Carrera).filter(Carrera.activa.is_(True)).count(),
        cursos=db.query(Curso).count(),
        periodo_actual=periodo.codigo if periodo else None,
        secciones_periodo=len(secciones),
        inscripciones_periodo=sum(1 for i in inscripciones if i.estado != EstadoInscripcion.RETIRADO),
        ocupacion_promedio=round(100 * sum(ocupaciones) / len(ocupaciones), 1) if ocupaciones else 0.0,
        tasa_aprobacion=round(100 * aprobadas / len(cerradas), 1) if cerradas else None,
        estudiantes_por_carrera=[{"nombre": n, "total": t} for n, t in por_carrera],
        estudiantes_por_estado=[{"estado": e.value if hasattr(e, "value") else e, "total": t} for e, t in por_estado],
    )


def _a_utc(d: datetime) -> datetime:
    """Convierte un filtro con zona (hora local del navegador) a UTC sin zona, como se guarda en la base."""
    return d.astimezone(UTC).replace(tzinfo=None) if d.tzinfo else d


@router.get("/auditoria", response_model=list[AuditoriaOut])
def listar_auditoria(
    db: DB, _: AdminUser, entidad: str | None = None, usuario_id: int | None = None,
    desde: datetime | None = None, hasta: datetime | None = None, limite: int = 200,
):
    q = db.query(Auditoria)
    if entidad:
        q = q.filter(Auditoria.entidad == entidad)
    if usuario_id:
        q = q.filter(Auditoria.usuario_id == usuario_id)
    if desde:
        q = q.filter(Auditoria.fecha >= _a_utc(desde))
    if hasta:
        q = q.filter(Auditoria.fecha <= _a_utc(hasta))
    return q.order_by(Auditoria.id.desc()).limit(min(limite, 1000)).all()


@router.get("/notificaciones", response_model=list[NotificacionOut])
def mis_notificaciones(db: DB, usuario: CurrentUser, solo_no_leidas: bool = False):
    q = db.query(Notificacion).filter(Notificacion.usuario_id == usuario.id)
    if solo_no_leidas:
        q = q.filter(Notificacion.leida.is_(False))
    return q.order_by(Notificacion.id.desc()).limit(100).all()


@router.post("/notificaciones/{notificacion_id}/leer", response_model=NotificacionOut)
def marcar_leida(notificacion_id: int, db: DB, usuario: CurrentUser):
    n = get_or_404(db, Notificacion, notificacion_id)
    if n.usuario_id != usuario.id:
        get_or_404(db, Notificacion, -1)  # no revelar notificaciones ajenas
    n.leida = True
    db.commit()
    return n


@router.post("/notificaciones/leer-todas", status_code=204)
def marcar_todas(db: DB, usuario: CurrentUser):
    db.query(Notificacion).filter(Notificacion.usuario_id == usuario.id).update({"leida": True})
    db.commit()


@router.post("/notificaciones", status_code=201)
def enviar_notificacion(datos: NotificacionIn, db: DB, gestor: GestionUser):
    notificar(db, datos.usuario_id, datos.titulo, datos.mensaje)
    auditar(db, gestor, "enviar", "notificacion", None, {"destino": datos.usuario_id, "titulo": datos.titulo})
    db.commit()
    return {"detail": "Notificación enviada"}
