import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_opciones: dict = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    _opciones["connect_args"] = {"check_same_thread": False}
elif settings.database_url.startswith("postgresql"):
    # El pooler de Supabase en modo transacción (puerto 6543) no admite sentencias preparadas
    _opciones["connect_args"] = {"prepare_threshold": None}
    # Pocas conexiones por proceso: el pooler de Supabase en modo sesión admite solo 15 clientes
    # en total, compartidos por todos los backends que usan la misma base
    _opciones.update(pool_size=3, max_overflow=2, pool_recycle=300)
    if os.environ.get("VERCEL"):
        # En serverless cada instancia es efímera: el pooler de Supabase administra las conexiones
        _opciones = {"poolclass": NullPool, "connect_args": _opciones["connect_args"]}

engine = create_engine(settings.database_url, **_opciones)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
