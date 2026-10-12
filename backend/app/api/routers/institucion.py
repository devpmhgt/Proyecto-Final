from fastapi import APIRouter

from app.api.deps import DB, AdminUser, CurrentUser, get_or_404
from app.models import Institucion, ParametroAcademico
from app.schemas.institucion import InstitucionIn, InstitucionOut, ParametroIn, ParametroOut
from app.services.transversal import auditar

router = APIRouter(prefix="/institucion", tags=["1. Configuración institucional"])


@router.get("", response_model=InstitucionOut | None)
def obtener(db: DB, _: CurrentUser):
    return db.query(Institucion).first()


@router.put("", response_model=InstitucionOut)
def guardar(datos: InstitucionIn, db: DB, admin: AdminUser):
    inst = db.query(Institucion).first()
    if inst is None:
        inst = Institucion()
        db.add(inst)
    for campo, valor in datos.model_dump().items():
        setattr(inst, campo, valor)
    db.flush()
    auditar(db, admin, "actualizar", "institucion", inst.id, datos.model_dump())
    db.commit()
    return inst


@router.get("/parametros", response_model=list[ParametroOut])
def listar_parametros(db: DB, _: CurrentUser):
    return db.query(ParametroAcademico).order_by(ParametroAcademico.clave).all()


@router.put("/parametros", response_model=ParametroOut)
def guardar_parametro(datos: ParametroIn, db: DB, admin: AdminUser):
    p = db.query(ParametroAcademico).filter(ParametroAcademico.clave == datos.clave).first()
    if p is None:
        p = ParametroAcademico(clave=datos.clave)
        db.add(p)
    p.valor = datos.valor
    if datos.descripcion is not None:
        p.descripcion = datos.descripcion
    db.flush()
    auditar(db, admin, "guardar", "parametro", p.id, {"clave": p.clave, "valor": p.valor})
    db.commit()
    return p


@router.delete("/parametros/{parametro_id}", status_code=204)
def eliminar_parametro(parametro_id: int, db: DB, admin: AdminUser):
    p = get_or_404(db, ParametroAcademico, parametro_id)
    auditar(db, admin, "eliminar", "parametro", p.id, {"clave": p.clave})
    db.delete(p)
    db.commit()
