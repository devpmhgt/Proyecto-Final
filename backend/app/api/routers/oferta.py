from fastapi import APIRouter, HTTPException, status

from app.api.deps import DB, CurrentUser, GestionUser, get_or_404
from app.models import Aula, Curso, Docente, EstadoPeriodo, Horario, Periodo, Seccion
from app.schemas.oferta import (
    AulaIn,
    AulaOut,
    HorarioIn,
    PeriodoIn,
    PeriodoOut,
    SeccionIn,
    SeccionOut,
    SeccionUpdate,
)
from app.services.escolar import inscritos_en
from app.services.planificacion import validar_horario
from app.services.transversal import auditar

router = APIRouter(tags=["5. Oferta y planificación"])


def seccion_out(db, s: Seccion) -> SeccionOut:
    out = SeccionOut.model_validate(s)
    out.inscritos = inscritos_en(db, s.id)
    return out


# ---------- Periodos ----------

@router.get("/periodos", response_model=list[PeriodoOut])
def listar_periodos(db: DB, _: CurrentUser):
    return db.query(Periodo).order_by(Periodo.fecha_inicio.desc()).all()


@router.post("/periodos", response_model=PeriodoOut, status_code=201)
def crear_periodo(datos: PeriodoIn, db: DB, gestor: GestionUser):
    if db.query(Periodo).filter(Periodo.codigo == datos.codigo).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un periodo con ese código")
    periodo = Periodo(**datos.model_dump())
    db.add(periodo)
    db.flush()
    auditar(db, gestor, "crear", "periodo", periodo.id, datos.model_dump())
    db.commit()
    return periodo


@router.put("/periodos/{periodo_id}", response_model=PeriodoOut)
def actualizar_periodo(periodo_id: int, datos: PeriodoIn, db: DB, gestor: GestionUser):
    periodo = get_or_404(db, Periodo, periodo_id)
    for campo, valor in datos.model_dump().items():
        setattr(periodo, campo, valor)
    auditar(db, gestor, "actualizar", "periodo", periodo.id, datos.model_dump())
    db.commit()
    return periodo


# ---------- Aulas ----------

@router.get("/aulas", response_model=list[AulaOut])
def listar_aulas(db: DB, _: CurrentUser):
    return db.query(Aula).order_by(Aula.codigo).all()


@router.post("/aulas", response_model=AulaOut, status_code=201)
def crear_aula(datos: AulaIn, db: DB, gestor: GestionUser):
    if db.query(Aula).filter(Aula.codigo == datos.codigo).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un aula con ese código")
    aula = Aula(**datos.model_dump())
    db.add(aula)
    db.flush()
    auditar(db, gestor, "crear", "aula", aula.id, datos.model_dump())
    db.commit()
    return aula


@router.put("/aulas/{aula_id}", response_model=AulaOut)
def actualizar_aula(aula_id: int, datos: AulaIn, db: DB, gestor: GestionUser):
    aula = get_or_404(db, Aula, aula_id)
    for campo, valor in datos.model_dump().items():
        setattr(aula, campo, valor)
    auditar(db, gestor, "actualizar", "aula", aula.id, datos.model_dump())
    db.commit()
    return aula


# ---------- Secciones y horarios ----------

@router.get("/secciones", response_model=list[SeccionOut])
def listar_secciones(
    db: DB, _: CurrentUser, periodo_id: int | None = None, curso_id: int | None = None, docente_id: int | None = None
):
    q = db.query(Seccion)
    if periodo_id:
        q = q.filter(Seccion.periodo_id == periodo_id)
    if curso_id:
        q = q.filter(Seccion.curso_id == curso_id)
    if docente_id:
        q = q.filter(Seccion.docente_id == docente_id)
    return [seccion_out(db, s) for s in q.order_by(Seccion.curso_id, Seccion.codigo).all()]


@router.get("/secciones/{seccion_id}", response_model=SeccionOut)
def obtener_seccion(seccion_id: int, db: DB, _: CurrentUser):
    return seccion_out(db, get_or_404(db, Seccion, seccion_id))


@router.post("/secciones", response_model=SeccionOut, status_code=201)
def crear_seccion(datos: SeccionIn, db: DB, gestor: GestionUser):
    periodo = get_or_404(db, Periodo, datos.periodo_id)
    if periodo.estado == EstadoPeriodo.CERRADO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El periodo está cerrado")
    get_or_404(db, Curso, datos.curso_id)
    if datos.docente_id:
        get_or_404(db, Docente, datos.docente_id)
    duplicada = (
        db.query(Seccion)
        .filter_by(periodo_id=datos.periodo_id, curso_id=datos.curso_id, codigo=datos.codigo)
        .first()
    )
    if duplicada:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe esa sección para el curso en el periodo")
    seccion = Seccion(**datos.model_dump())
    db.add(seccion)
    db.flush()
    auditar(db, gestor, "crear", "seccion", seccion.id, datos.model_dump())
    db.commit()
    return seccion_out(db, seccion)


@router.patch("/secciones/{seccion_id}", response_model=SeccionOut)
def actualizar_seccion(seccion_id: int, datos: SeccionUpdate, db: DB, gestor: GestionUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "cupo" in cambios and cambios["cupo"] < inscritos_en(db, seccion.id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El cupo no puede ser menor a los inscritos actuales")
    for campo, valor in cambios.items():
        setattr(seccion, campo, valor)
    # Revalidar horarios existentes con el nuevo docente/cupo
    for h in seccion.horarios:
        validar_horario(db, seccion, h.aula, h.dia, h.hora_inicio, h.hora_fin)
    auditar(db, gestor, "actualizar", "seccion", seccion.id, cambios)
    db.commit()
    return seccion_out(db, seccion)


@router.post("/secciones/{seccion_id}/horarios", response_model=SeccionOut, status_code=201)
def agregar_horario(seccion_id: int, datos: HorarioIn, db: DB, gestor: GestionUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    aula = get_or_404(db, Aula, datos.aula_id)
    validar_horario(db, seccion, aula, datos.dia, datos.hora_inicio, datos.hora_fin)
    seccion.horarios.append(Horario(**datos.model_dump()))
    auditar(db, gestor, "agregar_horario", "seccion", seccion.id, datos.model_dump())
    db.commit()
    db.refresh(seccion)
    return seccion_out(db, seccion)


@router.delete("/secciones/{seccion_id}/horarios/{horario_id}", response_model=SeccionOut)
def eliminar_horario(seccion_id: int, horario_id: int, db: DB, gestor: GestionUser):
    seccion = get_or_404(db, Seccion, seccion_id)
    seccion.horarios = [h for h in seccion.horarios if h.id != horario_id]
    auditar(db, gestor, "eliminar_horario", "seccion", seccion.id, {"horario_id": horario_id})
    db.commit()
    db.refresh(seccion)
    return seccion_out(db, seccion)
