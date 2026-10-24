from tests.conftest import login


def test_login_invalido(client):
    r = client.post("/api/auth/login", json={"email": "admin@saiu.edu", "password": "mala"})
    assert r.status_code == 401


def test_rbac(client):
    est = login(client, "estudiante@saiu.edu")
    assert client.get("/api/estudiantes", headers=est).status_code == 403
    assert client.get("/api/auditoria", headers=est).status_code == 403
    assert client.get("/api/estudiantes").status_code == 401
    admin = login(client, "admin@saiu.edu")
    assert client.get("/api/estudiantes", headers=admin).status_code == 200


def test_prerrequisitos_e_inscripcion(client):
    est = login(client, "estudiante@saiu.edu")
    coord = login(client, "coordinador@saiu.edu")
    periodo = client.get("/api/periodos", headers=est).json()[0]
    cursos = {c["codigo"]: c for c in client.get("/api/cursos", headers=est).json()}

    # Programación II requiere Programación I
    s = client.post("/api/secciones", headers=coord,
                    json={"periodo_id": periodo["id"], "curso_id": cursos["PRG201"]["id"], "codigo": "A", "cupo": 10})
    assert s.status_code == 201
    r = client.post("/api/inscripciones", headers=est, json={"seccion_id": s.json()["id"]})
    assert r.status_code == 422 and "PRG101" in r.json()["detail"]

    secciones = client.get(f"/api/secciones?periodo_id={periodo['id']}", headers=est).json()
    prg101 = next(x for x in secciones if x["curso"]["codigo"] == "PRG101")
    r = client.post("/api/inscripciones", headers=est, json={"seccion_id": prg101["id"]})
    assert r.status_code == 201, r.text
    r2 = client.post("/api/inscripciones", headers=est, json={"seccion_id": prg101["id"]})
    assert r2.status_code == 422

    notifs = client.get("/api/notificaciones", headers=est).json()
    assert any("Inscripción" in n["titulo"] for n in notifs)


def test_choque_de_aula(client):
    coord = login(client, "coordinador@saiu.edu")
    periodo = client.get("/api/periodos", headers=coord).json()[0]
    aulas = {a["codigo"]: a for a in client.get("/api/aulas", headers=coord).json()}
    cursos = {c["codigo"]: c for c in client.get("/api/cursos", headers=coord).json()}
    s = client.post("/api/secciones", headers=coord,
                    json={"periodo_id": periodo["id"], "curso_id": cursos["BDD201"]["id"], "codigo": "A", "cupo": 20}).json()
    r = client.post(f"/api/secciones/{s['id']}/horarios", headers=coord,
                    json={"aula_id": aulas["LAB-1"]["id"], "dia": 1, "hora_inicio": "08:00", "hora_fin": "10:00"})
    assert r.status_code == 409


def test_notas_y_cierre_de_acta(client):
    est = login(client, "estudiante@saiu.edu")
    doc = login(client, "docente@saiu.edu")
    secciones = client.get("/api/secciones", headers=est).json()
    prg101 = next(x for x in secciones if x["curso"]["codigo"] == "PRG101")
    insc = client.post("/api/inscripciones", headers=est, json={"seccion_id": prg101["id"]}).json()

    acta = client.get(f"/api/secciones/{prg101['id']}/acta", headers=doc).json()
    notas = [{"inscripcion_id": insc["id"], "evaluacion_id": e["id"], "nota": 80} for e in acta["evaluaciones"]]
    r = client.put(f"/api/secciones/{prg101['id']}/notas", headers=doc, json={"notas": notas})
    assert r.status_code == 200
    assert float(r.json()["filas"][0]["nota_acumulada"]) == 80.0

    r = client.post(f"/api/secciones/{prg101['id']}/cerrar-acta", headers=doc)
    assert r.status_code == 200
    assert r.json()["acta_cerrada"] is True
    assert r.json()["filas"][0]["estado"] == "aprobado"

    # Acta cerrada: no se pueden modificar notas
    r = client.put(f"/api/secciones/{prg101['id']}/notas", headers=doc, json={"notas": notas})
    assert r.status_code == 422

    admin = login(client, "admin@saiu.edu")
    log = client.get("/api/auditoria?entidad=seccion", headers=admin).json()
    assert any(a["accion"] == "cerrar_acta" for a in log)
    ind = client.get("/api/indicadores", headers=admin).json()
    assert ind["tasa_aprobacion"] == 100.0


def test_limite_de_retiro_dentro_del_periodo(client):
    coord = login(client, "coordinador@saiu.edu")
    base = {"codigo": "2027-B", "nombre": "Segundo semestre 2027", "fecha_inicio": "2027-07-01", "fecha_fin": "2027-11-30"}
    r = client.post("/api/periodos", headers=coord, json={**base, "fecha_limite_retiro": "2027-12-24"})
    assert r.status_code == 422 and "límite de retiro" in r.text
    r = client.post("/api/periodos", headers=coord, json={**base, "fecha_limite_retiro": "2027-09-15"})
    assert r.status_code == 201


def test_periodo_antiguo_fuera_de_regla_se_sigue_listando(client):
    # Un periodo guardado antes de la regla del límite de retiro debe verse para poder corregirlo
    from datetime import date

    from app.db.session import SessionLocal
    from app.models import Periodo

    with SessionLocal() as db:
        db.add(Periodo(codigo="2027-X", nombre="Antiguo", fecha_inicio=date(2027, 1, 1),
                       fecha_fin=date(2027, 6, 1), fecha_limite_retiro=date(2027, 12, 24)))
        db.commit()
    r = client.get("/api/periodos", headers=login(client, "coordinador@saiu.edu"))
    assert r.status_code == 200 and "2027-X" in r.text
