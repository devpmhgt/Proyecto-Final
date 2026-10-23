"""Unicidad de correos en todo el sistema: cuentas de usuario, estudiantes y docentes.

Un correo identifica a una sola persona. Solo se permite repetirlo entre un expediente
(estudiante/docente) y su propia cuenta de acceso vinculada.
"""

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Docente, Estudiante, Usuario


def normalizar(email: str) -> str:
    return email.strip().lower()


def validar_correo_disponible(
    db: Session,
    email: str,
    *,
    usuario_id: int | None = None,
    estudiante_id: int | None = None,
    docente_id: int | None = None,
) -> str:
    """Lanza 409 si el correo ya pertenece a otra persona. Los *_id excluyen al propio registro que se edita.

    Devuelve el correo normalizado (minúsculas, sin espacios).
    """
    correo = normalizar(email)

    q = db.query(Usuario).filter(func.lower(Usuario.email) == correo)
    if usuario_id:
        q = q.filter(Usuario.id != usuario_id)
    if u := q.first():
        raise _en_uso(correo, f"la cuenta de {u.nombre} ({u.rol.value})")

    q = db.query(Estudiante).filter(func.lower(Estudiante.email) == correo)
    if estudiante_id:
        q = q.filter(Estudiante.id != estudiante_id)
    if e := q.first():
        pista = "" if e.usuario_id else ". Para darle acceso, edite su expediente en Estudiantes y asígnele una contraseña"
        raise _en_uso(correo, f"el estudiante {e.nombres} {e.apellidos} (carné {e.carnet}){pista}")

    q = db.query(Docente).filter(func.lower(Docente.email) == correo)
    if docente_id:
        q = q.filter(Docente.id != docente_id)
    if d := q.first():
        pista = "" if d.usuario_id else ". Para darle acceso, edite su perfil en Docentes y asígnele una contraseña"
        raise _en_uso(correo, f"el docente {d.nombres} {d.apellidos} (código {d.codigo}){pista}")

    return correo


def _en_uso(correo: str, quien: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, f"El correo {correo} ya está registrado para {quien}")
