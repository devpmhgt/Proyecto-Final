import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Carrera, Curso, Plan } from '../core/models';

type Pestana = 'carreras' | 'cursos' | 'planes';

@Component({
  selector: 'app-catalogo',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <h1>Catálogo académico</h1>
    <div class="tabs">
      <button [class.active]="tab() === 'carreras'" (click)="tab.set('carreras')">Carreras</button>
      <button [class.active]="tab() === 'cursos'" (click)="tab.set('cursos')">Cursos y prerrequisitos</button>
      <button [class.active]="tab() === 'planes'" (click)="tab.set('planes')">Planes de estudio</button>
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @switch (tab()) {
      @case ('carreras') {
        <form class="card" [formGroup]="fCarrera" (ngSubmit)="guardarCarrera()">
          <h2>{{ carreraEdit() ? 'Editar carrera' : 'Nueva carrera' }}</h2>
          <div class="form-grid">
            <label>Código <input formControlName="codigo" /></label>
            <label>Nombre <input formControlName="nombre" /></label>
            <label>Facultad <input formControlName="facultad" /></label>
            <label class="check"><input type="checkbox" formControlName="activa" /> Activa</label>
          </div>
          <div class="row">
            <button type="submit" [disabled]="fCarrera.invalid">Guardar</button>
            @if (carreraEdit()) { <button type="button" class="secondary" (click)="limpiarCarrera()">Cancelar</button> }
          </div>
        </form>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Facultad</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (c of carreras(); track c.id) {
                <tr>
                  <td>{{ c.codigo }}</td><td>{{ c.nombre }}</td><td>{{ c.facultad }}</td>
                  <td><span class="badge" [class]="c.activa ? 'activo' : 'inactivo'">{{ c.activa ? 'activa' : 'inactiva' }}</span></td>
                  <td class="right"><button class="link" (click)="editarCarrera(c)">Editar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @case ('cursos') {
        <form class="card" [formGroup]="fCurso" (ngSubmit)="guardarCurso()">
          <h2>{{ cursoEdit() ? 'Editar curso' : 'Nuevo curso' }}</h2>
          <div class="form-grid">
            <label>Código <input formControlName="codigo" /></label>
            <label>Nombre <input formControlName="nombre" /></label>
            <label>Créditos <input type="number" formControlName="creditos" /></label>
            <label>Horas por semana <input type="number" formControlName="horas_semana" /></label>
            <label>Prerrequisitos (Ctrl+clic para varios)
              <select multiple formControlName="prerrequisito_ids">
                @for (c of cursos(); track c.id) {
                  @if (c.id !== cursoEdit()?.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
                }
              </select>
            </label>
            <label>Descripción <textarea formControlName="descripcion" rows="3"></textarea></label>
          </div>
          <div class="row">
            <button type="submit" [disabled]="fCurso.invalid">Guardar</button>
            @if (cursoEdit()) { <button type="button" class="secondary" (click)="limpiarCurso()">Cancelar</button> }
          </div>
        </form>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Créditos</th><th>Horas</th><th>Prerrequisitos</th><th></th></tr></thead>
            <tbody>
              @for (c of cursos(); track c.id) {
                <tr>
                  <td>{{ c.codigo }}</td><td>{{ c.nombre }}</td><td>{{ c.creditos }}</td><td>{{ c.horas_semana }}</td>
                  <td>
                    @for (p of c.prerrequisitos; track p.id) { <span class="badge">{{ p.codigo }}</span>&nbsp; }
                    @empty { <span class="muted">—</span> }
                  </td>
                  <td class="right"><button class="link" (click)="editarCurso(c)">Editar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @case ('planes') {
        <div class="grid grid-2">
          <form class="card" [formGroup]="fPlan" (ngSubmit)="crearPlan()">
            <h2>Nuevo plan de estudios</h2>
            <div class="form-grid">
              <label>Carrera
                <select formControlName="carrera_id">
                  @for (c of carreras(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
                </select>
              </label>
              <label>Código <input formControlName="codigo" /></label>
              <label>Nombre <input formControlName="nombre" /></label>
              <label>Año <input type="number" formControlName="anio" /></label>
            </div>
            <button type="submit" [disabled]="fPlan.invalid">Crear plan</button>
          </form>
          <div class="card">
            <h2>Planes</h2>
            <table>
              @for (p of planes(); track p.id) {
                <tr [class.selected]="planSel()?.id === p.id">
                  <td>{{ p.codigo }}</td><td>{{ p.nombre }}</td><td>{{ p.anio }}</td>
                  <td class="right"><button class="link" (click)="planSel.set(p)">Ver cursos</button></td>
                </tr>
              }
            </table>
          </div>
        </div>
        @if (planSel(); as p) {
          <div class="card">
            <h2>{{ p.nombre }} · {{ totalCreditos() }} créditos</h2>
            <table>
              <thead><tr><th>Semestre</th><th>Curso</th><th>Créditos</th><th></th></tr></thead>
              <tbody>
                @for (pc of cursosPlan(); track pc.id) {
                  <tr>
                    <td>{{ pc.semestre }}</td><td>{{ pc.curso.codigo }} · {{ pc.curso.nombre }}</td><td>{{ pc.curso.creditos }}</td>
                    <td class="right"><button class="link" (click)="quitarCursoPlan(p, pc.curso.id)">Quitar</button></td>
                  </tr>
                }
              </tbody>
            </table>
            <div class="row" style="margin-top:.75rem">
              <select [(ngModel)]="cursoAgregar">
                <option [ngValue]="null">Seleccione un curso…</option>
                @for (c of cursos(); track c.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
              </select>
              <input type="number" min="1" [(ngModel)]="semestreAgregar" style="width:6rem" placeholder="Semestre" />
              <button [disabled]="!cursoAgregar" (click)="agregarCursoPlan(p)">Agregar al plan</button>
            </div>
          </div>
        }
      }
    }
  `,
})
export class CatalogoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly tab = signal<Pestana>('carreras');
  protected readonly error = signal('');
  protected readonly carreras = signal<Carrera[]>([]);
  protected readonly cursos = signal<Curso[]>([]);
  protected readonly planes = signal<Plan[]>([]);
  protected readonly carreraEdit = signal<Carrera | null>(null);
  protected readonly cursoEdit = signal<Curso | null>(null);
  protected readonly planSel = signal<Plan | null>(null);
  protected readonly cursosPlan = computed(() =>
    [...(this.planSel()?.cursos ?? [])].sort((a, b) => a.semestre - b.semestre || a.curso.codigo.localeCompare(b.curso.codigo)),
  );
  protected readonly totalCreditos = computed(() => this.cursosPlan().reduce((s, pc) => s + pc.curso.creditos, 0));
  protected cursoAgregar: number | null = null;
  protected semestreAgregar = 1;

  protected readonly fCarrera = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    facultad: [''],
    activa: [true],
  });
  protected readonly fCurso = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    creditos: [4, [Validators.required, Validators.min(0)]],
    horas_semana: [4, Validators.min(0)],
    descripcion: [''],
    prerrequisito_ids: [[] as number[]],
  });
  protected readonly fPlan = this.fb.group({
    carrera_id: [null as number | null, Validators.required],
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    anio: [new Date().getFullYear(), Validators.required],
  });

  ngOnInit(): void {
    this.api.carreras().subscribe((c) => this.carreras.set(c));
    this.api.cursos().subscribe((c) => this.cursos.set(c));
    this.cargarPlanes();
  }

  private cargarPlanes(seleccionar?: number): void {
    this.api.planes().subscribe((p) => {
      this.planes.set(p);
      if (seleccionar) this.planSel.set(p.find((x) => x.id === seleccionar) ?? null);
    });
  }

  private manejar = <T>(ok: (v: T) => void) => ({
    next: (v: T) => {
      this.error.set('');
      ok(v);
    },
    error: (e: unknown) => this.error.set(mensajeError(e)),
  });

  editarCarrera(c: Carrera): void {
    this.carreraEdit.set(c);
    this.fCarrera.reset({ ...c, facultad: c.facultad ?? '' });
  }

  limpiarCarrera(): void {
    this.carreraEdit.set(null);
    this.fCarrera.reset();
  }

  guardarCarrera(): void {
    const datos = this.fCarrera.getRawValue();
    const actual = this.carreraEdit();
    (actual ? this.api.actualizarCarrera(actual.id, datos) : this.api.crearCarrera(datos)).subscribe(
      this.manejar(() => {
        this.limpiarCarrera();
        this.api.carreras().subscribe((c) => this.carreras.set(c));
      }),
    );
  }

  editarCurso(c: Curso): void {
    this.cursoEdit.set(c);
    this.fCurso.reset({ ...c, descripcion: c.descripcion ?? '', prerrequisito_ids: c.prerrequisitos.map((p) => p.id) });
  }

  limpiarCurso(): void {
    this.cursoEdit.set(null);
    this.fCurso.reset();
  }

  guardarCurso(): void {
    const datos = this.fCurso.getRawValue();
    const actual = this.cursoEdit();
    (actual ? this.api.actualizarCurso(actual.id, datos) : this.api.crearCurso(datos)).subscribe(
      this.manejar(() => {
        this.limpiarCurso();
        this.api.cursos().subscribe((c) => this.cursos.set(c));
      }),
    );
  }

  crearPlan(): void {
    this.api.crearPlan(this.fPlan.getRawValue() as Partial<Plan>).subscribe(
      this.manejar((p: Plan) => {
        this.fPlan.reset({ anio: new Date().getFullYear() });
        this.cargarPlanes(p.id);
      }),
    );
  }

  agregarCursoPlan(p: Plan): void {
    this.api.agregarCursoPlan(p.id, this.cursoAgregar!, this.semestreAgregar).subscribe(
      this.manejar(() => {
        this.cursoAgregar = null;
        this.cargarPlanes(p.id);
      }),
    );
  }

  quitarCursoPlan(p: Plan, cursoId: number): void {
    this.api.quitarCursoPlan(p.id, cursoId).subscribe(this.manejar(() => this.cargarPlanes(p.id)));
  }
}
