-- SAIU - Esquema PostgreSQL (Supabase) generado desde los modelos SQLAlchemy (backend/app/models)
-- Normalmente no es necesario ejecutarlo: python seed.py crea las tablas. Sirve como referencia o para el SQL Editor de Supabase.

CREATE TYPE estadoperiodo AS ENUM ('planificacion', 'inscripcion', 'en_curso', 'cerrado');
CREATE TYPE rol AS ENUM ('admin', 'coordinador', 'docente', 'estudiante');
CREATE TYPE estadodocente AS ENUM ('activo', 'inactivo', 'licencia');
CREATE TYPE estadoestudiante AS ENUM ('activo', 'inactivo', 'suspendido', 'egresado', 'graduado');
CREATE TYPE estadoinscripcion AS ENUM ('inscrito', 'retirado', 'aprobado', 'reprobado');

CREATE TABLE aulas (
	id SERIAL NOT NULL, 
	codigo VARCHAR(20) NOT NULL, 
	edificio VARCHAR(100), 
	capacidad INTEGER NOT NULL, 
	tipo VARCHAR(30) NOT NULL, 
	activa BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
);

CREATE TABLE carreras (
	id SERIAL NOT NULL, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	facultad VARCHAR(150), 
	activa BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
);

CREATE TABLE cursos (
	id SERIAL NOT NULL, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	creditos INTEGER NOT NULL, 
	horas_semana INTEGER NOT NULL, 
	descripcion TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
);

CREATE TABLE institucion (
	id SERIAL NOT NULL, 
	nombre VARCHAR(200) NOT NULL, 
	siglas VARCHAR(20), 
	direccion VARCHAR(255), 
	telefono VARCHAR(30), 
	email VARCHAR(120), 
	sitio_web VARCHAR(200), 
	rector VARCHAR(150), 
	PRIMARY KEY (id)
);

CREATE TABLE parametros_academicos (
	id SERIAL NOT NULL, 
	clave VARCHAR(80) NOT NULL, 
	valor VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	PRIMARY KEY (id)
);

CREATE TABLE periodos (
	id SERIAL NOT NULL, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	fecha_inicio DATE NOT NULL, 
	fecha_fin DATE NOT NULL, 
	fecha_limite_retiro DATE, 
	estado estadoperiodo NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
);

CREATE TABLE usuarios (
	id SERIAL NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	rol rol NOT NULL, 
	activo BOOLEAN NOT NULL, 
	creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE auditoria (
	id SERIAL NOT NULL, 
	usuario_id INTEGER, 
	accion VARCHAR(30) NOT NULL, 
	entidad VARCHAR(60) NOT NULL, 
	entidad_id INTEGER, 
	detalle TEXT, 
	fecha TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id)
);

CREATE TABLE docentes (
	id SERIAL NOT NULL, 
	usuario_id INTEGER, 
	codigo VARCHAR(20) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	telefono VARCHAR(30), 
	especialidad VARCHAR(150), 
	max_horas_semana INTEGER NOT NULL, 
	estado estadodocente NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (usuario_id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id), 
	UNIQUE (email)
);

