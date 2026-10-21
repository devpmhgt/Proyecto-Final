from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import DB, AdminUser, CurrentUser, GestionUser, get_or_404
from app.models import Carrera, Curso, PlanCurso, PlanEstudio
from app.schemas.catalogo import (
    CarreraIn,
    CarreraOut,
    CursoIn,
    CursoOut,
    ImportacionPensumOut,
    PlanCursoIn,
    PlanIn,
    PlanOut,
)
from app.services import pensum
from app.services.transversal import auditar

router = APIRouter(tags=["4. Catálogo académico"])


# ---------- Carreras ----------

@router.get("/carreras", response_model=list[CarreraOut])
def listar_carreras(db: DB, _: CurrentUser):
    return db.query(Carrera).order_by(Carrera.nombre).all()


@router.post("/carreras", response_model=CarreraOut, status_code=201)
def crear_carrera(datos: CarreraIn, db: DB, gestor: GestionUser):
    if db.query(Carrera).filter(Carrera.codigo == datos.codigo).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una carrera con ese código")
    carrera = Carrera(**datos.model_dump())
    db.add(carrera)
    db.flush()
    auditar(db, gestor, "crear", "carrera", carrera.id, datos.model_dump())
    db.commit()
    return carrera


@router.put("/carreras/{carrera_id}", response_model=CarreraOut)
def actualizar_carrera(carrera_id: int, datos: CarreraIn, db: DB, gestor: GestionUser):
    carrera = get_or_404(db, Carrera, carrera_id)
    for campo, valor in datos.model_dump().items():
        setattr(carrera, campo, valor)
    auditar(db, gestor, "actualizar", "carrera", carrera.id, datos.model_dump())
    db.commit()
    return carrera


# ---------- Cursos y prerrequisitos ----------

def _hay_ciclo(curso_id: int, prerrequisitos: list[Curso]) -> bool:
    """Detecta si asignar estos prerrequisitos crearía una dependencia circular."""
    pendientes, vistos = list(prerrequisitos), set()
    while pendientes:
        c = pendientes.pop()
        if c.id == curso_id:
            return True
        if c.id not in vistos:
            vistos.add(c.id)
            pendientes.extend(c.prerrequisitos)
    return False


def _aplicar_curso(db, curso: Curso, datos: CursoIn) -> None:
    for campo, valor in datos.model_dump(exclude={"prerrequisito_ids"}).items():
        setattr(curso, campo, valor)
    prerreqs = [get_or_404(db, Curso, pid) for pid in set(datos.prerrequisito_ids)]
    if curso.id and _hay_ciclo(curso.id, prerreqs):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Los prerrequisitos forman una dependencia circular")
    curso.prerrequisitos = prerreqs


@router.get("/cursos", response_model=list[CursoOut])
def listar_cursos(db: DB, _: CurrentUser):
    return db.query(Curso).order_by(Curso.codigo).all()


@router.get("/cursos/{curso_id}", response_model=CursoOut)
def obtener_curso(curso_id: int, db: DB, _: CurrentUser):
    return get_or_404(db, Curso, curso_id)


@router.post("/cursos", response_model=CursoOut, status_code=201)
def crear_curso(datos: CursoIn, db: DB, gestor: GestionUser):
    if db.query(Curso).filter(Curso.codigo == datos.codigo).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un curso con ese código")
    curso = Curso()
    _aplicar_curso(db, curso, datos)
    db.add(curso)
    db.flush()
    auditar(db, gestor, "crear", "curso", curso.id, datos.model_dump())
    db.commit()
    return curso


@router.put("/cursos/{curso_id}", response_model=CursoOut)
def actualizar_curso(curso_id: int, datos: CursoIn, db: DB, gestor: GestionUser):
    curso = get_or_404(db, Curso, curso_id)
    _aplicar_curso(db, curso, datos)
    auditar(db, gestor, "actualizar", "curso", curso.id, datos.model_dump())
    db.commit()
    return curso


# ---------- Planes de estudio ----------

@router.get("/planes", response_model=list[PlanOut])
def listar_planes(db: DB, _: CurrentUser, carrera_id: int | None = None):
    q = db.query(PlanEstudio)
    if carrera_id:
        q = q.filter(PlanEstudio.carrera_id == carrera_id)
    return q.order_by(PlanEstudio.anio.desc()).all()


@router.get("/planes/{plan_id}", response_model=PlanOut)
def obtener_plan(plan_id: int, db: DB, _: CurrentUser):
    return get_or_404(db, PlanEstudio, plan_id)


