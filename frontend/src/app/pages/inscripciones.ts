import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { DIAS, Estudiante, Inscripcion, Periodo, Seccion } from '../core/models';

@Component({
  selector: 'app-inscripciones',
  imports: [FormsModule],
  template: `
    <h1>Inscripciones y retiros</h1>
    @if (msg()) { <div class="alert" [class.error]="esError()" [class.ok]="!esError()">{{ msg() }}</div> }

    <div class="card row">
      <label>Periodo
        <select [(ngModel)]="periodoId" (change)="cargar()">
          @for (p of periodos(); track p.id) { <option [ngValue]="p.id">{{ p.codigo }} · {{ p.estado }}</option> }
        </select>
      </label>
      @if (esGestor) {
        <label>Estudiante
          <select [(ngModel)]="estudianteId" (change)="cargar()">
            <option [ngValue]="null">Seleccione…</option>
            @for (e of estudiantes(); track e.id) { <option [ngValue]="e.id">{{ e.carnet }} · {{ e.apellidos }}, {{ e.nombres }}</option> }
          </select>
        </label>
      }
      <span class="spacer"></span>
      @if (periodoActual(); as p) {
        <span class="muted">Créditos inscritos: <strong>{{ creditos() }}</strong>
          @if (p.fecha_limite_retiro) { · Límite de retiro: {{ p.fecha_limite_retiro }} }</span>
      }
    </div>

    @if (!esGestor || estudianteId) {
      <div class="card">
        <h2>Cursos inscritos</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Curso</th><th>Créditos</th><th>Sección</th><th>Horario</th><th>Estado</th><th>Nota</th><th></th></tr></thead>
            <tbody>
              @for (i of inscripciones(); track i.id) {
                <tr>
                  <td>{{ i.seccion.curso.codigo }} · {{ i.seccion.curso.nombre }}</td>
                  <td>{{ i.seccion.curso.creditos }}</td>
                  <td>{{ i.seccion.codigo }}</td>
                  <td>{{ horario(i.seccion) }}</td>
                  <td><span class="badge" [class]="i.estado">{{ i.estado }}</span></td>
                  <td>{{ i.nota_final ?? '—' }}</td>
                  <td class="right">
                    @if (i.estado === 'inscrito') { <button class="link" (click)="retirar(i)">Retirar</button> }
                  </td>
                </tr>
              } @empty { <tr><td colspan="7" class="muted">Sin inscripciones en este periodo.</td></tr> }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>Oferta disponible</h2>
        @if (periodoActual()?.estado !== 'inscripcion') {
          <p class="muted">El periodo seleccionado no está en etapa de inscripción.</p>
        }
        <div class="table-wrap">
          <table>
            <thead><tr><th>Curso</th><th>Créditos</th><th>Sección</th><th>Docente</th><th>Horario</th><th>Cupos</th><th></th></tr></thead>
            <tbody>
              @for (s of oferta(); track s.id) {
                <tr>
                  <td>{{ s.curso.codigo }} · {{ s.curso.nombre }}</td>
                  <td>{{ s.curso.creditos }}</td>
                  <td>{{ s.codigo }}</td>
                  <td>{{ s.docente ? s.docente.nombres + ' ' + s.docente.apellidos : '—' }}</td>
                  <td>{{ horario(s) }}</td>
                  <td>{{ s.cupo - s.inscritos }} / {{ s.cupo }}</td>
                  <td class="right">
                    <button class="small" [disabled]="s.inscritos >= s.cupo || periodoActual()?.estado !== 'inscripcion'"
                      (click)="inscribir(s)">Inscribir</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="muted">Al inscribir se validan prerrequisitos, cupos, choques de horario y el máximo de créditos.</p>
      </div>
    }
  `,
})
export class InscripcionesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly esGestor = this.auth.tieneRol('admin', 'coordinador');

  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly estudiantes = signal<Estudiante[]>([]);
  protected readonly secciones = signal<Seccion[]>([]);
  protected readonly inscripciones = signal<Inscripcion[]>([]);
  protected readonly msg = signal('');
  protected readonly esError = signal(false);
  private readonly periodoSel = signal<number | null>(null);

  protected readonly periodoActual = computed(() => this.periodos().find((p) => p.id === this.periodoSel()) ?? null);
  protected readonly creditos = computed(() =>
    this.inscripciones().filter((i) => i.estado === 'inscrito').reduce((s, i) => s + i.seccion.curso.creditos, 0),
  );
  protected readonly oferta = computed(() => {
    const inscritas = new Set(this.inscripciones().filter((i) => i.estado !== 'retirado').map((i) => i.seccion.id));
    return this.secciones().filter((s) => !inscritas.has(s.id) && !s.acta_cerrada);
  });

  protected get periodoId(): number | null {
    return this.periodoSel();
  }
  protected set periodoId(v: number | null) {
    this.periodoSel.set(v);
  }
  protected estudianteId: number | null = null;

  ngOnInit(): void {
    if (this.esGestor) this.api.estudiantes({ estado: 'activo' }).subscribe((e) => this.estudiantes.set(e));
    this.api.periodos().subscribe((p) => {
      this.periodos.set(p);
      const preferido = p.find((x) => x.estado === 'inscripcion') ?? p[0];
      this.periodoId = preferido?.id ?? null;
      this.cargar();
    });
  }

  cargar(): void {
    if (!this.periodoId) return;
    this.api.secciones({ periodo_id: this.periodoId }).subscribe((s) => this.secciones.set(s));
    if (this.esGestor && !this.estudianteId) {
      this.inscripciones.set([]);
      return;
    }
    this.api
      .inscripciones({ periodo_id: this.periodoId, estudiante_id: this.estudianteId })
      .subscribe((i) => this.inscripciones.set(i));
  }

  private aviso(texto: string, error = false): void {
    this.msg.set(texto);
    this.esError.set(error);
  }

  inscribir(s: Seccion): void {
    this.api.inscribir(s.id, this.estudianteId ?? undefined).subscribe({
      next: () => {
        this.aviso(`Inscripción en ${s.curso.codigo} sección ${s.codigo} registrada.`);
        this.cargar();
      },
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }

  retirar(i: Inscripcion): void {
    if (!confirm(`¿Confirma el retiro de ${i.seccion.curso.codigo} - ${i.seccion.curso.nombre}?`)) return;
    this.api.retirar(i.id).subscribe({
      next: () => {
        this.aviso('Retiro registrado.');
        this.cargar();
      },
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }

  horario(s: Seccion): string {
    return s.horarios.map((h) => `${DIAS[h.dia].slice(0, 3)} ${h.hora_inicio.slice(0, 5)}-${h.hora_fin.slice(0, 5)}`).join(', ') || '—';
  }
}