CREATE TABLE notificaciones (
	id SERIAL NOT NULL, 
	usuario_id INTEGER NOT NULL, 
	titulo VARCHAR(150) NOT NULL, 
	mensaje TEXT NOT NULL, 
	leida BOOLEAN NOT NULL, 
	fecha TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE TABLE planes_estudio (
	id SERIAL NOT NULL, 
	carrera_id INTEGER NOT NULL, 
	codigo VARCHAR(30) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	anio INTEGER NOT NULL, 
	vigente BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(carrera_id) REFERENCES carreras (id), 
	UNIQUE (codigo)
);

CREATE TABLE prerrequisitos (
	curso_id INTEGER NOT NULL, 
	prerrequisito_id INTEGER NOT NULL, 
	PRIMARY KEY (curso_id, prerrequisito_id), 
	FOREIGN KEY(curso_id) REFERENCES cursos (id) ON DELETE CASCADE, 
	FOREIGN KEY(prerrequisito_id) REFERENCES cursos (id) ON DELETE CASCADE
);

CREATE TABLE disponibilidad_docente (
	id SERIAL NOT NULL, 
	docente_id INTEGER NOT NULL, 
	dia INTEGER NOT NULL, 
	hora_inicio TIME WITHOUT TIME ZONE NOT NULL, 
	hora_fin TIME WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(docente_id) REFERENCES docentes (id) ON DELETE CASCADE
);

CREATE TABLE estudiantes (
	id SERIAL NOT NULL, 
	usuario_id INTEGER, 
	carnet VARCHAR(20) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	telefono VARCHAR(30), 
	fecha_nacimiento DATE, 
	carrera_id INTEGER NOT NULL, 
	plan_id INTEGER, 
	estado estadoestudiante NOT NULL, 
	fecha_ingreso DATE, 
	PRIMARY KEY (id), 
	UNIQUE (usuario_id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id), 
	UNIQUE (email), 
	FOREIGN KEY(carrera_id) REFERENCES carreras (id), 
	FOREIGN KEY(plan_id) REFERENCES planes_estudio (id)
);

CREATE TABLE plan_cursos (
	id SERIAL NOT NULL, 
	plan_id INTEGER NOT NULL, 
	curso_id INTEGER NOT NULL, 
	semestre INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plan_id, curso_id), 
	FOREIGN KEY(plan_id) REFERENCES planes_estudio (id) ON DELETE CASCADE, 
	FOREIGN KEY(curso_id) REFERENCES cursos (id)
);

CREATE TABLE secciones (
	id SERIAL NOT NULL, 
	periodo_id INTEGER NOT NULL, 
	curso_id INTEGER NOT NULL, 
	docente_id INTEGER, 
	codigo VARCHAR(10) NOT NULL, 
	cupo INTEGER NOT NULL, 
	acta_cerrada BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (periodo_id, curso_id, codigo), 
	FOREIGN KEY(periodo_id) REFERENCES periodos (id), 
	FOREIGN KEY(curso_id) REFERENCES cursos (id), 
	FOREIGN KEY(docente_id) REFERENCES docentes (id)
);

CREATE TABLE evaluaciones (
	id SERIAL NOT NULL, 
	seccion_id INTEGER NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	ponderacion NUMERIC(5, 2) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id) ON DELETE CASCADE
);

CREATE TABLE horarios (
	id SERIAL NOT NULL, 
	seccion_id INTEGER NOT NULL, 
	aula_id INTEGER NOT NULL, 
	dia INTEGER NOT NULL, 
	hora_inicio TIME WITHOUT TIME ZONE NOT NULL, 
	hora_fin TIME WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(aula_id) REFERENCES aulas (id)
);

CREATE TABLE inscripciones (
	id SERIAL NOT NULL, 
	estudiante_id INTEGER NOT NULL, 
	seccion_id INTEGER NOT NULL, 
	estado estadoinscripcion NOT NULL, 
	fecha_inscripcion TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	fecha_retiro TIMESTAMP WITHOUT TIME ZONE, 
	nota_final NUMERIC(5, 2), 
	PRIMARY KEY (id), 
	UNIQUE (estudiante_id, seccion_id), 
	FOREIGN KEY(estudiante_id) REFERENCES estudiantes (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id)
);

CREATE TABLE calificaciones (
	id SERIAL NOT NULL, 
	inscripcion_id INTEGER NOT NULL, 
	evaluacion_id INTEGER NOT NULL, 
	nota NUMERIC(5, 2) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (inscripcion_id, evaluacion_id), 
	FOREIGN KEY(inscripcion_id) REFERENCES inscripciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(evaluacion_id) REFERENCES evaluaciones (id) ON DELETE CASCADE
);

-- Bloquea el acceso por la API REST de Supabase (anon/authenticated); el backend accede como dueño de las tablas.
ALTER TABLE aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carreras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE institucion ENABLE ROW LEVEL SECURITY;
ALTER TABLE parametros_academicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes_estudio ENABLE ROW LEVEL SECURITY;
ALTER TABLE prerrequisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidad_docente ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones ENABLE ROW LEVEL SECURITY;
