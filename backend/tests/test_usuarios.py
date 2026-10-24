from tests.conftest import login


def _id(client, h, email):
    return next(u["id"] for u in client.get("/api/usuarios", headers=h).json() if u["email"] == email)


def test_usuarios_solo_crea_admin_y_coordinador(client):
    admin = login(client, "admin@saiu.edu")
    for rol in ("estudiante", "docente"):
        r = client.post("/api/usuarios", headers=admin,
                        json={"email": f"nuevo.{rol}@saiu.edu", "nombre": "Prueba", "rol": rol, "password": "12345678"})
        assert r.status_code == 422 and "expediente" in r.text
    r = client.post("/api/usuarios", headers=admin,
                    json={"email": "nuevo.coord@saiu.edu", "nombre": "Prueba", "rol": "coordinador", "password": "12345678"})
    assert r.status_code == 201


def test_cambio_de_rol_restringido(client):
    admin = login(client, "admin@saiu.edu")
    coord = _id(client, admin, "coordinador@saiu.edu")
    docente = _id(client, admin, "docente@saiu.edu")
    # Una cuenta con expediente no cambia de rol (el docente dejaría de encontrar sus secciones)
    r = client.patch(f"/api/usuarios/{docente}", headers=admin, json={"rol": "estudiante"})
    assert r.status_code == 422
    # Personal no pasa a estudiante o docente
    assert client.patch(f"/api/usuarios/{coord}", headers=admin, json={"rol": "docente"}).status_code == 422
    # Entre admin y coordinador sí
    assert client.patch(f"/api/usuarios/{coord}", headers=admin, json={"rol": "admin"}).status_code == 200
    # El admin no se desactiva ni se quita el rol a sí mismo
    yo = _id(client, admin, "admin@saiu.edu")
    assert client.patch(f"/api/usuarios/{yo}", headers=admin, json={"activo": False}).status_code == 422
    assert client.patch(f"/api/usuarios/{yo}", headers=admin, json={"rol": "coordinador"}).status_code == 422


def test_nombre_del_expediente_se_refleja_en_la_cuenta(client):
    admin = login(client, "admin@saiu.edu")
    doc = next(d for d in client.get("/api/docentes", headers=admin).json() if d["email"] == "docente@saiu.edu")
    r = client.patch(f"/api/docentes/{doc['id']}", headers=admin, json={"nombres": "Roberto Carlos"})
    assert r.status_code == 200
    nombre = next(u["nombre"] for u in client.get("/api/usuarios", headers=admin).json() if u["email"] == "docente@saiu.edu")
    assert nombre == f"Roberto Carlos {doc['apellidos']}"


def test_quitar_prerrequisitos(client):
    admin = login(client, "admin@saiu.edu")
    curso = next(c for c in client.get("/api/cursos", headers=admin).json() if c["prerrequisitos"])
    datos = {k: curso[k] for k in ("codigo", "nombre", "creditos", "horas_semana", "descripcion", "creditos_requeridos")}
    r = client.put(f"/api/cursos/{curso['id']}", headers=admin, json={**datos, "prerrequisito_ids": []})
    assert r.status_code == 200 and r.json()["prerrequisitos"] == []


def test_reglas_academicas(client):
    admin = login(client, "admin@saiu.edu")
    reglas = client.get("/api/institucion/parametros", headers=admin).json()
    assert [r["clave"] for r in reglas] == ["nota_minima_aprobacion", "max_creditos_periodo", "max_retiros_periodo"]
    r = client.put("/api/institucion/parametros", headers=admin, json={"clave": "max_creditos_periodo", "valor": "30"})
    assert r.status_code == 200 and r.json()["valor"] == "30"
    # Fuera de rango, no numérico o una clave que el sistema no usa
    for clave, valor in (("nota_minima_aprobacion", "150"), ("max_retiros_periodo", "dos"), ("dias", "3")):
        assert client.put("/api/institucion/parametros", headers=admin, json={"clave": clave, "valor": valor}).status_code == 422
