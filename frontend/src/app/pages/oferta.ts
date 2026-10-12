import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Aula, Curso, DIAS, Docente, EstadoPeriodo, Periodo, Seccion } from '../core/models';

type Pestana = 'secciones' | 'periodos' | 'aulas';

@Component({
  selector: 'app-oferta',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <h1>Oferta y planificación</h1>
    <div class="tabs">
      <button [class.active]="tab() === 'secciones'" (click)="tab.set('secciones')">Secciones y horarios</button>
      <button [class.active]="tab() === 'periodos'" (click)="tab.set('periodos')">Periodos</button>
      <button [class.active]="tab() === 'aulas'" (click)="tab.set('aulas')">Aulas</button>
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @switch (tab()) {
      @case ('periodos') {
        <form class="card" [formGroup]="fPeriodo" (ngSubmit)="guardarPeriodo()">
          <h2>{{ periodoEdit() ? 'Editar periodo' : 'Nuevo periodo' }}</h2>
          <div class="form-grid">
            <label>Código <input formControlName="codigo" placeholder="2027-1" /></label>
            <label>Nombre <input formControlName="nombre" /></label>
            <label>Inicio <input type="date" formControlName="fecha_inicio" /></label>
            <label>Fin <input type="date" formControlName="fecha_fin" /></label>
            <label>Límite de retiro <input type="date" formControlName="fecha_limite_retiro" /></label>
            <label>Estado
              <select formControlName="estado">
                @for (e of estadosPeriodo; track e) { <option [value]="e">{{ e }}</option> }
              </select>
            </label>
          </div>
          <div class="row">
            <button type="submit" [disabled]="fPeriodo.invalid">Guardar</button>
            @if (periodoEdit()) { <button type="button" class="secondary" (click)="limpiarPeriodo()">Cancelar</button> }
          </div>
        </form>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Nombre</th><th>Fechas</th><th>Límite retiro</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (p of periodos(); track p.id) {
                <tr>
                  <td>{{ p.codigo }}</td><td>{{ p.nombre }}</td><td>{{ p.fecha_inicio }} → {{ p.fecha_fin }}</td>
                  <td>{{ p.fecha_limite_retiro ?? '—' }}</td>
                  <td><span class="badge" [class]="p.estado">{{ p.estado }}</span></td>
                  <td class="right"><button class="link" (click)="editarPeriodo(p)">Editar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @case ('aulas') {
        <form class="card" [formGroup]="fAula" (ngSubmit)="guardarAula()">
          <h2>{{ aulaEdit() ? 'Editar aula' : 'Nueva aula' }}</h2>
          <div class="form-grid">
            <label>Código <input formControlName="codigo" /></label>
            <label>Edificio <input formControlName="edificio" /></label>
            <label>Capacidad <input type="number" formControlName="capacidad" /></label>
            <label>Tipo
              <select formControlName="tipo"><option value="teorica">teórica</option><option value="laboratorio">laboratorio</option><option value="auditorio">auditorio</option></select>
            </label>
            <label class="check"><input type="checkbox" formControlName="activa" /> Activa</label>
          </div>
          <div class="row">
            <button type="submit" [disabled]="fAula.invalid">Guardar</button>
            @if (aulaEdit()) { <button type="button" class="secondary" (click)="limpiarAula()">Cancelar</button> }
          </div>
        </form>
        <div class="card table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Edificio</th><th>Capacidad</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (a of aulas(); track a.id) {
                <tr>
                  <td>{{ a.codigo }}</td><td>{{ a.edificio }}</td><td>{{ a.capacidad }}</td><td>{{ a.tipo }}</td>
                  <td><span class="badge" [class]="a.activa ? 'activo' : 'inactivo'">{{ a.activa ? 'activa' : 'inactiva' }}</span></td>
                  <td class="right"><button class="link" (click)="editarAula(a)">Editar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @case ('secciones') {
        <div class="card row">
          <label>Periodo
            <select [(ngModel)]="periodoId" (change)="cargarSecciones()">
              @for (p of periodos(); track p.id) { <option [ngValue]="p.id">{{ p.codigo }} · {{ p.estado }}</option> }
            </select>
          </label>
        </div>
        <form class="card" [formGroup]="fSeccion" (ngSubmit)="crearSeccion()">
          <h2>Nueva sección</h2>
          <div class="form-grid">
            <label>Curso
              <select formControlName="curso_id">
                @for (c of cursos(); track c.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
              </select>
            </label>
            <label>Sección <input formControlName="codigo" placeholder="A" /></label>
            <label>Cupo <input type="number" formControlName="cupo" /></label>
            <label>Docente
              <select formControlName="docente_id">
                <option [ngValue]="null">Sin asignar</option>
                @for (d of docentes(); track d.id) { <option [ngValue]="d.id">{{ d.apellidos }}, {{ d.nombres }}</option> }
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="fSeccion.invalid || !periodoId">Crear sección</button>
        </form>

        <div class="card table-wrap">
          <table>
            <thead><tr><th>Curso</th><th>Sección</th><th>Docente</th><th>Cupo</th><th>Horario</th><th></th></tr></thead>
            <tbody>
              @for (s of secciones(); track s.id) {
                <tr [class.selected]="sel()?.id === s.id">
                  <td>{{ s.curso.codigo }} · {{ s.curso.nombre }}</td>
                  <td>{{ s.codigo }}</td>
                  <td>{{ s.docente ? s.docente.nombres + ' ' + s.docente.apellidos : '—' }}</td>
                  <td>{{ s.inscritos }} / {{ s.cupo }}</td>
                  <td>
                    @for (h of s.horarios; track h.id) {
                      <div>{{ dias[h.dia] }} {{ h.hora_inicio.slice(0, 5) }}-{{ h.hora_fin.slice(0, 5) }} · {{ h.aula.codigo }}</div>
                    } @empty { <span class="muted">Sin horario</span> }
                  </td>
                  <td class="right"><button class="link" (click)="seleccionar(s)">Gestionar</button></td>
                </tr>
              } @empty { <tr><td colspan="6" class="muted">No hay secciones en este periodo.</td></tr> }
            </tbody>
          </table>
        </div>

        @if (sel(); as s) {
          <div class="card">
            <h2>{{ s.curso.codigo }} · Sección {{ s.codigo }}</h2>
            <div class="row" style="margin-bottom:1rem">
              <label>Docente
                <select [(ngModel)]="docenteSel">
                  <option [ngValue]="null">Sin asignar</option>
                  @for (d of docentes(); track d.id) { <option [ngValue]="d.id">{{ d.apellidos }}, {{ d.nombres }}</option> }
                </select>
              </label>
              <label>Cupo <input type="number" [(ngModel)]="cupoSel" style="width:6rem" /></label>
              <button class="secondary" (click)="actualizarSeccion(s)">Actualizar</button>
            </div>
            <h3>Horarios</h3>
            <table>
              @for (h of s.horarios; track h.id) {
                <tr>
                  <td>{{ dias[h.dia] }}</td><td>{{ h.hora_inicio.slice(0, 5) }} - {{ h.hora_fin.slice(0, 5) }}</td><td>{{ h.aula.codigo }}</td>
                  <td class="right"><button class="link" (click)="eliminarHorario(s, h.id)">Quitar</button></td>
                </tr>
              }
            </table>
            <div class="row" style="margin-top:.75rem">
              <select [(ngModel)]="nuevoHorario.dia">
                @for (n of [1, 2, 3, 4, 5, 6, 7]; track n) { <option [ngValue]="n">{{ dias[n] }}</option> }
              </select>
              <input type="time" [(ngModel)]="nuevoHorario.hora_inicio" />
              <input type="time" [(ngModel)]="nuevoHorario.hora_fin" />
              <select [(ngModel)]="nuevoHorario.aula_id">
                <option [ngValue]="null">Aula…</option>
                @for (a of aulas(); track a.id) { <option [ngValue]="a.id">{{ a.codigo }} ({{ a.capacidad }})</option> }
              </select>
              <button [disabled]="!nuevoHorario.aula_id" (click)="agregarHorario(s)">Agregar horario</button>
            </div>
            <p class="muted">El sistema valida choques de aula y docente, la capacidad del aula y la disponibilidad del docente.</p>
          </div>
        }
      }
    }
  `,
})
export class OfertaPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  protected readonly dias = DIAS;
  protected readonly estadosPeriodo: EstadoPeriodo[] = ['planificacion', 'inscripcion', 'en_curso', 'cerrado'];

  protected readonly tab = signal<Pestana>('secciones');
  protected readonly error = signal('');
  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly aulas = signal<Aula[]>([]);
  protected readonly cursos = signal<Curso[]>([]);
  protected readonly docentes = signal<Docente[]>([]);
  protected readonly secciones = signal<Seccion[]>([]);
  protected readonly periodoEdit = signal<Periodo | null>(null);
  protected readonly aulaEdit = signal<Aula | null>(null);
  protected readonly sel = signal<Seccion | null>(null);

  protected periodoId: number | null = null;
  protected docenteSel: number | null = null;
  protected cupoSel = 0;
  protected nuevoHorario: { dia: number; hora_inicio: string; hora_fin: string; aula_id: number | null } = {
    dia: 1, hora_inicio: '07:00', hora_fin: '09:00', aula_id: null,
  };

  protected readonly fPeriodo = this.fb.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    fecha_inicio: ['', Validators.required],
    fecha_fin: ['', Validators.required],
    fecha_limite_retiro: [null as string | null],
    estado: ['planificacion' as EstadoPeriodo],
  });
  protected readonly fAula = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    edificio: [''],
    capacidad: [30, [Validators.required, Validators.min(1)]],
    tipo: ['teorica'],
    activa: [true],
  });
  protected readonly fSeccion = this.fb.group({
    curso_id: [null as number | null, Validators.required],
    codigo: ['A', Validators.required],
    cupo: [30, [Validators.required, Validators.min(1)]],
    docente_id: [null as number | null],
  });

  ngOnInit(): void {
    this.api.periodos().subscribe((p) => {
      this.periodos.set(p);
      if (!this.periodoId && p.length) {
        this.periodoId = p[0].id;
        this.cargarSecciones();
      }
    });
    this.api.aulas().subscribe((a) => this.aulas.set(a));
    this.api.cursos().subscribe((c) => this.cursos.set(c));
    this.api.docentes().subscribe((d) => this.docentes.set(d));
  }

  private manejar = <T>(ok: (v: T) => void) => ({
    next: (v: T) => {
      this.error.set('');
      ok(v);
    },
    error: (e: unknown) => this.error.set(mensajeError(e)),
  });

  cargarSecciones(): void {
    if (!this.periodoId) return;
    this.api.secciones({ periodo_id: this.periodoId }).subscribe((s) => {
      this.secciones.set(s);
      const actual = this.sel();
      this.sel.set(actual ? (s.find((x) => x.id === actual.id) ?? null) : null);
    });
  }

  // Periodos
  editarPeriodo(p: Periodo): void {
    this.periodoEdit.set(p);
    this.fPeriodo.reset(p);
  }
  limpiarPeriodo(): void {
    this.periodoEdit.set(null);
    this.fPeriodo.reset({ estado: 'planificacion' });
  }
  guardarPeriodo(): void {
    const datos = this.fPeriodo.getRawValue() as Partial<Periodo>;
    const actual = this.periodoEdit();
    (actual ? this.api.actualizarPeriodo(actual.id, datos) : this.api.crearPeriodo(datos)).subscribe(
      this.manejar(() => {
        this.limpiarPeriodo();
        this.api.periodos().subscribe((p) => this.periodos.set(p));
      }),
    );
  }

  // Aulas
  editarAula(a: Aula): void {
    this.aulaEdit.set(a);
    this.fAula.reset({ ...a, edificio: a.edificio ?? '' });
  }
  limpiarAula(): void {
    this.aulaEdit.set(null);
    this.fAula.reset();
  }
  guardarAula(): void {
    const datos = this.fAula.getRawValue();
    const actual = this.aulaEdit();
    (actual ? this.api.actualizarAula(actual.id, datos) : this.api.crearAula(datos)).subscribe(
      this.manejar(() => {
        this.limpiarAula();
        this.api.aulas().subscribe((a) => this.aulas.set(a));
      }),
    );
  }

  // Secciones
  crearSeccion(): void {
    this.api.crearSeccion({ ...this.fSeccion.getRawValue(), periodo_id: this.periodoId }).subscribe(
      this.manejar((s: Seccion) => {
        this.fSeccion.reset({ codigo: 'A', cupo: 30 });
        this.cargarSecciones();
        this.seleccionar(s);
      }),
    );
  }

  seleccionar(s: Seccion): void {
    this.sel.set(s);
    this.docenteSel = s.docente?.id ?? null;
    this.cupoSel = s.cupo;
  }

  actualizarSeccion(s: Seccion): void {
    this.api.actualizarSeccion(s.id, { docente_id: this.docenteSel, cupo: this.cupoSel }).subscribe(
      this.manejar(() => this.cargarSecciones()),
    );
  }

  agregarHorario(s: Seccion): void {
    this.api.agregarHorario(s.id, this.nuevoHorario).subscribe(this.manejar(() => this.cargarSecciones()));
  }

  eliminarHorario(s: Seccion, horarioId: number): void {
    this.api.eliminarHorario(s.id, horarioId).subscribe(this.manejar(() => this.cargarSecciones()));
  }
}
