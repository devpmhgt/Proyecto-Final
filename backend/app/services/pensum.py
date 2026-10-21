"""Importación de pensum (plan de estudios) desde CSV.

Formato esperado (encabezados sin importar mayúsculas ni tildes):
    Ciclo, Código, Nombre del Curso, Créditos, Pre-Requisitos

- Ciclo: "PRIMER CICLO", "Ciclo 3", "3"...
- Pre-Requisitos: códigos de curso separados por ; | / o espacios ("006", "006;008")
  y/o un requisito de créditos ("70 Crs.", "70 créditos").
"""

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models import Carrera, Curso, PlanCurso, PlanEstudio

ORDINALES = {
    "primer": 1, "primero": 1, "segundo": 2, "tercer": 3, "tercero": 3, "cuarto": 4, "quinto": 5,
    "sexto": 6, "septimo": 7, "octavo": 8, "noveno": 9, "decimo": 10, "undecimo": 11,
    "onceavo": 11, "duodecimo": 12, "doceavo": 12,
}

COLUMNAS = {
    "ciclo": ("ciclo", "semestre"),
    "codigo": ("codigo", "cod"),
    "nombre": ("nombre del curso", "nombre", "curso"),
    "creditos": ("creditos", "credito", "cr"),
    "prerrequisitos": ("pre-requisitos", "prerrequisitos", "pre requisitos", "prerequisitos", "requisitos"),
}

_CREDITOS_RE = re.compile(r"(\d+)\s*(crs?\.?|creditos?)", re.IGNORECASE)


def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sin_tildes).strip().lower()


def _ciclo_a_numero(texto: str) -> int | None:
    t = _normalizar(texto)
    if m := re.search(r"\d+", t):
        return int(m.group())
    for palabra in t.split():
        if palabra in ORDINALES:
            return ORDINALES[palabra]
    return None


@dataclass
class FilaPensum:
    linea: int
    ciclo: str
    semestre: int
    codigo: str
    nombre: str
    creditos: int
    prerrequisitos: list[str] = field(default_factory=list)
    creditos_requeridos: int | None = None
    accion: str = "crear"


@dataclass
class ResultadoPensum:
    filas: list[FilaPensum] = field(default_factory=list)
    errores: list[str] = field(default_factory=list)
    advertencias: list[str] = field(default_factory=list)


def _decodificar(contenido: bytes) -> str:
    for codificacion in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return contenido.decode(codificacion)
        except UnicodeDecodeError:
            continue
    return contenido.decode("utf-8", errors="replace")


def leer_csv(contenido: bytes, prefijo: str = "") -> ResultadoPensum:
    res = ResultadoPensum()
    texto = _decodificar(contenido)
    if not texto.strip():
        res.errores.append("El archivo está vacío")
        return res

    try:
        dialecto = csv.Sniffer().sniff(texto.splitlines()[0], delimiters=",;\t")
    except csv.Error:
        dialecto = csv.excel
    lector = csv.reader(io.StringIO(texto), dialecto)
    encabezados = [_normalizar(h) for h in next(lector, [])]

    indices: dict[str, int] = {}
    for clave, alias in COLUMNAS.items():
        for i, h in enumerate(encabezados):
            if h in alias:
                indices[clave] = i
                break
    faltan = [c for c in ("ciclo", "codigo", "nombre", "creditos") if c not in indices]
    if faltan:
        res.errores.append(
            "Faltan columnas obligatorias: " + ", ".join(faltan)
            + ". Se esperan: Ciclo, Código, Nombre del Curso, Créditos, Pre-Requisitos"
        )
        return res

    def celda(fila: list[str], clave: str) -> str:
        i = indices.get(clave)
        return fila[i].strip() if i is not None and i < len(fila) else ""

    vistos: set[str] = set()
    for num, fila in enumerate(lector, start=2):
        if not any(c.strip() for c in fila):
            continue
        codigo_base = celda(fila, "codigo")
        nombre = celda(fila, "nombre")
        if not codigo_base or not nombre:
            res.errores.append(f"Línea {num}: falta el código o el nombre del curso")
            continue
        codigo = f"{prefijo}{codigo_base}"
        if len(codigo) > 20 or len(nombre) > 150:
            res.errores.append(f"Línea {num}: código (máx. 20) o nombre (máx. 150) demasiado largo")
            continue
        if codigo in vistos:
            res.errores.append(f"Línea {num}: el código {codigo} está repetido en el archivo")
            continue
        vistos.add(codigo)

        ciclo = celda(fila, "ciclo")
        semestre = _ciclo_a_numero(ciclo)
        if semestre is None:
            res.errores.append(f"Línea {num}: no se reconoce el ciclo '{ciclo}'")
            continue
        try:
            creditos = int(celda(fila, "creditos"))
            if not 0 <= creditos <= 20:
                raise ValueError
        except ValueError:
            res.errores.append(f"Línea {num}: créditos inválidos '{celda(fila, 'creditos')}'")
            continue

        texto_pre = celda(fila, "prerrequisitos")
        creditos_req = None
        if m := _CREDITOS_RE.search(texto_pre):
            creditos_req = int(m.group(1))
            texto_pre = _CREDITOS_RE.sub(" ", texto_pre)
        pre = [f"{prefijo}{t}" for t in re.split(r"[;,|/\s]+|\by\b", texto_pre) if t.strip()]

        res.filas.append(FilaPensum(num, ciclo, semestre, codigo, nombre, creditos, pre, creditos_req))

    if not res.filas and not res.errores:
        res.errores.append("El archivo no contiene cursos")
    return res


