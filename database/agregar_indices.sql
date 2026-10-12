-- SAIU - Agrega los índices que faltaban si las tablas se crearon con una versión anterior de schema.sql.
-- Seguro de ejecutar varias veces. Si falla un UNIQUE, primero elimine los registros duplicados (ver consultas al final).

CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_email ON usuarios (email);
CREATE UNIQUE INDEX IF NOT EXISTS ix_estudiantes_carnet ON estudiantes (carnet);
CREATE UNIQUE INDEX IF NOT EXISTS ix_docentes_codigo ON docentes (codigo);
CREATE UNIQUE INDEX IF NOT EXISTS ix_parametros_academicos_clave ON parametros_academicos (clave);
CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria (fecha);
CREATE INDEX IF NOT EXISTS ix_notificaciones_usuario_id ON notificaciones (usuario_id);

-- Detectar duplicados (si algún CREATE UNIQUE INDEX falla):
-- SELECT email, count(*) FROM usuarios GROUP BY email HAVING count(*) > 1;
-- SELECT carnet, count(*) FROM estudiantes GROUP BY carnet HAVING count(*) > 1;
-- SELECT codigo, count(*) FROM docentes GROUP BY codigo HAVING count(*) > 1;
