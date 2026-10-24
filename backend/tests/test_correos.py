from tests.conftest import login


def _estudiante(**extra):
    return {"carnet": "2026999", "nombres": "Prueba", "apellidos": "Correo", "email": "nuevo@saiu.edu",
            "carrera_id": 1, **extra}


def _docente(**extra):
    return {"codigo": "D999", "nombres": "Prueba", "apellidos": "Correo", "email": "nuevo@saiu.edu", **extra}


def test_correo_de_cuenta_no_se_reutiliza(client):
    admin = login(client, "admin@saiu.edu")
    # Estudiante (sin cuenta) con el correo del coordinador
    r = client.post("/api/estudiantes", headers=admin, json=_estudiante(email="coordinador@saiu.edu"))
    assert r.status_code == 409 and "coordinador@saiu.edu" in r.json()["detail"]
    # Docente con el correo del admin, en mayúsculas
    r = client.post("/api/docentes", headers=admin, json=_docente(email="ADMIN@saiu.edu"))
    assert r.status_code == 409
    # Usuario nuevo con un correo repetido
    r = client.post("/api/usuarios", headers=admin,
                    json={"email": "Docente@SAIU.edu", "nombre": "Prueba", "rol": "admin", "password": "12345678"})
    assert r.status_code == 409


def test_correo_de_expediente_sin_cuenta_no_se_reutiliza(client):
    admin = login(client, "admin@saiu.edu")
    # mgarcia@saiu.edu es una estudiante del seed sin cuenta de acceso
    r = client.post("/api/usuarios", headers=admin,
                    json={"email": "mgarcia@saiu.edu", "nombre": "Prueba", "rol": "coordinador", "password": "12345678"})
    assert r.status_code == 409 and "estudiante" in r.json()["detail"]
    # cmendez@saiu.edu es un docente sin cuenta
    r = client.post("/api/estudiantes", headers=admin, json=_estudiante(email="cmendez@saiu.edu"))
    assert r.status_code == 409 and "docente" in r.json()["detail"]


def test_crear_y_editar_con_correo_libre(client):
    admin = login(client, "admin@saiu.edu")
    r = client.post("/api/estudiantes", headers=admin, json=_estudiante(email="  Nuevo@SAIU.edu ", password="clave12345"))
    assert r.status_code == 201, r.text
    est = r.json()
    assert est["email"] == "nuevo@saiu.edu"
    # Puede iniciar sesión con el correo en cualquier capitalización
    assert client.post("/api/auth/login", json={"email": "NUEVO@saiu.edu", "password": "clave12345"}).status_code == 200

    # Editar sin cambiar su propio correo no choca consigo mismo
    r = client.patch(f"/api/estudiantes/{est['id']}", headers=admin, json={"email": "nuevo@saiu.edu", "telefono": "555"})
    assert r.status_code == 200
    # Cambiar a un correo ajeno se rechaza
    r = client.patch(f"/api/estudiantes/{est['id']}", headers=admin, json={"email": "docente@saiu.edu"})
    assert r.status_code == 409
    # Cambiar a uno libre actualiza también la cuenta de acceso
    r = client.patch(f"/api/estudiantes/{est['id']}", headers=admin, json={"email": "otro@saiu.edu"})
    assert r.status_code == 200 and r.json()["email"] == "otro@saiu.edu"
    assert client.post("/api/auth/login", json={"email": "otro@saiu.edu", "password": "clave12345"}).status_code == 200
    # El carné repetido sigue rechazándose
    assert client.post("/api/estudiantes", headers=admin, json=_estudiante(email="libre@saiu.edu")).status_code == 409


def test_dar_acceso_a_expediente_existente(client):
    admin = login(client, "admin@saiu.edu")
    est = next(e for e in client.get("/api/estudiantes", headers=admin).json() if e["email"] == "mgarcia@saiu.edu")
    assert est["usuario_id"] is None
    r = client.patch(f"/api/estudiantes/{est['id']}", headers=admin, json={"password": "acceso12345"})
    assert r.status_code == 200 and r.json()["usuario_id"] is not None
    h = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "mgarcia@saiu.edu", "password": "acceso12345"}).json()["access_token"]}
    assert client.get("/api/estudiantes/me", headers=h).json()["id"] == est["id"]


