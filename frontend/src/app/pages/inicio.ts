import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { DIAS, Indicadores, Inscripcion, Seccion } from '../core/models';

@Component({
  selector: 'app-inicio',
  imports: [DecimalPipe, RouterLink],
  template: `
    <h1>Bienvenido, {{ auth.usuario()?.nombre }}</h1>

    @if (ind(); as i) {
      <p class="muted">Periodo de referencia: <strong>{{ i.periodo_actual ?? '—' }}</strong></p>
      <div class="grid grid-kpi" style="margin-bottom:1rem">
        <div class="card kpi"><div class="valor">{{ i.estudiantes_activos }}</div><div class="etq">Estudiantes activos</div></div>
        <div class="card kpi"><div class="valor">{{ i.docentes_activos }}</div><div class="etq">Docentes activos</div></div>
        <div class="card kpi"><div class="valor">{{ i.carreras }}</div><div class="etq">Carreras</div></div>
        <div class="card kpi"><div class="valor">{{ i.cursos }}</div><div class="etq">Cursos en catálogo</div></div>
        <div class="card kpi"><div class="valor">{{ i.secciones_periodo }}</div><div class="etq">Secciones del periodo</div></div>
        <div class="card kpi"><div class="valor">{{ i.inscripciones_periodo }}</div><div class="etq">Inscripciones vigentes</div></div>
        <div class="card kpi"><div class="valor">{{ i.ocupacion_promedio | number: '1.0-1' }}%</div><div class="etq">Ocupación promedio de cupos</div></div>
        <div class="card kpi">
          <div class="valor">{{ i.tasa_aprobacion === null ? '—' : (i.tasa_aprobacion | number: '1.0-1') + '%' }}</div>
          <div class="etq">Tasa de aprobación (actas cerradas)</div>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h2>Estudiantes activos por carrera</h2>
          @for (c of i.estudiantes_por_carrera; track c.nombre) {
            <div style="margin-bottom:.6rem">
              <div class="row"><span>{{ c.nombre }}</span><span class="spacer"></span><strong>{{ c.total }}</strong></div>
              <div class="bar"><span [style.width.%]="(100 * c.total) / maxCarrera()"></span></div>
            </div>
          } @empty { <p class="muted">Sin datos.</p> }
        </div>
        <div class="card">
          <h2>Estudiantes por estado</h2>
          <table>
            @for (e of i.estudiantes_por_estado; track e.estado) {
              <tr><td><span class="badge" [class]="e.estado">{{ e.estado }}</span></td><td class="right">{{ e.total }}</td></tr>
            }
          </table>
        </div>
      </div>
    }

    @if (auth.rol() === 'estudiante') {
      <div class="card">
        <div class="row"><h2>Mis cursos inscritos</h2><span class="spacer"></span>
          <a routerLink="/avance">Ver mi avance →</a>&nbsp;·&nbsp;<a routerLink="/inscripciones">Ir a inscripciones →</a></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Curso</th><th>Sección</th><th>Docente</th><th>Horario</th><th>Estado</th><th>Nota</th></tr></thead>
            <tbody>
              @for (i of misInscripciones(); track i.id) {
                <tr>
                  <td>{{ i.seccion.curso.codigo }} · {{ i.seccion.curso.nombre }}</td>
                  <td>{{ i.seccion.codigo }}</td>
                  <td>{{ i.seccion.docente ? i.seccion.docente.nombres + ' ' + i.seccion.docente.apellidos : '—' }}</td>
                  <td>{{ horario(i.seccion) }}</td>
                  <td><span class="badge" [class]="i.estado">{{ i.estado }}</span></td>
                  <td>{{ i.nota_final ?? '—' }}</td>
                </tr>
              } @empty { <tr><td colspan="6" class="muted">No tiene inscripciones.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (auth.rol() === 'docente') {
      <div class="card">
        <div class="row"><h2>Mis secciones</h2><span class="spacer"></span><a routerLink="/notas">Registrar notas →</a></div>
        <table>
          <thead><tr><th>Curso</th><th>Sección</th><th>Horario</th><th>Inscritos</th><th>Acta</th></tr></thead>
          <tbody>
            @for (s of misSecciones(); track s.id) {
              <tr>
                <td>{{ s.curso.codigo }} · {{ s.curso.nombre }}</td>
                <td>{{ s.codigo }}</td>
                <td>{{ horario(s) }}</td>
                <td>{{ s.inscritos }} / {{ s.cupo }}</td>
                <td><span class="badge" [class.cerrado]="s.acta_cerrada">{{ s.acta_cerrada ? 'cerrada' : 'abierta' }}</span></td>
              </tr>
            } @empty { <tr><td colspan="5" class="muted">No tiene secciones asignadas.</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class Inicio implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  protected readonly ind = signal<Indicadores | null>(null);
  protected readonly misInscripciones = signal<Inscripcion[]>([]);
  protected readonly misSecciones = signal<Seccion[]>([]);
  protected readonly maxCarrera = computed(() =>
    Math.max(1, ...(this.ind()?.estudiantes_por_carrera.map((c) => c.total) ?? [])),
  );

  ngOnInit(): void {
    if (this.auth.tieneRol('admin', 'coordinador')) {
      this.api.indicadores().subscribe((i) => this.ind.set(i));
    }
    if (this.auth.rol() === 'estudiante') {
      this.api.inscripciones().subscribe((i) => this.misInscripciones.set(i));
    }
    if (this.auth.rol() === 'docente') {
      this.api.miPerfilDocente().subscribe((d) =>
        this.api.secciones({ docente_id: d.id }).subscribe((s) => this.misSecciones.set(s)),
      );
    }
  }

  horario(s: Seccion): string {
    return s.horarios.map((h) => `${DIAS[h.dia].slice(0, 3)} ${h.hora_inicio.slice(0, 5)}-${h.hora_fin.slice(0, 5)}`).join(', ') || '—';
  }
}
