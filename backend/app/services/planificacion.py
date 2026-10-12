"""Reglas de negocio de oferta y planificación: choques de aula, docente y disponibilidad."""

from datetime import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Aula, Docente, Horario, Seccion

DIAS = {1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo"}


def se_traslapan(a_ini: time, a_fin: time, b_ini: time, b_fin: time) -> bool:
    return a_ini < b_fin and b_ini < a_fin


def _conflicto(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, msg)


def validar_horario(db: Session, seccion: Seccion, aula: Aula, dia: int, ini: time, fin: time) -> None:
    if not aula.activa:
        raise _conflicto(f"El aula {aula.codigo} no está activa")
    if seccion.cupo > aula.capacidad:
        raise _conflicto(f"El cupo de la sección ({seccion.cupo}) excede la capacidad del aula ({aula.capacidad})")

    bloques_periodo = (
        db.query(Horario)
        .join(Seccion)
        .filter(Seccion.periodo_id == seccion.periodo_id, Horario.dia == dia, Horario.seccion_id != seccion.id)
        .all()
    )
    for h in bloques_periodo:
        if not se_traslapan(ini, fin, h.hora_inicio, h.hora_fin):
            continue
        if h.aula_id == aula.id:
            raise _conflicto(f"El aula {aula.codigo} ya está ocupada el {DIAS[dia]} en ese horario")
        if seccion.docente_id and h.seccion.docente_id == seccion.docente_id:
            raise _conflicto(f"El docente ya imparte otra sección el {DIAS[dia]} en ese horario")

    if seccion.docente_id:
        validar_disponibilidad_docente(db, db.get(Docente, seccion.docente_id), dia, ini, fin)


def validar_disponibilidad_docente(db: Session, docente: Docente, dia: int, ini: time, fin: time) -> None:
    franjas = [d for d in docente.disponibilidad if d.dia == dia]
    # Si el docente no registró disponibilidad, se asume disponible
    if not docente.disponibilidad:
        return
    if not any(f.hora_inicio <= ini and fin <= f.hora_fin for f in franjas):
        raise _conflicto(f"El docente {docente.nombres} {docente.apellidos} no está disponible el {DIAS[dia]} en ese horario")