def validar_contra_bd(db: Session, res: ResultadoPensum) -> None:
    """Resuelve prerrequisitos, detecta ciclos y marca qué cursos se crean o actualizan."""
    por_codigo = {f.codigo: f for f in res.filas}
    existentes = {c.codigo for c in db.query(Curso).filter(Curso.codigo.in_(list(por_codigo)))}
    for f in res.filas:
        f.accion = "actualizar" if f.codigo in existentes else "crear"

    externos = {p for f in res.filas for p in f.prerrequisitos if p not in por_codigo}
    en_bd = {c.codigo for c in db.query(Curso).filter(Curso.codigo.in_(list(externos)))} if externos else set()
    for f in res.filas:
        for p in f.prerrequisitos:
            if p == f.codigo:
                res.errores.append(f"Línea {f.linea}: el curso {f.codigo} no puede ser prerrequisito de sí mismo")
            elif p in por_codigo:
                if por_codigo[p].semestre >= f.semestre:
                    res.advertencias.append(
                        f"Línea {f.linea}: {f.codigo} ({f.ciclo}) tiene como prerrequisito a {p}, "
                        f"que está en el mismo ciclo o en uno posterior"
                    )
            elif p not in en_bd:
                res.errores.append(f"Línea {f.linea}: el prerrequisito '{p}' no existe en el archivo ni en el catálogo")

    # Detección de dependencias circulares dentro del archivo
    grafo = {f.codigo: [p for p in f.prerrequisitos if p in por_codigo] for f in res.filas}
    estado: dict[str, int] = {}

    def visitar(c: str, camino: list[str]) -> None:
        estado[c] = 1
        for p in grafo[c]:
            if estado.get(p) == 1:
                res.errores.append("Dependencia circular: " + " → ".join([*camino, c, p]))
            elif p not in estado:
                visitar(p, [*camino, c])
        estado[c] = 2

    for c in grafo:
        if c not in estado:
            visitar(c, [])

    total = sum(f.creditos for f in res.filas)
    for f in res.filas:
        if f.creditos_requeridos and f.creditos_requeridos > total:
            res.advertencias.append(
                f"Línea {f.linea}: {f.codigo} requiere {f.creditos_requeridos} créditos y el plan suma {total}"
            )


def guardar(db: Session, res: ResultadoPensum, carrera: Carrera, plan_codigo: str, plan_nombre: str, anio: int) -> PlanEstudio:
    """Crea/actualiza cursos, prerrequisitos y el plan. No hace commit."""
    cursos: dict[str, Curso] = {c.codigo: c for c in db.query(Curso).filter(Curso.codigo.in_([f.codigo for f in res.filas]))}
    for f in res.filas:
        curso = cursos.get(f.codigo)
        if curso is None:
            curso = Curso(codigo=f.codigo, horas_semana=4)
            db.add(curso)
            cursos[f.codigo] = curso
        curso.nombre = f.nombre
        curso.creditos = f.creditos
        curso.creditos_requeridos = f.creditos_requeridos
    db.flush()

    externos = {p for f in res.filas for p in f.prerrequisitos if p not in cursos}
    if externos:
        cursos.update({c.codigo: c for c in db.query(Curso).filter(Curso.codigo.in_(list(externos)))})
    for f in res.filas:
        cursos[f.codigo].prerrequisitos = [cursos[p] for p in f.prerrequisitos]

    plan = db.query(PlanEstudio).filter(PlanEstudio.codigo == plan_codigo).first()
    if plan is None:
        plan = PlanEstudio(codigo=plan_codigo, carrera_id=carrera.id, vigente=True)
        db.add(plan)
    plan.nombre = plan_nombre
    plan.anio = anio
    plan.cursos = [PlanCurso(curso_id=cursos[f.codigo].id, semestre=f.semestre) for f in res.filas]
    db.flush()
    return plan
