"""Avance académico del estudiante sobre su plan de estudios."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import EstadoInscripcion, Estudiante, Inscripcion, PlanEstudio
from app.services.escolar import creditos_aprobados


def plan_del_estudiante(db: Session, est: Estudiante) -> PlanEstudio | None:
    if est.plan_id:
        return db.get(PlanEstudio, est.plan_id)
    # Sin plan asignado: el plan vigente más reciente de su carrera
    return (
        db.query(PlanEstudio)
        .filter(PlanEstudio.carrera_id == est.carrera_id, PlanEstudio.vigente.is_(True))
        .order_by(PlanEstudio.anio.desc(), PlanEstudio.id.desc())
        .first()
    )


def calcular_avance(db: Session, est: Estudiante) -> dict:
    plan = plan_del_estudiante(db, est)
    inscripciones = db.query(Inscripcion).filter(Inscripcion.estudiante_id == est.id).all()

    notas: dict[int, Decimal] = {}
    en_curso: set[int] = set()
    reprobados: dict[int, int] = {}
    for i in inscripciones:
        curso_id = i.seccion.curso_id
        if i.estado == EstadoInscripcion.APROBADO:
            nota = i.nota_final if i.nota_final is not None else Decimal(0)
            notas[curso_id] = max(nota, notas.get(curso_id, nota))
        elif i.estado == EstadoInscripcion.INSCRITO:
            en_curso.add(curso_id)
        elif i.estado == EstadoInscripcion.REPROBADO:
            reprobados[curso_id] = reprobados.get(curso_id, 0) + 1

    acumulados = creditos_aprobados(db, est.id)
    base = {
        "estudiante": {"id": est.id, "carnet": est.carnet, "nombres": est.nombres, "apellidos": est.apellidos},
        "carrera": est.carrera.nombre,
        "creditos_aprobados_total": acumulados,
    }
    if plan is None:
        return {**base, "plan": None, "creditos_aprobados": 0, "creditos_totales": 0, "porcentaje": 0.0,
                "promedio": None, "cursos_aprobados": 0, "cursos_totales": 0, "en_curso": 0,
                "disponibles": 0, "ciclos": []}

    plan_cursos = sorted(plan.cursos, key=lambda pc: (pc.semestre, pc.curso.codigo))
    desbloquea: dict[int, list[int]] = {}
    for pc in plan_cursos:
        for p in pc.curso.prerrequisitos:
            desbloquea.setdefault(p.id, []).append(pc.curso.id)

    ciclos: dict[int, list[dict]] = {}
    for pc in plan_cursos:
        c = pc.curso
        faltantes = [p.codigo for p in c.prerrequisitos if p.id not in notas]
        faltan_creditos = max(0, (c.creditos_requeridos or 0) - acumulados)
        if c.id in notas:
            estado = "aprobado"
        elif c.id in en_curso:
            estado = "en_curso"
        elif not faltantes and not faltan_creditos:
            estado = "disponible"
        else:
            estado = "bloqueado"
        ciclos.setdefault(pc.semestre, []).append({
            "id": c.id,
            "codigo": c.codigo,
            "nombre": c.nombre,
            "creditos": c.creditos,
            "semestre": pc.semestre,
            "estado": estado,
            "nota": notas.get(c.id),
            "intentos_reprobados": reprobados.get(c.id, 0),
            "prerrequisitos": [{"id": p.id, "codigo": p.codigo, "nombre": p.nombre} for p in c.prerrequisitos],
            "creditos_requeridos": c.creditos_requeridos,
            "faltantes": faltantes,
            "creditos_faltantes": faltan_creditos,
            "desbloquea": desbloquea.get(c.id, []),
        })

    cursos = [c for lista in ciclos.values() for c in lista]
    aprobados = [c for c in cursos if c["estado"] == "aprobado"]
    creditos_totales = sum(c["creditos"] for c in cursos)
    creditos_plan = sum(c["creditos"] for c in aprobados)
    notas_plan = [c["nota"] for c in aprobados if c["nota"] is not None]
    return {
        **base,
        "plan": {"id": plan.id, "codigo": plan.codigo, "nombre": plan.nombre},
        "creditos_aprobados": creditos_plan,
        "creditos_totales": creditos_totales,
        "porcentaje": round(100 * creditos_plan / creditos_totales, 1) if creditos_totales else 0.0,
        "promedio": round(sum(notas_plan) / len(notas_plan), 2) if notas_plan else None,
        "cursos_aprobados": len(aprobados),
        "cursos_totales": len(cursos),
        "en_curso": sum(1 for c in cursos if c["estado"] == "en_curso"),
        "disponibles": sum(1 for c in cursos if c["estado"] == "disponible"),
        "ciclos": [{"semestre": s, "cursos": ciclos[s]} for s in sorted(ciclos)],
    }
