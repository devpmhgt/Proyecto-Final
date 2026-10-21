import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Carrera, EstadoEstudiante, Estudiante, Inscripcion, Plan } from '../core/models';

@Component({
  selector: 'app-estudiantes',
  imports: [ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="row"><h1>Estudiantes</h1><span class="spacer"></span>
      <button (click)="nuevo()">+ Nuevo estudiante</button>
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @if (editando() !== undefined) {
      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        <h2>{{ editando() ? 'Editar expediente' : 'Nuevo expediente' }}</h2>
        <div class="form-grid">
          <label>Carnet <input formControlName="carnet" [readonly]="!!editando()" /></label>
          <label>Nombres <input formControlName="nombres" /></label>
          <label>Apellidos <input formControlName="apellidos" /></label>
          <label>Correo <input type="email" formControlName="email" /></label>
          <label>Teléfono <input formControlName="telefono" /></label>
          <label>Fecha de nacimiento <input type="date" formControlName="fecha_nacimiento" /></label>
          <label>Carrera
            <select formControlName="carrera_id">
              @for (c of carreras(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
            </select>
          </label>
          <label>Plan de estudios
            <select formControlName="plan_id">
              <option [ngValue]="null">—</option>
              @for (p of planesCarrera(); track p.id) { <option [ngValue]="p.id">{{ p.codigo }}</option> }
            </select>
          </label>
          <label>Estado
            <select formControlName="estado">
              @for (e of estados; track e) { <option [value]="e">{{ e }}</option> }
            </select>
          </label>
          <label>Fecha de ingreso <input type="date" formControlName="fecha_ingreso" /></label>
          @if (!editando()) {
            <label>Contraseña de acceso (opcional) <input type="password" formControlName="password" /></label>
          }
        </div>
        <div class="row">
          <button type="submit" [disabled]="form.invalid">Guardar</button>
          <button type="button" class="secondary" (click)="editando.set(undefined)">Cancelar</button>
        </div>
      </form>
    }

    <div class="card">
      <div class="row" style="margin-bottom:.75rem">
        <input placeholder="Buscar por carnet o nombre" [(ngModel)]="q" (keyup.enter)="cargar()" />
        <select [(ngModel)]="filtroCarrera" (change)="cargar()">
          <option [ngValue]="null">Todas las carreras</option>
          @for (c of carreras(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
        </select>
        <select [(ngModel)]="filtroEstado" (change)="cargar()">
          <option value="">Todos los estados</option>
          @for (e of estados; track e) { <option [value]="e">{{ e }}</option> }
        </select>
        <button class="secondary" (click)="cargar()">Buscar</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Carnet</th><th>Nombre</th><th>Carrera</th><th>Correo</th><th>Estado</th><th>Cuenta</th><th></th></tr></thead>
          <tbody>
            @for (e of estudiantes(); track e.id) {
              <tr [class.selected]="historial()?.id === e.id">
                <td>{{ e.carnet }}</td>
                <td>{{ e.apellidos }}, {{ e.nombres }}</td>
                <td>{{ nombreCarrera(e.carrera_id) }}</td>
                <td>{{ e.email }}</td>
                <td><span class="badge" [class]="e.estado">{{ e.estado }}</span></td>
                <td>{{ e.usuario_id ? 'Sí' : 'No' }}</td>
                <td class="right">
                  <button class="link" (click)="editar(e)">Editar</button>
                  <button class="link" (click)="verHistorial(e)">Historial</button>
                  <a class="link" [routerLink]="['/avance']" [queryParams]="{ estudiante: e.id }">Avance</a>
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="muted">Sin resultados.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>

    @if (historial(); as h) {
      <div class="card">
        <h2>Historial académico · {{ h.nombres }} {{ h.apellidos }}</h2>
        <table>
          <thead><tr><th>Periodo</th><th>Curso</th><th>Sección</th><th>Estado</th><th>Nota final</th></tr></thead>
          <tbody>
            @for (i of inscripciones(); track i.id) {
              <tr>
                <td>{{ i.seccion.periodo_id }}</td>
                <td>{{ i.seccion.curso.codigo }} · {{ i.seccion.curso.nombre }}</td>
                <td>{{ i.seccion.codigo }}</td>
                <td><span class="badge" [class]="i.estado">{{ i.estado }}</span></td>
                <td>{{ i.nota_final ?? '—' }}</td>
              </tr>
            } @empty { <tr><td colspan="5" class="muted">Sin inscripciones registradas.</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class EstudiantesPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly estados: EstadoEstudiante[] = ['activo', 'inactivo', 'suspendido', 'egresado', 'graduado'];
  protected readonly estudiantes = signal<Estudiante[]>([]);
  protected readonly carreras = signal<Carrera[]>([]);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly error = signal('');
  /** undefined = formulario oculto; null = creando; Estudiante = editando */
  protected readonly editando = signal<Estudiante | null | undefined>(undefined);
  protected readonly historial = signal<Estudiante | null>(null);
  protected readonly inscripciones = signal<Inscripcion[]>([]);
  private readonly carreraForm = signal<number | null>(null);
  protected readonly planesCarrera = computed(() => this.planes().filter((p) => p.carrera_id === this.carreraForm()));

  protected q = '';
  protected filtroCarrera: number | null = null;
  protected filtroEstado = '';

  protected readonly form = inject(FormBuilder).group({
    carnet: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    fecha_nacimiento: [null as string | null],
    carrera_id: [null as number | null, Validators.required],
    plan_id: [null as number | null],
    estado: ['activo' as EstadoEstudiante],
    fecha_ingreso: [null as string | null],
    password: ['', Validators.minLength(8)],
  });

  ngOnInit(): void {
    this.api.carreras().subscribe((c) => this.carreras.set(c));
    this.api.planes().subscribe((p) => this.planes.set(p));
    this.form.controls.carrera_id.valueChanges.subscribe((v) => this.carreraForm.set(v));
    this.cargar();
  }

  cargar(): void {
    this.api
      .estudiantes({ q: this.q, carrera_id: this.filtroCarrera, estado: this.filtroEstado })
      .subscribe((e) => this.estudiantes.set(e));
  }

  nombreCarrera(id: number): string {
    return this.carreras().find((c) => c.id === id)?.nombre ?? '';
  }

  nuevo(): void {
    this.form.reset({ estado: 'activo' });
    this.editando.set(null);
  }

  editar(e: Estudiante): void {
    this.form.reset({ ...e, password: '' });
    this.editando.set(e);
  }

  guardar(): void {
    this.error.set('');
    const { password, carnet, ...datos } = this.form.getRawValue();
    const actual = this.editando();
    const peticion = actual
      ? this.api.actualizarEstudiante(actual.id, datos as Partial<Estudiante>)
      : this.api.crearEstudiante({ ...datos, carnet, ...(password ? { password } : {}) } as Partial<Estudiante>);
    peticion.subscribe({
      next: () => {
        this.editando.set(undefined);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  verHistorial(e: Estudiante): void {
    this.historial.set(e);
    this.api.inscripciones({ estudiante_id: e.id }).subscribe((i) => this.inscripciones.set(i));
  }
}
