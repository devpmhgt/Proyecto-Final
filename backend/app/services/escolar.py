"""Reglas de negocio de gestión escolar: inscripciones, retiros, notas y cierre de actas."""

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    EstadoEstudiante,
    EstadoInscripcion,
    EstadoPeriodo,
    Estudiante,
    Evaluacion,
    Inscripcion,
    Seccion,
)
from app.services.planificacion import se_traslapan
from app.services.transversal import notificar, parametro_num

ACTIVAS = (EstadoInscripcion.INSCRITO, EstadoInscripcion.APROBADO, EstadoInscripcion.REPROBADO)


def _regla(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, msg)


def inscritos_en(db: Session, seccion_id: int) -> int:
    return (
        db.query(func.count(Inscripcion.id))
        .filter(Inscripcion.seccion_id == seccion_id, Inscripcion.estado != EstadoInscripcion.RETIRADO)
        .scalar()
    )


def cursos_aprobados(db: Session, estudiante_id: int) -> set[int]:
    filas = (
        db.query(Seccion.curso_id)
        .join(Inscripcion)
        .filter(Inscripcion.estudiante_id == estudiante_id, Inscripcion.estado == EstadoInscripcion.APROBADO)
        .all()
    )
    return {f[0] for f in filas}


def inscribir(db: Session, estudiante: Estudiante, seccion: Seccion) -> Inscripcion:
    periodo = seccion.periodo
    if estudiante.estado != EstadoEstudiante.ACTIVO:
        raise _regla("El estudiante no está activo")
    if periodo.estado != EstadoPeriodo.INSCRIPCION:
        raise _regla(f"El periodo {periodo.codigo} no está en etapa de inscripción")
    if seccion.acta_cerrada:
        raise _regla("La sección tiene el acta cerrada")

    existente = (
        db.query(Inscripcion)
        .filter(Inscripcion.estudiante_id == estudiante.id, Inscripcion.seccion_id == seccion.id)
        .first()
    )
    if existente and existente.estado != EstadoInscripcion.RETIRADO:
        raise _regla("El estudiante ya está inscrito en esta sección")

    actuales = (
        db.query(Inscripcion)
        .join(Seccion)
        .filter(
            Inscripcion.estudiante_id == estudiante.id,
            Seccion.periodo_id == periodo.id,
            Inscripcion.estado == EstadoInscripcion.INSCRITO,
        )
        .all()
    )
    if any(i.seccion.curso_id == seccion.curso_id for i in actuales):
        raise _regla(f"Ya tiene inscrito el curso {seccion.curso.codigo} en otra sección")

    aprobados = cursos_aprobados(db, estudiante.id)
    if seccion.curso_id in aprobados:
        raise _regla(f"El curso {seccion.curso.codigo} ya fue aprobado")
    faltantes = [p.codigo for p in seccion.curso.prerrequisitos if p.id not in aprobados]
    if faltantes:
        raise _regla(f"Prerrequisitos pendientes: {', '.join(faltantes)}")

    if inscritos_en(db, seccion.id) >= seccion.cupo:
        raise _regla("La sección no tiene cupos disponibles")

    creditos = sum(i.seccion.curso.creditos for i in actuales) + seccion.curso.creditos
    max_creditos = parametro_num(db, "max_creditos_periodo")
    if creditos > max_creditos:
        raise _regla(f"Se excede el máximo de créditos por periodo ({int(max_creditos)})")

    for i in actuales:
        for h1 in i.seccion.horarios:
            for h2 in seccion.horarios:
                if h1.dia == h2.dia and se_traslapan(h1.hora_inicio, h1.hora_fin, h2.hora_inicio, h2.hora_fin):
                    raise _regla(f"Choque de horario con {i.seccion.curso.codigo} sección {i.seccion.codigo}")

    if existente:  # reinscripción tras un retiro
        existente.estado = EstadoInscripcion.INSCRITO
        existente.fecha_retiro = None
        existente.fecha_inscripcion = datetime.now()
        inscripcion = existente
    else:
        inscripcion = Inscripcion(estudiante_id=estudiante.id, seccion_id=seccion.id)
        db.add(inscripcion)
    notificar(
        db,
        estudiante.usuario_id,
        "Inscripción confirmada",
        f"Quedó inscrito en {seccion.curso.codigo} - {seccion.curso.nombre}, sección {seccion.codigo}.",
    )
    return inscripcion


