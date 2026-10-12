"""Crea las tablas y carga datos de demostración.

Uso:  python seed.py            (crea tablas y datos si la base está vacía)
      python seed.py --reset    (borra y recrea todas las tablas)
"""

import sys
from datetime import date, time

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    Aula,
    Carrera,
    Curso,
    DisponibilidadDocente,
    Docente,
    EstadoPeriodo,
    Estudiante,
    Evaluacion,
    Horario,
    Institucion,
    ParametroAcademico,
    Periodo,
    PlanCurso,
    PlanEstudio,
    Rol,
    Seccion,
    Usuario,
)
from app.services.transversal import PARAMETROS_POR_DEFECTO

PASSWORD_DEMO = "Saiu2026!"


def usuario(db, email, nombre, rol):
    u = Usuario(email=email, nombre=nombre, rol=rol, hashed_password=hash_password(PASSWORD_DEMO))
    db.add(u)
    db.flush()
    return u


def cargar(db):
    db.add(Institucion(nombre="Universidad Demo", siglas="UD", direccion="Ciudad Universitaria",
                       telefono="+502 2222-0000", email="info@universidad.edu", sitio_web="https://universidad.edu"))
    for clave, (valor, desc) in PARAMETROS_POR_DEFECTO.items():
        db.add(ParametroAcademico(clave=clave, valor=valor, descripcion=desc))

    usuario(db, "admin@saiu.edu", "Administrador SAIU", Rol.ADMIN)
    usuario(db, "coordinador@saiu.edu", "Coordinación Académica", Rol.COORDINADOR)

    sis = Carrera(codigo="ISC", nombre="Ingeniería en Sistemas", facultad="Ingeniería")
    adm = Carrera(codigo="ADE", nombre="Administración de Empresas", facultad="Ciencias Económicas")
    db.add_all([sis, adm])
    db.flush()

    prog1 = Curso(codigo="PRG101", nombre="Programación I", creditos=4)
    mate1 = Curso(codigo="MAT101", nombre="Matemática I", creditos=4)
    prog2 = Curso(codigo="PRG201", nombre="Programación II", creditos=4, prerrequisitos=[prog1])
    bd1 = Curso(codigo="BDD201", nombre="Bases de Datos I", creditos=4, prerrequisitos=[prog1])
    web = Curso(codigo="WEB301", nombre="Desarrollo Web", creditos=5, prerrequisitos=[prog2, bd1])
    db.add_all([prog1, mate1, prog2, bd1, web])
    db.flush()

    plan = PlanEstudio(carrera_id=sis.id, codigo="ISC-2024", nombre="Plan ISC 2024", anio=2024)
    plan.cursos = [PlanCurso(curso_id=prog1.id, semestre=1), PlanCurso(curso_id=mate1.id, semestre=1),
                   PlanCurso(curso_id=prog2.id, semestre=2), PlanCurso(curso_id=bd1.id, semestre=2),
                   PlanCurso(curso_id=web.id, semestre=3)]
    db.add(plan)
    db.flush()

    u_doc = usuario(db, "docente@saiu.edu", "Ana López", Rol.DOCENTE)
    doc = Docente(usuario_id=u_doc.id, codigo="D001", nombres="Ana", apellidos="López",
                  email="docente@saiu.edu", especialidad="Ingeniería de Software")
    doc.disponibilidad = [DisponibilidadDocente(dia=d, hora_inicio=time(7), hora_fin=time(13)) for d in range(1, 6)]
    doc2 = Docente(codigo="D002", nombres="Carlos", apellidos="Méndez", email="cmendez@saiu.edu",
                   especialidad="Matemática")
    db.add_all([doc, doc2])

    u_est = usuario(db, "estudiante@saiu.edu", "Luis Pérez", Rol.ESTUDIANTE)
    db.add(Estudiante(usuario_id=u_est.id, carnet="2026001", nombres="Luis", apellidos="Pérez",
                      email="estudiante@saiu.edu", carrera_id=sis.id, plan_id=plan.id,
                      fecha_ingreso=date(2026, 1, 15)))
    db.add(Estudiante(carnet="2026002", nombres="María", apellidos="García", email="mgarcia@saiu.edu",
                      carrera_id=sis.id, plan_id=plan.id, fecha_ingreso=date(2026, 1, 15)))

    a1 = Aula(codigo="A-101", edificio="Edificio A", capacidad=40)
    a2 = Aula(codigo="LAB-1", edificio="Edificio B", capacidad=25, tipo="laboratorio")
    db.add_all([a1, a2])

    periodo = Periodo(codigo="2026-2", nombre="Segundo semestre 2026", fecha_inicio=date(2026, 7, 15),
                      fecha_fin=date(2026, 11, 30), fecha_limite_retiro=date(2026, 12, 31),
                      estado=EstadoPeriodo.INSCRIPCION)
    db.add(periodo)
    db.flush()

    s1 = Seccion(periodo_id=periodo.id, curso_id=prog1.id, docente_id=doc.id, codigo="A", cupo=25)
    s1.horarios = [Horario(aula_id=a2.id, dia=1, hora_inicio=time(7), hora_fin=time(9)),
                   Horario(aula_id=a2.id, dia=3, hora_inicio=time(7), hora_fin=time(9))]
    s2 = Seccion(periodo_id=periodo.id, curso_id=mate1.id, docente_id=doc2.id, codigo="A", cupo=40)
    s2.horarios = [Horario(aula_id=a1.id, dia=2, hora_inicio=time(9), hora_fin=time(11))]
    db.add_all([s1, s2])
    db.flush()
    db.add_all([Evaluacion(seccion_id=s1.id, nombre="Parcial 1", ponderacion=25),
                Evaluacion(seccion_id=s1.id, nombre="Parcial 2", ponderacion=25),
                Evaluacion(seccion_id=s1.id, nombre="Proyecto", ponderacion=20),
                Evaluacion(seccion_id=s1.id, nombre="Examen final", ponderacion=30)])


def main():
    import app.models  # noqa: F401  (registra los modelos en el metadata)

    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(Usuario).first():
            print("La base ya contiene datos; use --reset para recrearla.")
            return
        cargar(db)
        db.commit()
    print("Datos de demostración cargados. Contraseña de todas las cuentas:", PASSWORD_DEMO)
    print("  admin@saiu.edu | coordinador@saiu.edu | docente@saiu.edu | estudiante@saiu.edu")


if __name__ == "__main__":
    main()
