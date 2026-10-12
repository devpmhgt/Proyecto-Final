# SAIU — Sistema Académico Integral Universitario

Aplicación web para administrar los procesos académicos de una universidad: estudiantes, docentes, catálogo, oferta, inscripciones y calificaciones.

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (componentes standalone, signals, formularios reactivos, lazy loading) |
| Backend | Python + FastAPI + SQLAlchemy 2 |
| Base de datos | PostgreSQL en Supabase |
| Seguridad | JWT (Bearer) + RBAC con 4 roles: `admin`, `coordinador`, `docente`, `estudiante` |

## Estructura

```
backend/
  app/
    core/        configuración (.env) y seguridad (bcrypt, JWT)
    db/          motor y sesión SQLAlchemy
    models/      entidades (una carpeta lógica por módulo)
    schemas/     DTOs Pydantic de entrada/salida
    services/    reglas de negocio (inscripción, horarios, actas, auditoría, notificaciones)
    api/         dependencias (auth/RBAC) y routers por módulo
    main.py      aplicación FastAPI
  seed.py        crea tablas y datos de demostración
  tests/         pruebas de flujo (pytest, SQLite)
database/
  schema.sql     esquema PostgreSQL (20 tablas) generado desde los modelos (referencia)
frontend/
  src/app/
    core/        modelos TS, ApiService, AuthService, interceptor JWT, guards
    layout/      shell con menú según rol
    pages/       una página por módulo
```

## Puesta en marcha

### 1. Base de datos (Supabase)

1. En Supabase: **Project Settings → Database → Connection string → Session pooler** y copie la cadena.
2. Copie `backend/.env.example` a `backend/.env` y pegue la cadena en `DATABASE_URL`, con el prefijo
   `postgresql+psycopg://` y su contraseña. **`backend/.env` está en `.gitignore`: nunca se sube al repositorio.**
3. `python seed.py` crea las tablas y activa RLS en todas, para que la API REST pública de Supabase no exponga los datos.

Para desarrollo sin conexión puede usar `DATABASE_URL=sqlite:///./saiu.db`.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # ponga su DATABASE_URL de Supabase y un JWT_SECRET propio
python seed.py                  # crea las tablas y carga datos demo (--reset para recrear)
fastapi dev app/main.py         # http://localhost:8000  ·  documentación: /docs
```

Pruebas: `pytest` (usan SQLite, no requieren conexión a Supabase).

### 3. Frontend

```bash
cd frontend
npm install
npm start                       # http://localhost:4200  (proxy /api → localhost:8000)
```

### Cuentas de demostración

Contraseña de todas: `Saiu2026!`

| Correo | Rol |
|---|---|
| admin@saiu.edu | Administrador |
| coordinador@saiu.edu | Coordinador |
| docente@saiu.edu | Docente (Ana López, imparte PRG101-A) |
| estudiante@saiu.edu | Estudiante (Luis Pérez, Ingeniería en Sistemas) |

## Módulos y permisos

| # | Módulo | Funciones | Roles |
|---|---|---|---|
| 1 | Configuración institucional | Datos de la universidad, parámetros académicos (nota mínima, máx. créditos, máx. retiros) | admin |
| 2 | Inicio de sesión y permisos | Login JWT, cambio de contraseña, gestión de usuarios y roles | todos / admin |
| 3 | Estudiantes y docentes | Expedientes, estados, cuentas de acceso, historial, disponibilidad docente | admin, coordinador |
| 4 | Catálogo académico | Carreras, planes de estudio por semestre, cursos, prerrequisitos (con detección de ciclos) | admin, coordinador |
| 5 | Oferta y planificación | Periodos, aulas, secciones, cupos, horarios | admin, coordinador |
| 6 | Gestión escolar | Inscripción, retiros, ponderaciones, registro de notas, cierre/reapertura de actas | estudiante (propias), docente (sus secciones), admin, coordinador |
| 7 | Servicios transversales | Panel de indicadores, auditoría de operaciones, notificaciones internas | admin/coordinador · admin · todos |

## Reglas de negocio implementadas

**Inscripción** (`services/escolar.py`): estudiante activo; periodo en estado `inscripcion`; prerrequisitos aprobados;
curso no aprobado previamente ni inscrito en otra sección; cupo disponible; sin choque de horario; no exceder
`max_creditos_periodo`.

**Retiro**: solo inscripciones vigentes, antes de la fecha límite del periodo y hasta `max_retiros_periodo`.

**Horarios** (`services/planificacion.py`): sin choque de aula ni de docente en el mismo periodo; el cupo no supera la
capacidad del aula; el bloque debe caer dentro de la disponibilidad registrada del docente.

**Notas y actas**: las ponderaciones de una sección no pueden superar 100 %; solo el docente asignado (o
admin/coordinador) registra notas; el acta solo se cierra si las ponderaciones suman 100 %; al cerrar se calcula la
nota final ponderada, se asigna aprobado/reprobado según `nota_minima_aprobacion` y se notifica al estudiante; un acta
cerrada no admite cambios (el coordinador puede reabrirla).

**Auditoría**: toda operación de escritura y cada inicio de sesión queda registrada con usuario, acción, entidad y
detalle.

## API

La documentación interactiva (Swagger) está en `http://localhost:8000/docs`, agrupada por módulo. Use el botón
**Authorize** con cualquiera de las cuentas demo.
