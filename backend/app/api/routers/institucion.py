from fastapi import APIRouter, HTTPException, status

from app.api.deps import DB, AdminUser, CurrentUser
from app.models import Institucion, ParametroAcademico
from app.schemas.institucion import InstitucionIn, InstitucionOut, ParametroIn, ParametroOut
from app.services.transversal import PARAMETROS_POR_DEFECTO, RANGOS_PARAMETROS, auditar, parametro

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
    """Las reglas que aplica el sistema, con su valor guardado o el valor por defecto."""
    return [
        ParametroOut(clave=clave, valor=parametro(db, clave), descripcion=desc,
                     minimo=RANGOS_PARAMETROS[clave][0], maximo=RANGOS_PARAMETROS[clave][1])
        for clave, (_, desc) in PARAMETROS_POR_DEFECTO.items()
    ]


@router.put("/parametros", response_model=ParametroOut)
def guardar_parametro(datos: ParametroIn, db: DB, admin: AdminUser):
    if datos.clave not in PARAMETROS_POR_DEFECTO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"El parámetro {datos.clave} no existe")
    minimo, maximo = RANGOS_PARAMETROS[datos.clave]
    descripcion = PARAMETROS_POR_DEFECTO[datos.clave][1]
    try:
        valor = int(datos.valor.strip())
    except ValueError:
        valor = None
    if valor is None or not minimo <= valor <= maximo:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            f"{descripcion}: debe ser un número entero entre {minimo} y {maximo}")
    p = db.query(ParametroAcademico).filter(ParametroAcademico.clave == datos.clave).first()
    if p is None:
        p = ParametroAcademico(clave=datos.clave)
        db.add(p)
    p.valor, p.descripcion = str(valor), descripcion
    db.flush()
    auditar(db, admin, "guardar", "parametro", p.id, {"clave": p.clave, "valor": p.valor})
    db.commit()
    return ParametroOut(clave=p.clave, valor=p.valor, descripcion=descripcion, minimo=minimo, maximo=maximo)
