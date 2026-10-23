import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Acta,
  Avance,
  Auditoria,
  Aula,
  Carrera,
  Curso,
  Disponibilidad,
  Docente,
  Estudiante,
  Evaluacion,
  ImportacionPensum,
  Indicadores,
  Inscripcion,
  Institucion,
  Notificacion,
  Parametro,
  Periodo,
  Plan,
  Seccion,
  Usuario,
} from './models';

type Filtros = Record<string, string | number | boolean | null | undefined>;

function params(f: Filtros = {}): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  private get<T>(url: string, f?: Filtros): Observable<T> {
    return this.http.get<T>(this.base + url, { params: params(f) });
  }
  private post<T>(url: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(this.base + url, body);
  }
  private put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.base + url, body);
  }
  private patch<T>(url: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.base + url, body);
  }
  private delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(this.base + url);
  }

  // 1. Configuración institucional
  institucion = () => this.get<Institucion | null>('/institucion');
  guardarInstitucion = (d: Institucion) => this.put<Institucion>('/institucion', d);
  parametros = () => this.get<Parametro[]>('/institucion/parametros');
  guardarParametro = (d: Parametro) => this.put<Parametro>('/institucion/parametros', d);
  eliminarParametro = (id: number) => this.delete<void>(`/institucion/parametros/${id}`);

  // 2. Usuarios
  usuarios = () => this.get<Usuario[]>('/usuarios');
  crearUsuario = (d: Partial<Usuario> & { password: string }) => this.post<Usuario>('/usuarios', d);
  actualizarUsuario = (id: number, d: Partial<Usuario> & { password?: string }) =>
    this.patch<Usuario>(`/usuarios/${id}`, d);
  cambiarPassword = (password_actual: string, password_nueva: string) =>
    this.post<void>('/auth/cambiar-password', { password_actual, password_nueva });

  // 3. Estudiantes y docentes
  estudiantes = (f?: Filtros) => this.get<Estudiante[]>('/estudiantes', f);
  miExpediente = () => this.get<Estudiante>('/estudiantes/me');
  miAvance = () => this.get<Avance>('/estudiantes/me/avance');
  cuentasSinExpediente = (rol: 'estudiante' | 'docente') => this.get<Usuario[]>('/cuentas-sin-expediente', { rol });
  vincularEstudiante = (id: number, usuario_id: number) => this.post<Estudiante>(`/estudiantes/${id}/vincular`, { usuario_id });
  desvincularEstudiante = (id: number) => this.post<Estudiante>(`/estudiantes/${id}/desvincular`);
  vincularDocente = (id: number, usuario_id: number) => this.post<Docente>(`/docentes/${id}/vincular`, { usuario_id });
  desvincularDocente = (id: number) => this.post<Docente>(`/docentes/${id}/desvincular`);
  avanceEstudiante = (id: number) => this.get<Avance>(`/estudiantes/${id}/avance`);
  crearEstudiante = (d: Partial<Estudiante> & { password?: string }) => this.post<Estudiante>('/estudiantes', d);
  actualizarEstudiante = (id: number, d: Partial<Estudiante>) => this.patch<Estudiante>(`/estudiantes/${id}`, d);
  docentes = (f?: Filtros) => this.get<Docente[]>('/docentes', f);
  miPerfilDocente = () => this.get<Docente>('/docentes/me');
  crearDocente = (d: Partial<Docente> & { password?: string }) => this.post<Docente>('/docentes', d);
  actualizarDocente = (id: number, d: Partial<Docente>) => this.patch<Docente>(`/docentes/${id}`, d);
  disponibilidad = (id: number, franjas: Disponibilidad[]) =>
    this.put<Docente>(`/docentes/${id}/disponibilidad`, franjas);

  // 4. Catálogo académico
  carreras = () => this.get<Carrera[]>('/carreras');
  crearCarrera = (d: Partial<Carrera>) => this.post<Carrera>('/carreras', d);
  actualizarCarrera = (id: number, d: Partial<Carrera>) => this.put<Carrera>(`/carreras/${id}`, d);
  cursos = () => this.get<Curso[]>('/cursos');
  crearCurso = (d: unknown) => this.post<Curso>('/cursos', d);
  actualizarCurso = (id: number, d: unknown) => this.put<Curso>(`/cursos/${id}`, d);
  planes = (f?: Filtros) => this.get<Plan[]>('/planes', f);
  crearPlan = (d: Partial<Plan>) => this.post<Plan>('/planes', d);
  agregarCursoPlan = (planId: number, curso_id: number, semestre: number) =>
    this.post<Plan>(`/planes/${planId}/cursos`, { curso_id, semestre });
  quitarCursoPlan = (planId: number, cursoId: number) => this.delete<Plan>(`/planes/${planId}/cursos/${cursoId}`);
  /** confirmar=false devuelve solo la vista previa; true guarda el pensum. */
  importarPensum = (datos: FormData) => this.post<ImportacionPensum>('/planes/importar-csv', datos);

  // 5. Oferta y planificación
  periodos = () => this.get<Periodo[]>('/periodos');
  crearPeriodo = (d: Partial<Periodo>) => this.post<Periodo>('/periodos', d);
  actualizarPeriodo = (id: number, d: Partial<Periodo>) => this.put<Periodo>(`/periodos/${id}`, d);
  aulas = () => this.get<Aula[]>('/aulas');
  crearAula = (d: Partial<Aula>) => this.post<Aula>('/aulas', d);
  actualizarAula = (id: number, d: Partial<Aula>) => this.put<Aula>(`/aulas/${id}`, d);
  secciones = (f?: Filtros) => this.get<Seccion[]>('/secciones', f);
  crearSeccion = (d: unknown) => this.post<Seccion>('/secciones', d);
  actualizarSeccion = (id: number, d: unknown) => this.patch<Seccion>(`/secciones/${id}`, d);
  agregarHorario = (id: number, d: unknown) => this.post<Seccion>(`/secciones/${id}/horarios`, d);
  eliminarHorario = (id: number, horarioId: number) => this.delete<Seccion>(`/secciones/${id}/horarios/${horarioId}`);

  // 6. Gestión escolar
  inscripciones = (f?: Filtros) => this.get<Inscripcion[]>('/inscripciones', f);
  inscribir = (seccion_id: number, estudiante_id?: number) =>
    this.post<Inscripcion>('/inscripciones', { seccion_id, estudiante_id });
  retirar = (id: number) => this.post<Inscripcion>(`/inscripciones/${id}/retiro`);
  evaluaciones = (seccionId: number) => this.get<Evaluacion[]>(`/secciones/${seccionId}/evaluaciones`);
  crearEvaluacion = (seccionId: number, nombre: string, ponderacion: number) =>
    this.post<Evaluacion>(`/secciones/${seccionId}/evaluaciones`, { nombre, ponderacion });
  eliminarEvaluacion = (id: number) => this.delete<void>(`/evaluaciones/${id}`);
  acta = (seccionId: number) => this.get<Acta>(`/secciones/${seccionId}/acta`);
  registrarNotas = (seccionId: number, notas: { inscripcion_id: number; evaluacion_id: number; nota: number }[]) =>
    this.put<Acta>(`/secciones/${seccionId}/notas`, { notas });
  cerrarActa = (seccionId: number) => this.post<Acta>(`/secciones/${seccionId}/cerrar-acta`);
  reabrirActa = (seccionId: number) => this.post<Acta>(`/secciones/${seccionId}/reabrir-acta`);

  // 7. Servicios transversales
  indicadores = (periodo_id?: number) => this.get<Indicadores>('/indicadores', { periodo_id });
  auditoria = (f?: Filtros) => this.get<Auditoria[]>('/auditoria', f);
  notificaciones = (solo_no_leidas = false) => this.get<Notificacion[]>('/notificaciones', { solo_no_leidas });
  marcarLeida = (id: number) => this.post<Notificacion>(`/notificaciones/${id}/leer`);
  marcarTodas = () => this.post<void>('/notificaciones/leer-todas');
}
