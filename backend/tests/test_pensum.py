from pathlib import Path

from app.db.session import SessionLocal
from app.models import Carrera, Curso, EstadoInscripcion, Estudiante, Inscripcion, PlanEstudio, Seccion
from tests.conftest import login

CSV = (Path(__file__).parent / "data" / "pensum_ingenieria_en_sistemas.csv").read_bytes()


def _importar(client, headers, contenido=CSV, confirmar=False, **extra):
    with SessionLocal() as db:
        carrera_id = db.query(Carrera).filter(Carrera.codigo == "ISC").one().id
    datos = {"carrera_id": carrera_id, "plan_codigo": "ISC-2026", "plan_nombre": "Pensum ISC 2026",
             "anio": 2026, "prefijo": "", "confirmar": str(confirmar).lower(), **extra}
    return client.post("/api/planes/importar-csv", headers=headers, data=datos,
                       files={"archivo": ("pensum.csv", contenido, "text/csv")})


def test_vista_previa_no_guarda(client):
    admin = login(client, "admin@saiu.edu")
    r = _importar(client, admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["errores"] == [] and body["guardado"] is False
    assert len(body["cursos"]) == 50 and body["ciclos"] == 10 and body["total_creditos"] == 250
    fisica1 = next(c for c in body["cursos"] if c["codigo"] == "011")
    assert fisica1["semestre"] == 3 and fisica1["prerrequisitos"] == ["006"]
    metodos = next(c for c in body["cursos"] if c["codigo"] == "021")
    assert metodos["creditos_requeridos"] == 70 and metodos["prerrequisitos"] == []
    with SessionLocal() as db:
        assert db.query(Curso).filter(Curso.codigo == "011").first() is None


def test_importar_y_reimportar(client):
    admin = login(client, "admin@saiu.edu")
    r = _importar(client, admin, confirmar=True)
    assert r.status_code == 200 and r.json()["guardado"] is True
    with SessionLocal() as db:
        plan = db.query(PlanEstudio).filter(PlanEstudio.codigo == "ISC-2026").one()
        assert len(plan.cursos) == 50
        prog2 = db.query(Curso).filter(Curso.codigo == "017").one()
        assert [p.codigo for p in prog2.prerrequisitos] == ["012"]
    # Reimportar actualiza en lugar de duplicar
    r = _importar(client, admin)
    assert all(c["accion"] == "actualizar" for c in r.json()["cursos"])


def test_errores_y_permisos(client):
    admin = login(client, "admin@saiu.edu")
    malo = "Ciclo,Código,Nombre del Curso,Créditos,Pre-Requisitos\nPRIMER CICLO,A1,Curso A,4,ZZZ\nRARO,A2,Curso B,x,\n"
    body = _importar(client, admin, contenido=malo.encode()).json()
    assert len(body["errores"]) == 2
    assert _importar(client, admin, contenido=malo.encode(), confirmar=True).status_code == 422
    coord = login(client, "coordinador@saiu.edu")
    assert _importar(client, coord).status_code == 403


def test_avance_estudiante(client):
    admin = login(client, "admin@saiu.edu")
    _importar(client, admin, confirmar=True)
    with SessionLocal() as db:
        est = db.query(Estudiante).filter(Estudiante.carnet == "2026001").one()
        est.plan_id = db.query(PlanEstudio).filter(PlanEstudio.codigo == "ISC-2026").one().id
        # Simula historial: aprobó Precálculo (006) y Algoritmos (008)
        seccion_base = db.query(Seccion).first()
        for codigo in ("006", "008"):
            curso = db.query(Curso).filter(Curso.codigo == codigo).one()
            s = Seccion(periodo_id=seccion_base.periodo_id, curso_id=curso.id, codigo="H", cupo=10, acta_cerrada=True)
            db.add(s)
            db.flush()
            db.add(Inscripcion(estudiante_id=est.id, seccion_id=s.id, estado=EstadoInscripcion.APROBADO, nota_final=85))
        db.commit()

    est_h = login(client, "estudiante@saiu.edu")
    r = client.get("/api/estudiantes/me/avance", headers=est_h)
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["creditos_totales"] == 250 and a["creditos_aprobados"] == 10 and a["cursos_aprobados"] == 2
    cursos = {c["codigo"]: c for ciclo in a["ciclos"] for c in ciclo["cursos"]}
    assert cursos["006"]["estado"] == "aprobado"
    assert cursos["011"]["estado"] == "disponible"           # Física I: requiere 006 ✔
    assert cursos["017"]["estado"] == "bloqueado" and cursos["017"]["faltantes"] == ["012"]
    assert cursos["021"]["estado"] == "bloqueado" and cursos["021"]["creditos_faltantes"] == 60
    assert cursos["011"]["id"] in cursos["006"]["desbloquea"]

    # Un estudiante no puede ver el avance de otro por id; administración sí
    assert client.get(f"/api/estudiantes/{a['estudiante']['id']}/avance", headers=est_h).status_code == 403
    assert client.get(f"/api/estudiantes/{a['estudiante']['id']}/avance", headers=admin).status_code == 200
