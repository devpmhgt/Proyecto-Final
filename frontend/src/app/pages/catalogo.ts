import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { Carrera, Curso, Plan } from '../core/models';
import { ImportarPensum } from './importar-pensum';

type Pestana = 'carreras' | 'cursos' | 'planes' | 'importar';

@Component({
  selector: 'app-catalogo',
  imports: [ReactiveFormsModule, FormsModule, ImportarPensum],
  template: `
    <h1>Catálogo académico</h1>
    <div class="tabs">
      <button [class.active]="tab() === 'carreras'" (click)="tab.set('carreras')">Carreras</button>
      <button [class.active]="tab() === 'cursos'" (click)="tab.set('cursos')">Cursos y prerrequisitos</button>
      <button [class.active]="tab() === 'planes'" (click)="tab.set('planes')">Planes de estudio</button>
      @if (esAdmin) {
        <button [class.active]="tab() === 'importar'" (click)="tab.set('importar')">Importar pensum (CSV)</button>
      }
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @switch (tab()) {
      @case ('importar') {
        <app-importar-pensum [carreras]="carreras()" (importado)="alImportar($event)" />
      }
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
        <div class="card row">
          <label style="flex:1;min-width:16rem">Carrera
            <select [ngModel]="carreraCursos()" (ngModelChange)="elegirCarrera($event)">
              @for (c of carreras(); track c.id) { <option [ngValue]="c.id">{{ c.nombre }}</option> }
              <option [ngValue]="SIN_PLAN">Cursos sin plan de estudios</option>
            </select>
          </label>
          <span class="muted">{{ cursosCarrera().length }} curso(s). Los prerrequisitos se eligen entre los cursos de esta carrera.</span>
        </div>

        <form class="card" [formGroup]="fCurso" (ngSubmit)="guardarCurso()">
          <h2>{{ cursoEdit() ? 'Editar curso' : 'Nuevo curso' }}</h2>
          <div class="form-grid">
            <label>Código <input formControlName="codigo" /></label>
            <label>Nombre <input formControlName="nombre" /></label>
            <label>Créditos <input type="number" formControlName="creditos" /></label>
            <label>Horas por semana <input type="number" formControlName="horas_semana" /></label>
            <label>Créditos aprobados requeridos <input type="number" min="0" formControlName="creditos_requeridos" placeholder="ej. 70" /></label>
            <label>Descripción <textarea formControlName="descripcion" rows="2"></textarea></label>
            @if (!cursoEdit() && planesCarrera().length) {
              <label>Agregar al plan
                <select [(ngModel)]="planDestino" [ngModelOptions]="{ standalone: true }">
                  <option [ngValue]="null">No agregar</option>
                  @for (p of planesCarrera(); track p.id) { <option [ngValue]="p.id">{{ p.codigo }} · {{ p.nombre }}</option> }
                </select>
              </label>
              @if (planDestino) {
                <label>Semestre o ciclo <input type="number" min="1" [(ngModel)]="semestreDestino" [ngModelOptions]="{ standalone: true }" /></label>
              }
            }
          </div>

          <div class="prerreq">
            <span class="etq">Prerrequisitos</span>
            <div class="row">
              @for (id of fCurso.controls.prerrequisito_ids.value; track id) {
                <span class="chip">
                  {{ cursoPorId(id)?.codigo }} · {{ cursoPorId(id)?.nombre }}
                  <button type="button" (click)="quitarPrerrequisito(id)" [attr.aria-label]="'Quitar prerrequisito ' + cursoPorId(id)?.codigo">✕</button>
                </span>
              } @empty { <span class="muted">Sin prerrequisitos.</span> }
            </div>
            <select [ngModel]="null" [ngModelOptions]="{ standalone: true }" (ngModelChange)="agregarPrerrequisito($event)" aria-label="Agregar prerrequisito">
              <option [ngValue]="null">+ Agregar prerrequisito…</option>
              @for (c of opcionesPrerrequisito(); track c.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
            </select>
          </div>

          <div class="row">
            <button type="submit" [disabled]="fCurso.invalid">Guardar</button>
            @if (cursoEdit()) { <button type="button" class="secondary" (click)="limpiarCurso()">Cancelar</button> }
          </div>
        </form>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Ciclo</th><th>Código</th><th>Nombre</th><th>Créditos</th><th>Horas</th><th>Prerrequisitos</th><th></th></tr></thead>
            <tbody>
              @for (c of cursosCarrera(); track c.id) {
                <tr [class.selected]="cursoEdit()?.id === c.id">
                  <td>{{ cicloDe(c.id) ?? '—' }}</td>
                  <td>{{ c.codigo }}</td><td>{{ c.nombre }}</td><td>{{ c.creditos }}</td><td>{{ c.horas_semana }}</td>
                  <td>
                    @for (p of c.prerrequisitos; track p.id) { <span class="badge">{{ p.codigo }}</span>&nbsp; }
                    @if (c.creditos_requeridos) { <span class="badge warn">{{ c.creditos_requeridos }} Crs.</span> }
                    @if (!c.prerrequisitos.length && !c.creditos_requeridos) { <span class="muted">—</span> }
                  </td>
                  <td class="right"><button class="link" (click)="editarCurso(c)">Editar</button></td>
                </tr>
              } @empty { <tr><td colspan="7" class="muted">No hay cursos en esta carrera.</td></tr> }
            </tbody>
          </table>
        </div>
      }

      @case ('planes') {
        @if (planSel(); as p) {
          <div class="card">
            <div class="row">
              <button class="secondary small" (click)="planSel.set(null)">← Todos los planes</button>
              <h2 style="margin:0">{{ p.codigo }} · {{ p.nombre }}</h2>
              <span class="spacer"></span>
              <span class="muted">{{ nombreCarrera(p.carrera_id) }} · {{ p.anio }} · {{ p.cursos.length }} cursos · {{ totalCreditos() }} créditos</span>
            </div>
            @for (g of semestresPlan(); track g.semestre) {
              <h3>Ciclo {{ g.semestre }} <span class="muted" style="font-weight:400">· {{ g.creditos }} créditos</span></h3>
              <table>
                <tbody>
                  @for (pc of g.cursos; track pc.id) {
                    <tr>
                      <td style="width:6rem">{{ pc.curso.codigo }}</td><td>{{ pc.curso.nombre }}</td><td style="width:6rem">{{ pc.curso.creditos }} cr.</td>
                      <td class="right"><button class="link" (click)="quitarCursoPlan(p, pc.curso.id)">Quitar</button></td>
                    </tr>
                  }
                </tbody>
              </table>
            } @empty { <p class="muted">Este plan aún no tiene cursos. Agrégalos abajo o impórtalo desde CSV.</p> }
            <div class="row" style="margin-top:1rem">
              <select [(ngModel)]="cursoAgregar" aria-label="Curso para agregar">
                <option [ngValue]="null">Seleccione un curso…</option>
                @for (c of cursosFueraDelPlan(); track c.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
              </select>
              <input type="number" min="1" [(ngModel)]="semestreAgregar" style="width:6rem" placeholder="Ciclo" aria-label="Ciclo" />
              <button [disabled]="!cursoAgregar" (click)="agregarCursoPlan(p)">Agregar al plan</button>
            </div>
          </div>
        } @else {
          <div class="card">
            <div class="row">
              <h2 style="margin:0">Planes de estudio</h2>
              <span class="spacer"></span>
              <button (click)="nuevoPlan.set(!nuevoPlan())">{{ nuevoPlan() ? 'Cancelar' : '+ Nuevo plan' }}</button>
            </div>
            @if (nuevoPlan()) {
              <form [formGroup]="fPlan" (ngSubmit)="crearPlan()" style="margin-top:1rem">
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
            }
            <div class="table-wrap" style="margin-top:1rem">
              <table>
                <thead><tr><th>Carrera</th><th>Código</th><th>Nombre</th><th>Año</th><th>Cursos</th><th>Créditos</th><th></th></tr></thead>
                <tbody>
                  @for (p of planes(); track p.id) {
                    <tr class="clicable" (click)="planSel.set(p)">
                      <td>{{ nombreCarrera(p.carrera_id) }}</td><td>{{ p.codigo }}</td><td>{{ p.nombre }}</td><td>{{ p.anio }}</td>
                      <td>{{ p.cursos.length }}</td><td>{{ creditosDe(p) }}</td>
                      <td class="right"><button class="link">Ver plan</button></td>
                    </tr>
                  } @empty { <tr><td colspan="7" class="muted">No hay planes. Crea uno o impórtalo desde CSV.</td></tr> }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    }
  `,
  styles: `
    tr.clicable { cursor: pointer; }
    .prerreq { display: grid; gap: .5rem; margin: .5rem 0 1rem; }
    .prerreq .etq { font-size: .85rem; font-weight: 600; }
    .prerreq select { max-width: 32rem; }
    .chip { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .3rem .2rem .6rem; border: 1px solid var(--border);
      border-radius: 999px; background: var(--bg); font-size: .85rem; }
    .chip button { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0 .3rem; font-size: .8rem; }
    .chip button:hover { color: var(--danger); }
  `,
})
export class CatalogoPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  protected readonly esAdmin = inject(AuthService).tieneRol('admin');

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
  protected readonly semestresPlan = computed(() => {
    const grupos = new Map<number, Plan['cursos']>();
    for (const pc of this.cursosPlan()) grupos.set(pc.semestre, [...(grupos.get(pc.semestre) ?? []), pc]);
    return [...grupos].map(([semestre, cursos]) => ({ semestre, cursos, creditos: cursos.reduce((s, pc) => s + pc.curso.creditos, 0) }));
  });
  protected readonly cursosFueraDelPlan = computed(() => {
    const dentro = new Set(this.planSel()?.cursos.map((pc) => pc.curso.id));
    return this.cursos().filter((c) => !dentro.has(c.id));
  });
  protected cursoAgregar: number | null = null;
  protected semestreAgregar = 1;
  protected readonly nuevoPlan = signal(false);

  // Cursos por carrera: un curso pertenece a la carrera de los planes que lo incluyen
  protected readonly SIN_PLAN = -1;
  private readonly carreraElegida = signal<number | null>(null);
  /** Carrera elegida o, al entrar, la que tiene más cursos en sus planes. */
  protected readonly carreraCursos = computed(() => {
    const elegida = this.carreraElegida();
    if (elegida !== null) return elegida;
    const principal = [...this.planes()].sort((a, b) => b.cursos.length - a.cursos.length)[0];
    return principal?.carrera_id ?? this.carreras()[0]?.id ?? null;
  });
  protected readonly planesCarrera = computed(() => this.planes().filter((p) => p.carrera_id === this.carreraCursos()));
  /** Ciclo de cada curso dentro de los planes de la carrera elegida (el menor si aparece en varios). */
  private readonly ciclos = computed(() => {
    const ciclos = new Map<number, number>();
    for (const pc of this.planesCarrera().flatMap((p) => p.cursos)) {
      ciclos.set(pc.curso.id, Math.min(pc.semestre, ciclos.get(pc.curso.id) ?? Infinity));
    }
    return ciclos;
  });
  protected readonly cursosCarrera = computed(() => {
    if (this.carreraCursos() === this.SIN_PLAN) {
      const enPlanes = new Set(this.planes().flatMap((p) => p.cursos.map((pc) => pc.curso.id)));
      return this.cursos().filter((c) => !enPlanes.has(c.id));
    }
    const ciclos = this.ciclos();
    return this.cursos()
      .filter((c) => ciclos.has(c.id))
      .sort((a, b) => ciclos.get(a.id)! - ciclos.get(b.id)! || a.codigo.localeCompare(b.codigo));
  });
  protected planDestino: number | null = null;
  protected semestreDestino = 1;

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
    creditos_requeridos: [null as number | null, Validators.min(0)],
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

  alImportar(planId: number): void {
    this.api.cursos().subscribe((c) => this.cursos.set(c));
    this.cargarPlanes(planId);
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

  elegirCarrera(id: number): void {
    this.carreraElegida.set(id);
    this.planDestino = null;
    this.limpiarCurso();
  }

  cicloDe(cursoId: number): number | undefined {
    return this.ciclos().get(cursoId);
  }

  cursoPorId(id: number): Curso | undefined {
    return this.cursos().find((c) => c.id === id);
  }

  /** Cursos que se pueden agregar como prerrequisito: los de la carrera, sin el propio curso ni los ya elegidos. */
  opcionesPrerrequisito(): Curso[] {
    const elegidos = new Set(this.fCurso.controls.prerrequisito_ids.value);
    const base = this.carreraCursos() === this.SIN_PLAN ? this.cursos() : this.cursosCarrera();
    return base.filter((c) => c.id !== this.cursoEdit()?.id && !elegidos.has(c.id));
  }

  agregarPrerrequisito(id: number | null): void {
    if (id === null) return;
    const control = this.fCurso.controls.prerrequisito_ids;
    control.setValue([...control.value, id]);
  }

  quitarPrerrequisito(id: number): void {
    const control = this.fCurso.controls.prerrequisito_ids;
    control.setValue(control.value.filter((p) => p !== id));
  }

  guardarCurso(): void {
    const datos = this.fCurso.getRawValue();
    const actual = this.cursoEdit();
    const plan = actual ? null : this.planDestino;
    (actual ? this.api.actualizarCurso(actual.id, datos) : this.api.crearCurso(datos)).subscribe(
      this.manejar((curso: Curso) => {
        this.limpiarCurso();
        this.api.cursos().subscribe((c) => this.cursos.set(c));
        if (plan) this.api.agregarCursoPlan(plan, curso.id, this.semestreDestino).subscribe(this.manejar(() => this.cargarPlanes()));
      }),
    );
  }

  nombreCarrera(id: number): string {
    return this.carreras().find((c) => c.id === id)?.nombre ?? '';
  }

  creditosDe(p: Plan): number {
    return p.cursos.reduce((s, pc) => s + pc.curso.creditos, 0);
  }

  crearPlan(): void {
    this.api.crearPlan(this.fPlan.getRawValue() as Partial<Plan>).subscribe(
      this.manejar((p: Plan) => {
        this.fPlan.reset({ anio: new Date().getFullYear() });
        this.nuevoPlan.set(false);
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
