-- SAIU - Creación de usuarios de la aplicación desde el SQL Editor de Supabase.
--
-- Requisitos:
--   * Tablas creadas (python seed.py o schema.sql) con el índice único de usuarios.email
--     (si las creó con una versión anterior de schema.sql, ejecute antes agregar_indices.sql).
--   * La carrera del estudiante debe existir (ver bloque 0).
--
-- Notas:
--   * Son usuarios de la tabla propia "usuarios" (login del backend con JWT), NO de Supabase Auth (auth.users).
--   * Las contraseñas se cifran con bcrypt (pgcrypto), compatible con el backend.
--   * Cambie correos, nombres y contraseñas (mínimo 8 caracteres) antes de ejecutar.
--   * Es seguro ejecutarlo varias veces: no duplica usuarios y completa perfiles faltantes.
--   * Úselo solo en el SQL Editor; nunca ponga estas sentencias ni contraseñas en el frontend.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 0. Verificaciones previas: si fallan, el script se detiene sin insertar nada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'usuarios' AND indexdef ILIKE 'CREATE UNIQUE INDEX%(email)'
  ) THEN
    RAISE EXCEPTION 'Falta el índice único en usuarios.email: ejecute primero database/agregar_indices.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM carreras WHERE codigo = 'ISC') THEN
    RAISE EXCEPTION 'No existe la carrera con código ISC: créela (o cambie el código en el bloque 3) antes de ejecutar';
  END IF;
END $$;

-- 1. Cuentas de acceso
INSERT INTO usuarios (email, nombre, hashed_password, rol, activo)
VALUES
  ('admin@universidad.edu',        'Administrador General',  extensions.crypt('CambiarAdmin123',      extensions.gen_salt('bf', 12)), 'admin',       true),
  ('coordinacion@universidad.edu', 'Coordinación Académica', extensions.crypt('CambiarCoord123',      extensions.gen_salt('bf', 12)), 'coordinador', true),
  ('jramirez@universidad.edu',     'Jorge Ramírez',          extensions.crypt('CambiarDocente123',    extensions.gen_salt('bf', 12)), 'docente',     true),
  ('ana.torres@universidad.edu',   'Ana Torres',             extensions.crypt('CambiarEstudiante123', extensions.gen_salt('bf', 12)), 'estudiante',  true)
ON CONFLICT (email) DO NOTHING;

-- 2. Perfil docente (se busca la cuenta por correo; si el perfil ya existe no hace nada)
INSERT INTO docentes (usuario_id, codigo, nombres, apellidos, email, especialidad, max_horas_semana, estado)
SELECT u.id, 'D100', 'Jorge', 'Ramírez', u.email, 'Redes', 20, 'activo'
FROM usuarios u
WHERE u.email = 'jramirez@universidad.edu'
ON CONFLICT DO NOTHING;

-- 3. Expediente de estudiante vinculado a su carrera (por código)
INSERT INTO estudiantes (usuario_id, carnet, nombres, apellidos, email, carrera_id, estado, fecha_ingreso)
SELECT u.id, '2026100', 'Ana', 'Torres', u.email, c.id, 'activo', CURRENT_DATE
FROM usuarios u
JOIN carreras c ON c.codigo = 'ISC'
WHERE u.email = 'ana.torres@universidad.edu'
ON CONFLICT DO NOTHING;

-- Cambiar la contraseña de un usuario existente
-- UPDATE usuarios SET hashed_password = extensions.crypt('NuevaClave123', extensions.gen_salt('bf', 12))
-- WHERE email = 'admin@universidad.edu';

-- 4. Verificación: cuentas de docente/estudiante sin perfil vinculado deberían ser 0 filas
SELECT u.id, u.email, u.rol, 'SIN PERFIL' AS problema
FROM usuarios u
LEFT JOIN docentes d ON d.usuario_id = u.id
LEFT JOIN estudiantes e ON e.usuario_id = u.id
WHERE (u.rol = 'docente' AND d.id IS NULL) OR (u.rol = 'estudiante' AND e.id IS NULL);