@router.post("/planes", response_model=PlanOut, status_code=201)
def crear_plan(datos: PlanIn, db: DB, gestor: GestionUser):
    get_or_404(db, Carrera, datos.carrera_id)
    plan = PlanEstudio(**datos.model_dump())
    db.add(plan)
    db.flush()
    auditar(db, gestor, "crear", "plan_estudio", plan.id, datos.model_dump())
    db.commit()
    return plan


@router.put("/planes/{plan_id}", response_model=PlanOut)
def actualizar_plan(plan_id: int, datos: PlanIn, db: DB, gestor: GestionUser):
    plan = get_or_404(db, PlanEstudio, plan_id)
    for campo, valor in datos.model_dump().items():
        setattr(plan, campo, valor)
    auditar(db, gestor, "actualizar", "plan_estudio", plan.id, datos.model_dump())
    db.commit()
    return plan


@router.post("/planes/{plan_id}/cursos", response_model=PlanOut)
def agregar_curso_plan(plan_id: int, datos: PlanCursoIn, db: DB, gestor: GestionUser):
    plan = get_or_404(db, PlanEstudio, plan_id)
    get_or_404(db, Curso, datos.curso_id)
    if any(pc.curso_id == datos.curso_id for pc in plan.cursos):
        raise HTTPException(status.HTTP_409_CONFLICT, "El curso ya pertenece al plan")
    plan.cursos.append(PlanCurso(curso_id=datos.curso_id, semestre=datos.semestre))
    auditar(db, gestor, "agregar_curso", "plan_estudio", plan.id, datos.model_dump())
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/planes/{plan_id}/cursos/{curso_id}", response_model=PlanOut)
def quitar_curso_plan(plan_id: int, curso_id: int, db: DB, gestor: GestionUser):
    plan = get_or_404(db, PlanEstudio, plan_id)
    plan.cursos = [pc for pc in plan.cursos if pc.curso_id != curso_id]
    auditar(db, gestor, "quitar_curso", "plan_estudio", plan.id, {"curso_id": curso_id})
    db.commit()
    db.refresh(plan)
    return plan


# ---------- Importación de pensum desde CSV ----------

MAX_CSV_BYTES = 1_000_000


@router.post("/planes/importar-csv", response_model=ImportacionPensumOut)
async def importar_pensum(
    db: DB,
    admin: AdminUser,
    archivo: Annotated[UploadFile, File(description="CSV: Ciclo, Código, Nombre del Curso, Créditos, Pre-Requisitos")],
    carrera_id: Annotated[int, Form()],
    plan_codigo: Annotated[str, Form(min_length=1, max_length=30)],
    plan_nombre: Annotated[str, Form(min_length=1, max_length=150)],
    anio: Annotated[int, Form(ge=1900, le=2200)],
    prefijo: Annotated[str, Form(max_length=10)] = "",
    confirmar: Annotated[bool, Form()] = False,
):
    """Con `confirmar=false` solo valida y devuelve la vista previa; con `true` guarda (todo o nada)."""
    carrera = get_or_404(db, Carrera, carrera_id)
    contenido = await archivo.read(MAX_CSV_BYTES + 1)
    if len(contenido) > MAX_CSV_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "El archivo supera 1 MB")

    res = pensum.leer_csv(contenido, prefijo.strip())
    if res.filas:
        pensum.validar_contra_bd(db, res)
    plan_existente = db.query(PlanEstudio).filter(PlanEstudio.codigo == plan_codigo).first()
    if plan_existente and plan_existente.carrera_id != carrera.id:
        res.errores.append(f"El plan {plan_codigo} ya existe y pertenece a otra carrera")
    elif plan_existente:
        res.advertencias.append(f"El plan {plan_codigo} ya existe: su lista de cursos se reemplazará por la del archivo")

    plan_id = None
    if confirmar:
        if res.errores:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Corrija los errores del archivo antes de importar")
        plan = pensum.guardar(db, res, carrera, plan_codigo, plan_nombre, anio)
        plan_id = plan.id
        auditar(db, admin, "importar_pensum", "plan_estudio", plan.id, {
            "archivo": archivo.filename, "cursos": len(res.filas),
            "creados": sum(f.accion == "crear" for f in res.filas),
            "actualizados": sum(f.accion == "actualizar" for f in res.filas),
        })
        db.commit()

    return ImportacionPensumOut(
        cursos=[vars(f) for f in res.filas],
        errores=res.errores,
        advertencias=res.advertencias,
        total_creditos=sum(f.creditos for f in res.filas),
        ciclos=len({f.semestre for f in res.filas}),
        guardado=confirmar,
        plan_id=plan_id,
    )
