"""Servicios transversales: auditoría, notificaciones y parámetros académicos."""

import json

from sqlalchemy.orm import Session

from app.models import Auditoria, Notificacion, ParametroAcademico, Usuario

PARAMETROS_POR_DEFECTO = {
    "nota_minima_aprobacion": ("61", "Nota mínima (0-100) para aprobar un curso"),
    "max_creditos_periodo": ("24", "Máximo de créditos que un estudiante puede inscribir por periodo"),
    "max_retiros_periodo": ("2", "Máximo de retiros de curso permitidos por periodo"),
}
# Valores enteros admitidos para cada regla
RANGOS_PARAMETROS = {
    "nota_minima_aprobacion": (0, 100),
    "max_creditos_periodo": (1, 60),
    "max_retiros_periodo": (0, 10),
}


def auditar(
    db: Session,
    usuario: Usuario | None,
    accion: str,
    entidad: str,
    entidad_id: int | None = None,
    detalle: dict | str | None = None,
) -> None:
    """Registra una operación en la bitácora. No hace commit: se confirma junto con la operación."""
    if isinstance(detalle, dict):
        detalle = json.dumps(detalle, default=str, ensure_ascii=False)
    db.add(
        Auditoria(
            usuario_id=usuario.id if usuario else None,
            accion=accion,
            entidad=entidad,
            entidad_id=entidad_id,
            detalle=detalle,
        )
    )


def notificar(db: Session, usuario_id: int | None, titulo: str, mensaje: str) -> None:
    if usuario_id is None:
        return
    db.add(Notificacion(usuario_id=usuario_id, titulo=titulo, mensaje=mensaje))


def parametro(db: Session, clave: str) -> str:
    p = db.query(ParametroAcademico).filter(ParametroAcademico.clave == clave).first()
    if p is not None:
        return p.valor
    return PARAMETROS_POR_DEFECTO[clave][0]


def parametro_num(db: Session, clave: str) -> float:
    return float(parametro(db, clave))