def _cuenta_suelta(email: str, nombre: str, password: str) -> dict:
    from app.core.security import hash_password
    from app.db.session import SessionLocal
    from app.models import Rol, Usuario

    with SessionLocal() as db:
        u = Usuario(email=email, nombre=nombre, rol=Rol.ESTUDIANTE, hashed_password=hash_password(password))
        db.add(u)
        db.commit()
        return {"id": u.id}


def test_vincular_y_desvincular_cuenta(client):
    admin = login(client, "admin@saiu.edu")
    # Cuenta suelta de estudiante (de antes de la regla de Usuarios, o liberada al desvincular) y expediente sin cuenta (mgarcia)
    cuenta = _cuenta_suelta("maria.garcia@saiu.edu", "Cuenta suelta", "maria12345")
    libres = client.get("/api/cuentas-sin-expediente?rol=estudiante", headers=admin).json()
    assert cuenta["id"] in [u["id"] for u in libres]
    est = next(e for e in client.get("/api/estudiantes", headers=admin).json() if e["email"] == "mgarcia@saiu.edu")

    r = client.post(f"/api/estudiantes/{est['id']}/vincular", headers=admin, json={"usuario_id": cuenta["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["usuario_id"] == cuenta["id"] and r.json()["email"] == "maria.garcia@saiu.edu"
    # La cuenta adopta el nombre del expediente
    nombre = next(u["nombre"] for u in client.get("/api/usuarios", headers=admin).json() if u["id"] == cuenta["id"])
    assert nombre == f"{est['nombres']} {est['apellidos']}"
    h = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "maria.garcia@saiu.edu", "password": "maria12345"}).json()["access_token"]}
    assert client.get("/api/estudiantes/me", headers=h).json()["id"] == est["id"]
    assert cuenta["id"] not in [u["id"] for u in client.get("/api/cuentas-sin-expediente?rol=estudiante", headers=admin).json()]

    # No se puede vincular dos veces ni usar una cuenta con otro rol
    assert client.post(f"/api/estudiantes/{est['id']}/vincular", headers=admin, json={"usuario_id": cuenta["id"]}).status_code == 409
    coord_id = next(u["id"] for u in client.get("/api/usuarios", headers=admin).json() if u["rol"] == "coordinador")
    r = client.post(f"/api/estudiantes/{est['id']}/desvincular", headers=admin)
    assert r.status_code == 200 and r.json()["usuario_id"] is None
    assert client.post(f"/api/estudiantes/{est['id']}/vincular", headers=admin, json={"usuario_id": coord_id}).status_code == 422
    # Coordinación puede vincular; un estudiante no
    assert client.get("/api/cuentas-sin-expediente?rol=estudiante", headers=h).status_code == 403


def test_eliminar_estudiante_y_docente(client):
    admin = login(client, "admin@saiu.edu")
    coord = login(client, "coordinador@saiu.edu")
    nuevo = client.post("/api/estudiantes", headers=admin, json=_estudiante(email="borrar@saiu.edu", password="borrar12345")).json()

    assert client.delete(f"/api/estudiantes/{nuevo['id']}", headers=coord).status_code == 403
    assert client.delete(f"/api/estudiantes/{nuevo['id']}", headers=admin).status_code == 204
    assert all(e["id"] != nuevo["id"] for e in client.get("/api/estudiantes", headers=admin).json())
    # Su cuenta queda desactivada (no puede entrar) pero se conserva
    assert client.post("/api/auth/login", json={"email": "borrar@saiu.edu", "password": "borrar12345"}).status_code == 403

    # Estudiante con historial: no se elimina
    est = login(client, "estudiante@saiu.edu")
    seccion = next(s for s in client.get("/api/secciones", headers=est).json() if s["curso"]["codigo"] == "PRG101")
    client.post("/api/inscripciones", headers=est, json={"seccion_id": seccion["id"]})
    luis = next(e for e in client.get("/api/estudiantes", headers=admin).json() if e["carnet"] == "2026001")
    r = client.delete(f"/api/estudiantes/{luis['id']}", headers=admin)
    assert r.status_code == 409 and "inactivo" in r.json()["detail"]

    # Docente con secciones: no se elimina; sin secciones: sí
    docentes = client.get("/api/docentes", headers=admin).json()
    ana = next(d for d in docentes if d["codigo"] == "D001")
    assert client.delete(f"/api/docentes/{ana['id']}", headers=admin).status_code == 409
    libre = client.post("/api/docentes", headers=admin, json=_docente(email="docborrar@saiu.edu")).json()
    assert client.delete(f"/api/docentes/{libre['id']}", headers=admin).status_code == 204
