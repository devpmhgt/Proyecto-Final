-- Alinea las cuentas vinculadas con su expediente: el rol debe coincidir (estudiante/docente)
-- y el nombre de la cuenta es el del expediente. Se puede ejecutar varias veces.
BEGIN;

UPDATE usuarios u SET rol = 'estudiante', nombre = trim(e.nombres || ' ' || e.apellidos)
FROM estudiantes e
WHERE e.usuario_id = u.id
  AND (u.rol <> 'estudiante' OR u.nombre <> trim(e.nombres || ' ' || e.apellidos));

UPDATE usuarios u SET rol = 'docente', nombre = trim(d.nombres || ' ' || d.apellidos)
FROM docentes d
WHERE d.usuario_id = u.id
  AND (u.rol <> 'docente' OR u.nombre <> trim(d.nombres || ' ' || d.apellidos));

COMMIT;
