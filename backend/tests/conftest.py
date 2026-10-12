import os

os.environ["DATABASE_URL"] = "sqlite:///./test_saiu.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import seed  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed.cargar(db)
        db.commit()
    with TestClient(app) as c:
        yield c
    engine.dispose()


def login(client, email: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": seed.PASSWORD_DEMO})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
