export type Rol = 'admin' | 'coordinador' | 'docente' | 'estudiante';

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  creado_en?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface Institucion {
  id?: number;
  nombre: string;
  siglas?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  rector?: string | null;
}

/** Regla académica que aplica el sistema (nota mínima, créditos y retiros por periodo). */
export interface Parametro {
  clave: string;
  valor: string;
  descripcion: string;
  minimo: number;
  maximo: number;
}

export interface Carrera {
  id: number;
  codigo: string;
  nombre: string;
  facultad: string | null;
  activa: boolean;
}

export interface CursoResumen {
  id: number;
  codigo: string;
  nombre: string;
  creditos: number;
}

export interface Curso extends CursoResumen {
  horas_semana: number;
  descripcion: string | null;
  creditos_requeridos: number | null;
  prerrequisitos: CursoResumen[];
}

export interface Plan {
  id: number;
  carrera_id: number;
  codigo: string;
  nombre: string;
  anio: number;
  vigente: boolean;
  cursos: { id: number; semestre: number; curso: CursoResumen }[];
}

export type EstadoEstudiante = 'activo' | 'inactivo' | 'suspendido' | 'egresado' | 'graduado';

export interface Estudiante {
  id: number;
  usuario_id: number | null;
  carnet: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  carrera_id: number;
  plan_id: number | null;
  estado: EstadoEstudiante;
  fecha_ingreso: string | null;
}

export interface Disponibilidad {
  id?: number;
  dia: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface Docente {
  id: number;
  usuario_id: number | null;
  codigo: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  especialidad: string | null;
  max_horas_semana: number;
  estado: 'activo' | 'inactivo' | 'licencia';
  disponibilidad: Disponibilidad[];
}

export type EstadoPeriodo = 'planificacion' | 'inscripcion' | 'en_curso' | 'cerrado';

export interface Periodo {
  id: number;
  codigo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_limite_retiro: string | null;
  estado: EstadoPeriodo;
}

export interface Aula {
  id: number;
  codigo: string;
  edificio: string | null;
  capacidad: number;
  tipo: string;
  activa: boolean;
}

export interface Horario {
  id: number;
  aula_id: number;
  dia: number;
  hora_inicio: string;
  hora_fin: string;
  aula: Aula;
}

export interface Seccion {
  id: number;
  periodo_id: number;
  codigo: string;
  cupo: number;
  acta_cerrada: boolean;
  inscritos: number;
  curso: CursoResumen;
  docente: { id: number; nombres: string; apellidos: string } | null;
  horarios: Horario[];
}

export type EstadoInscripcion = 'inscrito' | 'retirado' | 'aprobado' | 'reprobado';

export interface EstudianteResumen {
  id: number;
  carnet: string;
  nombres: string;
  apellidos: string;
}

export interface Inscripcion {
  id: number;
  estado: EstadoInscripcion;
  fecha_inscripcion: string | null;
  fecha_retiro: string | null;
  nota_final: string | null;
  estudiante: EstudianteResumen;
  seccion: Seccion;
}

export interface Evaluacion {
  id: number;
  seccion_id: number;
  nombre: string;
  ponderacion: string;
}

export interface FilaActa {
  inscripcion_id: number;
  estudiante: EstudianteResumen;
  estado: EstadoInscripcion;
  notas: Record<number, string>;
  nota_acumulada: string;
  nota_final: string | null;
}

export interface Acta {
  seccion_id: number;
  acta_cerrada: boolean;
  evaluaciones: Evaluacion[];
  filas: FilaActa[];
}

export interface Auditoria {
  id: number;
  usuario_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: string | null;
  fecha: string;
}

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: string;
}

export interface Indicadores {
  estudiantes_activos: number;
  docentes_activos: number;
  carreras: number;
  cursos: number;
  periodo_actual: string | null;
  secciones_periodo: number;
  inscripciones_periodo: number;
  ocupacion_promedio: number;
  tasa_aprobacion: number | null;
  estudiantes_por_carrera: { nombre: string; total: number }[];
  estudiantes_por_estado: { estado: string; total: number }[];
}

export interface FilaPensum {
  linea: number;
  ciclo: string;
  semestre: number;
  codigo: string;
  nombre: string;
  creditos: number;
  prerrequisitos: string[];
  creditos_requeridos: number | null;
  accion: 'crear' | 'actualizar';
}

export interface ImportacionPensum {
  cursos: FilaPensum[];
  errores: string[];
  advertencias: string[];
  total_creditos: number;
  ciclos: number;
  guardado: boolean;
  plan_id: number | null;
}

export type EstadoAvance = 'aprobado' | 'en_curso' | 'disponible' | 'bloqueado';

export interface CursoAvance {
  id: number;
  codigo: string;
  nombre: string;
  creditos: number;
  semestre: number;
  estado: EstadoAvance;
  nota: string | null;
  intentos_reprobados: number;
  prerrequisitos: { id: number; codigo: string; nombre: string }[];
  creditos_requeridos: number | null;
  faltantes: string[];
  creditos_faltantes: number;
  desbloquea: number[];
}

export interface Avance {
  estudiante: EstudianteResumen;
  carrera: string;
  plan: { id: number; codigo: string; nombre: string } | null;
  creditos_aprobados: number;
  creditos_aprobados_total: number;
  creditos_totales: number;
  porcentaje: number;
  promedio: string | null;
  cursos_aprobados: number;
  cursos_totales: number;
  en_curso: number;
  disponibles: number;
  ciclos: { semestre: number; cursos: CursoAvance[] }[];
}

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