def retirar(db: Session, inscripcion: Inscripcion) -> Inscripcion:
    periodo = inscripcion.seccion.periodo
    if inscripcion.estado != EstadoInscripcion.INSCRITO:
        raise _regla("Solo se pueden retirar inscripciones vigentes")
    if inscripcion.seccion.acta_cerrada:
        raise _regla("El acta de la sección ya está cerrada")
    if periodo.fecha_limite_retiro and date.today() > periodo.fecha_limite_retiro:
        raise _regla(f"La fecha límite de retiro ({periodo.fecha_limite_retiro}) ya pasó")

    retiros = (
        db.query(func.count(Inscripcion.id))
        .join(Seccion)
        .filter(
            Inscripcion.estudiante_id == inscripcion.estudiante_id,
            Seccion.periodo_id == periodo.id,
            Inscripcion.estado == EstadoInscripcion.RETIRADO,
        )
        .scalar()
    )
    if retiros >= parametro_num(db, "max_retiros_periodo"):
        raise _regla("Se alcanzó el máximo de retiros permitidos en el periodo")

    inscripcion.estado = EstadoInscripcion.RETIRADO
    inscripcion.fecha_retiro = datetime.now()
    notificar(
        db,
        inscripcion.estudiante.usuario_id,
        "Retiro de curso",
        f"Se registró el retiro de {inscripcion.seccion.curso.codigo}, sección {inscripcion.seccion.codigo}.",
    )
    return inscripcion


def total_ponderacion(db: Session, seccion_id: int, excluir_id: int | None = None) -> Decimal:
    q = db.query(func.coalesce(func.sum(Evaluacion.ponderacion), 0)).filter(Evaluacion.seccion_id == seccion_id)
    if excluir_id:
        q = q.filter(Evaluacion.id != excluir_id)
    return Decimal(q.scalar())


def nota_acumulada(inscripcion: Inscripcion, evaluaciones: list[Evaluacion]) -> Decimal:
    pesos = {e.id: Decimal(e.ponderacion) for e in evaluaciones}
    total = sum(
        (Decimal(c.nota) * pesos[c.evaluacion_id] / 100 for c in inscripcion.calificaciones if c.evaluacion_id in pesos),
        Decimal(0),
    )
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def cerrar_acta(db: Session, seccion: Seccion) -> list[Inscripcion]:
    if seccion.acta_cerrada:
        raise _regla("El acta ya está cerrada")
    evaluaciones = db.query(Evaluacion).filter(Evaluacion.seccion_id == seccion.id).all()
    if total_ponderacion(db, seccion.id) != Decimal(100):
        raise _regla("Las ponderaciones de la sección deben sumar 100% para cerrar el acta")

    minima = Decimal(str(parametro_num(db, "nota_minima_aprobacion")))
    inscripciones = (
        db.query(Inscripcion)
        .filter(Inscripcion.seccion_id == seccion.id, Inscripcion.estado == EstadoInscripcion.INSCRITO)
        .all()
    )
    for i in inscripciones:
        i.nota_final = nota_acumulada(i, evaluaciones)
        i.estado = EstadoInscripcion.APROBADO if i.nota_final >= minima else EstadoInscripcion.REPROBADO
        notificar(
            db,
            i.estudiante.usuario_id,
            "Nota final publicada",
            f"{seccion.curso.codigo} - {seccion.curso.nombre}: {i.nota_final} ({i.estado.value}).",
        )
    seccion.acta_cerrada = True
    return inscripciones
