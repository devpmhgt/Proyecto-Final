-- SAIU - Esquema MySQL generado desde los modelos SQLAlchemy (backend/app/models)
-- Uso: mysql -u root -p < database/schema.sql
CREATE DATABASE IF NOT EXISTS saiu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saiu;

CREATE TABLE aulas (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	codigo VARCHAR(20) NOT NULL, 
	edificio VARCHAR(100), 
	capacidad INTEGER NOT NULL, 
	tipo VARCHAR(30) NOT NULL, 
	activa BOOL NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE carreras (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	facultad VARCHAR(150), 
	activa BOOL NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cursos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	creditos INTEGER NOT NULL, 
	horas_semana INTEGER NOT NULL, 
	descripcion TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE institucion (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	nombre VARCHAR(200) NOT NULL, 
	siglas VARCHAR(20), 
	direccion VARCHAR(255), 
	telefono VARCHAR(30), 
	email VARCHAR(120), 
	sitio_web VARCHAR(200), 
	rector VARCHAR(150), 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE parametros_academicos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	clave VARCHAR(80) NOT NULL, 
	valor VARCHAR(255) NOT NULL, 
	descripcion TEXT, 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE periodos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	codigo VARCHAR(20) NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	fecha_inicio DATE NOT NULL, 
	fecha_fin DATE NOT NULL, 
	fecha_limite_retiro DATE, 
	estado ENUM('planificacion','inscripcion','en_curso','cerrado') NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuarios (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	email VARCHAR(120) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	rol ENUM('admin','coordinador','docente','estudiante') NOT NULL, 
	activo BOOL NOT NULL, 
	creado_en DATETIME NOT NULL DEFAULT (now()), 
	PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auditoria (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	usuario_id INTEGER, 
	accion VARCHAR(30) NOT NULL, 
	entidad VARCHAR(60) NOT NULL, 
	entidad_id INTEGER, 
	detalle TEXT, 
	fecha DATETIME NOT NULL DEFAULT (now()), 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE docentes (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	usuario_id INTEGER, 
	codigo VARCHAR(20) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	telefono VARCHAR(30), 
	especialidad VARCHAR(150), 
	max_horas_semana INTEGER NOT NULL, 
	estado ENUM('activo','inactivo','licencia') NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (usuario_id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id), 
	UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notificaciones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	usuario_id INTEGER NOT NULL, 
	titulo VARCHAR(150) NOT NULL, 
	mensaje TEXT NOT NULL, 
	leida BOOL NOT NULL, 
	fecha DATETIME NOT NULL DEFAULT (now()), 
	PRIMARY KEY (id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE planes_estudio (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	carrera_id INTEGER NOT NULL, 
	codigo VARCHAR(30) NOT NULL, 
	nombre VARCHAR(150) NOT NULL, 
	anio INTEGER NOT NULL, 
	vigente BOOL NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(carrera_id) REFERENCES carreras (id), 
	UNIQUE (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE prerrequisitos (
	curso_id INTEGER NOT NULL, 
	prerrequisito_id INTEGER NOT NULL, 
	PRIMARY KEY (curso_id, prerrequisito_id), 
	FOREIGN KEY(curso_id) REFERENCES cursos (id) ON DELETE CASCADE, 
	FOREIGN KEY(prerrequisito_id) REFERENCES cursos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE disponibilidad_docente (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	docente_id INTEGER NOT NULL, 
	dia INTEGER NOT NULL, 
	hora_inicio TIME NOT NULL, 
	hora_fin TIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(docente_id) REFERENCES docentes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE estudiantes (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	usuario_id INTEGER, 
	carnet VARCHAR(20) NOT NULL, 
	nombres VARCHAR(100) NOT NULL, 
	apellidos VARCHAR(100) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	telefono VARCHAR(30), 
	fecha_nacimiento DATE, 
	carrera_id INTEGER NOT NULL, 
	plan_id INTEGER, 
	estado ENUM('activo','inactivo','suspendido','egresado','graduado') NOT NULL, 
	fecha_ingreso DATE, 
	PRIMARY KEY (id), 
	UNIQUE (usuario_id), 
	FOREIGN KEY(usuario_id) REFERENCES usuarios (id), 
	UNIQUE (email), 
	FOREIGN KEY(carrera_id) REFERENCES carreras (id), 
	FOREIGN KEY(plan_id) REFERENCES planes_estudio (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plan_cursos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	plan_id INTEGER NOT NULL, 
	curso_id INTEGER NOT NULL, 
	semestre INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plan_id, curso_id), 
	FOREIGN KEY(plan_id) REFERENCES planes_estudio (id) ON DELETE CASCADE, 
	FOREIGN KEY(curso_id) REFERENCES cursos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE secciones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	periodo_id INTEGER NOT NULL, 
	curso_id INTEGER NOT NULL, 
	docente_id INTEGER, 
	codigo VARCHAR(10) NOT NULL, 
	cupo INTEGER NOT NULL, 
	acta_cerrada BOOL NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (periodo_id, curso_id, codigo), 
	FOREIGN KEY(periodo_id) REFERENCES periodos (id), 
	FOREIGN KEY(curso_id) REFERENCES cursos (id), 
	FOREIGN KEY(docente_id) REFERENCES docentes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE evaluaciones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	seccion_id INTEGER NOT NULL, 
	nombre VARCHAR(100) NOT NULL, 
	ponderacion NUMERIC(5, 2) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE horarios (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	seccion_id INTEGER NOT NULL, 
	aula_id INTEGER NOT NULL, 
	dia INTEGER NOT NULL, 
	hora_inicio TIME NOT NULL, 
	hora_fin TIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(aula_id) REFERENCES aulas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inscripciones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	estudiante_id INTEGER NOT NULL, 
	seccion_id INTEGER NOT NULL, 
	estado ENUM('inscrito','retirado','aprobado','reprobado') NOT NULL, 
	fecha_inscripcion DATETIME NOT NULL DEFAULT (now()), 
	fecha_retiro DATETIME, 
	nota_final NUMERIC(5, 2), 
	PRIMARY KEY (id), 
	UNIQUE (estudiante_id, seccion_id), 
	FOREIGN KEY(estudiante_id) REFERENCES estudiantes (id), 
	FOREIGN KEY(seccion_id) REFERENCES secciones (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE calificaciones (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	inscripcion_id INTEGER NOT NULL, 
	evaluacion_id INTEGER NOT NULL, 
	nota NUMERIC(5, 2) NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (inscripcion_id, evaluacion_id), 
	FOREIGN KEY(inscripcion_id) REFERENCES inscripciones (id) ON DELETE CASCADE, 
	FOREIGN KEY(evaluacion_id) REFERENCES evaluaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
