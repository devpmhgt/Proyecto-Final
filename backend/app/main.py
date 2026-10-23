from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.api.routers import auth, catalogo, escolar, institucion, oferta, personas, transversal
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API REST del Sistema Académico Integral Universitario (SAIU).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def registro_duplicado(_: Request, exc: IntegrityError):
    # Red de seguridad: si dos peticiones simultáneas pasan la validación, la restricción UNIQUE de la base decide
    return JSONResponse(status_code=409, content={"detail": "El registro ya existe (correo, código o carné duplicado)"})


for r in (auth, institucion, personas, catalogo, oferta, escolar, transversal):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health", tags=["Sistema"])
def health():
    return {"status": "ok"}
