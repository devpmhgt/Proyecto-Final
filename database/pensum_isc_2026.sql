-- SAIU - Pensum de Ingeniería en Sistemas para el SQL Editor de Supabase.
-- Generado desde database/ejemplos/pensum_ingenieria_en_sistemas.csv (equivale a importarlo desde la app).
-- Seguro de ejecutar varias veces: crea o actualiza cursos, prerrequisitos y el plan ISC-2026.
-- Requiere: migracion_002_creditos_requeridos.sql y la carrera con código ISC.

BEGIN;

-- 0. Requisitos previos
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS creditos_requeridos INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM carreras WHERE codigo = 'ISC') THEN
    RAISE EXCEPTION 'No existe la carrera ISC: créela antes de ejecutar este script';
  END IF;
END $$;

-- 1. Cursos
INSERT INTO cursos (codigo, nombre, creditos, horas_semana, creditos_requeridos) VALUES
  ('001', 'DESARROLLO HUMANO Y PROFESIONAL', 4, 4, NULL),
  ('002', 'METODOLOGÍA DE LA INVESTIGACIÓN', 5, 4, NULL),
  ('003', 'CONTABILIDAD I', 5, 4, NULL),
  ('004', 'INTRODUCCIÓN A LOS SISTEMAS DE CÓMPUTO', 5, 4, NULL),
  ('005', 'LÓGICA DE SISTEMAS', 5, 4, NULL),
  ('006', 'PRECÁLCULO', 5, 4, NULL),
  ('007', 'ÁLGEBRA LINEAL', 5, 4, NULL),
  ('008', 'ALGORITMOS', 5, 4, NULL),
  ('009', 'CONTABILIDAD II', 5, 4, NULL),
  ('010', 'MATEMÁTICA DISCRETA', 5, 4, NULL),
  ('011', 'FÍSICA I', 5, 4, NULL),
  ('012', 'PROGRAMACIÓN I', 5, 4, NULL),
  ('013', 'CÁLCULO I', 5, 4, NULL),
  ('014', 'PROCESO ADMINISTRATIVO', 4, 4, NULL),
  ('015', 'DERECHO INFORMÁTICO', 5, 4, NULL),
  ('016', 'MICROECONOMÍA', 5, 4, NULL),
  ('017', 'PROGRAMACIÓN II', 5, 4, NULL),
  ('018', 'CÁLCULO II', 5, 4, NULL),
  ('019', 'ESTADÍSTICA I', 5, 4, NULL),
  ('020', 'FÍSICA II', 5, 4, NULL),
  ('021', 'MÉTODOS NUMÉRICOS', 5, 4, 70),
  ('022', 'PROGRAMACIÓN III', 5, 4, NULL),
  ('023', 'EMPRENDEDORES DE NEGOCIOS', 5, 4, NULL),
  ('024', 'ELECTRÓNICA ANALÓGICA', 5, 4, NULL),
  ('025', 'ESTADÍSTICA II', 5, 4, NULL),
  ('026', 'INVESTIGACIÓN DE OPERACIONES', 5, 4, 80),
  ('027', 'BASES DE DATOS I', 5, 4, NULL),
  ('028', 'AUTÓMATAS Y LENGUAJES FORMALES', 5, 4, 80),
  ('029', 'SISTEMAS OPERATIVOS I', 5, 4, 80),
  ('030', 'ELECTRÓNICA DIGITAL', 5, 4, NULL),
  ('031', 'BASES DE DATOS II', 5, 4, NULL),
  ('032', 'ANÁLISIS DE SISTEMAS I', 5, 4, 100),
  ('033', 'SISTEMAS OPERATIVOS II', 5, 4, NULL),
  ('034', 'ARQUITECTURA DE COMPUTADORAS I', 5, 4, 100),
  ('035', 'COMPILADORES', 5, 4, NULL),
  ('036', 'DESARROLLO WEB', 5, 4, NULL),
  ('037', 'ANÁLISIS DE SISTEMAS II', 5, 4, NULL),
  ('038', 'REDES DE COMPUTADORAS I', 5, 4, 125),
  ('039', 'ÉTICA PROFESIONAL', 4, 4, 100),
  ('040', 'ARQUITECTURA DE COMPUTADORAS II', 5, 4, NULL),
  ('041', 'ADMINISTRACIÓN DE TECNOLOGÍAS DE INFORMACIÓN', 5, 4, 150),
  ('042', 'INGENIERÍA DE SOFTWARE', 5, 4, 150),
  ('043', 'PROYECTO DE GRADUACIÓN I', 6, 4, 150),
  ('044', 'REDES DE COMPUTADORAS II', 5, 4, NULL),
  ('045', 'INTELIGENCIA ARTIFICIAL', 5, 4, 150),
  ('046', 'TELECOMUNICACIONES', 5, 4, 175),
  ('047', 'SEMINARIO DE TECNOLOGÍAS DE INFORMACIÓN', 6, 4, 175),
  ('048', 'ASEGURAMIENTO DE LA CALIDAD DE SOFTWARE', 5, 4, 175),
  ('049', 'PROYECTO DE GRADUACIÓN II', 6, 4, NULL),
  ('050', 'SEGURIDAD Y AUDITORÍA DE SISTEMAS', 5, 4, 175)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, creditos = EXCLUDED.creditos,
  creditos_requeridos = EXCLUDED.creditos_requeridos;

