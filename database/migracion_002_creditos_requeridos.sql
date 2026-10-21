-- SAIU - Migración 002: prerrequisito por créditos (p. ej. "70 Crs." en el pensum).
-- Necesaria solo en bases creadas antes de esta versión. Segura de ejecutar varias veces.
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS creditos_requeridos INTEGER;