-- 2. Prerrequisitos por curso (se reemplazan los existentes de estos cursos)
DELETE FROM prerrequisitos WHERE curso_id IN (SELECT id FROM cursos WHERE codigo IN ('001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022', '023', '024', '025', '026', '027', '028', '029', '030', '031', '032', '033', '034', '035', '036', '037', '038', '039', '040', '041', '042', '043', '044', '045', '046', '047', '048', '049', '050'));
INSERT INTO prerrequisitos (curso_id, prerrequisito_id)
SELECT c.id, p.id FROM (VALUES
  ('011', '006'),
  ('012', '008'),
  ('013', '006'),
  ('017', '012'),
  ('018', '013'),
  ('020', '011'),
  ('022', '017'),
  ('024', '020'),
  ('025', '019'),
  ('027', '022'),
  ('030', '024'),
  ('031', '027'),
  ('033', '029'),
  ('035', '028'),
  ('036', '031'),
  ('037', '032'),
  ('040', '034'),
  ('044', '038'),
  ('049', '043')
) AS v(curso, prerreq)
JOIN cursos c ON c.codigo = v.curso
JOIN cursos p ON p.codigo = v.prerreq;

-- 3. Plan de estudios
INSERT INTO planes_estudio (carrera_id, codigo, nombre, anio, vigente)
SELECT id, 'ISC-2026', 'Pensum Ingeniería en Sistemas 2026', 2026, true FROM carreras WHERE codigo = 'ISC'
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, anio = EXCLUDED.anio, vigente = true;

-- 4. Cursos del plan por ciclo (se reemplaza la lista del plan)
DELETE FROM plan_cursos WHERE plan_id = (SELECT id FROM planes_estudio WHERE codigo = 'ISC-2026');
INSERT INTO plan_cursos (plan_id, curso_id, semestre)
SELECT pl.id, c.id, v.semestre FROM (VALUES
  ('001', 1),
  ('002', 1),
  ('003', 1),
  ('004', 1),
  ('005', 1),
  ('006', 2),
  ('007', 2),
  ('008', 2),
  ('009', 2),
  ('010', 2),
  ('011', 3),
  ('012', 3),
  ('013', 3),
  ('014', 3),
  ('015', 3),
  ('016', 4),
  ('017', 4),
  ('018', 4),
  ('019', 4),
  ('020', 4),
  ('021', 5),
  ('022', 5),
  ('023', 5),
  ('024', 5),
  ('025', 5),
  ('026', 6),
  ('027', 6),
  ('028', 6),
  ('029', 6),
  ('030', 6),
  ('031', 7),
  ('032', 7),
  ('033', 7),
  ('034', 7),
  ('035', 7),
  ('036', 8),
  ('037', 8),
  ('038', 8),
  ('039', 8),
  ('040', 8),
  ('041', 9),
  ('042', 9),
  ('043', 9),
  ('044', 9),
  ('045', 9),
  ('046', 10),
  ('047', 10),
  ('048', 10),
  ('049', 10),
  ('050', 10)
) AS v(curso, semestre)
JOIN cursos c ON c.codigo = v.curso
JOIN planes_estudio pl ON pl.codigo = 'ISC-2026';

COMMIT;

-- Verificación: 10 ciclos, 50 cursos, 250 créditos
SELECT pc.semestre AS ciclo, count(*) AS cursos, sum(c.creditos) AS creditos
FROM plan_cursos pc JOIN cursos c ON c.id = pc.curso_id
JOIN planes_estudio pl ON pl.id = pc.plan_id WHERE pl.codigo = 'ISC-2026'
GROUP BY pc.semestre ORDER BY pc.semestre;
