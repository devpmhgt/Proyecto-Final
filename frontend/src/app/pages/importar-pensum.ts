import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Carrera, FilaPensum, ImportacionPensum } from '../core/models';

@Component({
  selector: 'app-importar-pensum',
  imports: [ReactiveFormsModule],
  template: `
    <div class="card">
      <h2>Importar pensum desde CSV</h2>
      <p class="muted">
        Columnas: <code>Ciclo, Código, Nombre del Curso, Créditos, Pre-Requisitos</code>.
        Los prerrequisitos pueden ser códigos (<code>006</code>, <code>006;008</code>) o créditos (<code>70 Crs.</code>).
        Si un curso ya existe con el mismo código se actualiza.
      </p>
      @if (error()) { <div class="alert error">{{ error() }}</div> }
      @if (exito()) { <div class="alert ok">{{ exito() }}</div> }

      <form [formGroup]="form" (ngSubmit)="previsualizar()">
        <div class="form-grid">
          <label>Carrera
            <select formControlName="carrera_id">
              @for (c of carreras(); track c.id) { <option [ngValue]="c.id">{{ c.codigo }} · {{ c.nombre }}</option> }
            </select>
          </label>
          <label>Código del plan <input formControlName="plan_codigo" placeholder="ISC-2026" /></label>
          <label>Nombre del plan <input formControlName="plan_nombre" placeholder="Pensum Ingeniería en Sistemas 2026" /></label>
          <label>Año <input type="number" formControlName="anio" /></label>
          <label>Prefijo para códigos (opcional)
            <input formControlName="prefijo" placeholder="ej. ISC-" maxlength="10" />
          </label>
          <label>Archivo CSV
            <input type="file" accept=".csv,text/csv" (change)="elegirArchivo($event)" />
          </label>
        </div>
        <p class="muted" style="margin-top:-.25rem">
          Use un prefijo si otra carrera usa los mismos códigos (001, 002…), para que no se mezclen los cursos.
        </p>
        <div class="row">
          @if (preview() && !preview()!.guardado && !preview()!.errores.length) {
            <button type="button" [disabled]="cargando()" (click)="importar()">
              {{ cargando() ? 'Cargando…' : 'Cargar pensum (' + preview()!.cursos.length + ' cursos)' }}
            </button>
            <span class="muted">Revise la vista previa de abajo y confirme la carga.</span>
          } @else {
            <button type="submit" [disabled]="form.invalid || !archivo() || cargando()">
              {{ cargando() ? 'Revisando archivo…' : 'Revisar archivo' }}
            </button>
            @if (faltan().length && !cargando()) {
              <span class="muted">Falta: {{ faltan().join(', ') }}</span>
            }
          }
        </div>
      </form>
    </div>

    @if (preview(); as p) {
      <div class="card">
        <div class="row">
          <h2>{{ p.guardado ? 'Pensum importado' : 'Vista previa' }}</h2>
          <span class="spacer"></span>
          <span class="badge">{{ p.cursos.length }} cursos</span>
          <span class="badge">{{ p.ciclos }} ciclos</span>
          <span class="badge">{{ p.total_creditos }} créditos</span>
          <span class="badge ok">{{ nuevos() }} nuevos</span>
          <span class="badge warn">{{ p.cursos.length - nuevos() }} a actualizar</span>
        </div>

        @if (p.errores.length) {
          <div class="alert error">
            <strong>{{ p.errores.length }} error(es): corríjalos en el archivo y vuelva a cargarlo.</strong>
            <ul style="margin:.4rem 0 0">@for (e of p.errores; track $index) { <li>{{ e }}</li> }</ul>
          </div>
        }
        @if (p.advertencias.length) {
          <div class="alert" style="background:var(--warn-soft);color:var(--warn)">
            <strong>Advertencias</strong>
            <ul style="margin:.4rem 0 0">@for (a of p.advertencias; track $index) { <li>{{ a }}</li> }</ul>
          </div>
        }

        <div class="table-wrap">
          <table>
            <thead><tr><th>Ciclo</th><th>Código</th><th>Curso</th><th>Créditos</th><th>Prerrequisitos</th><th>Acción</th></tr></thead>
            <tbody>
              @for (f of p.cursos; track f.codigo) {
                <tr>
                  <td>{{ f.semestre }}</td>
                  <td><code>{{ f.codigo }}</code></td>
                  <td>{{ f.nombre }}</td>
                  <td>{{ f.creditos }}</td>
                  <td>{{ requisitos(f) }}</td>
                  <td><span class="badge" [class.ok]="f.accion === 'crear'" [class.warn]="f.accion === 'actualizar'">{{ f.accion }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class ImportarPensum {
  private readonly api = inject(ApiService);
  readonly carreras = input.required<Carrera[]>();
  /** Se emite al guardar, para que el catálogo recargue cursos y planes. */
  readonly importado = output<number>();

  protected readonly archivo = signal<File | null>(null);
  protected readonly preview = signal<ImportacionPensum | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly exito = signal('');
  protected readonly nuevos = computed(() => this.preview()?.cursos.filter((c) => c.accion === 'crear').length ?? 0);

  protected readonly form = inject(FormBuilder).group({
    carrera_id: [null as number | null, Validators.required],
    plan_codigo: ['', Validators.required],
    plan_nombre: ['', Validators.required],
    anio: [new Date().getFullYear(), Validators.required],
    prefijo: [''],
  });

  protected readonly faltan = computed(() => {
    this.valores();
    const f: string[] = [];
    if (!this.archivo()) f.push('elegir el archivo CSV');
    if (!this.form.value.carrera_id) f.push('carrera');
    if (!this.form.value.plan_codigo) f.push('código del plan');
    if (!this.form.value.plan_nombre) f.push('nombre del plan');
    return f;
  });
  private readonly valores = signal(0);

  constructor() {
    // Cualquier cambio en el formulario invalida la vista previa anterior
    this.form.valueChanges.subscribe(() => {
      this.preview.set(null);
      this.valores.update((v) => v + 1);
    });
    // Al elegir la carrera, propone código y nombre del plan si están vacíos
    this.form.controls.carrera_id.valueChanges.subscribe((id) => this.proponerPlan(id));
    // Si hay una sola carrera (o ninguna elegida), selecciona la primera
    effect(() => {
      const lista = this.carreras();
      if (lista.length && !this.form.value.carrera_id) this.form.controls.carrera_id.setValue(lista[0].id);
    });
  }

  private proponerPlan(id: number | null): void {
    const c = this.carreras().find((x) => x.id === id);
    if (!c) return;
    const anio = this.form.value.anio ?? new Date().getFullYear();
    if (!this.form.value.plan_codigo) this.form.controls.plan_codigo.setValue(`${c.codigo}-${anio}`);
    if (!this.form.value.plan_nombre) this.form.controls.plan_nombre.setValue(`Pensum ${c.nombre} ${anio}`);
  }

  elegirArchivo(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.archivo.set(f);
    this.preview.set(null);
    this.exito.set('');
    // Revisión automática al elegir el archivo
    if (f && this.form.valid) this.previsualizar();
  }

  requisitos(f: FilaPensum): string {
    const partes = [...f.prerrequisitos];
    if (f.creditos_requeridos) partes.push(`${f.creditos_requeridos} créditos`);
    return partes.join(', ') || '—';
  }

  private enviar(confirmar: boolean): void {
    const datos = new FormData();
    for (const [k, v] of Object.entries(this.form.getRawValue())) datos.append(k, String(v ?? ''));
    datos.append('confirmar', String(confirmar));
    datos.append('archivo', this.archivo()!);
    this.cargando.set(true);
    this.error.set('');
    this.exito.set('');
    this.api.importarPensum(datos).subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.preview.set(r);
        if (r.guardado && r.plan_id) {
          this.exito.set(`Pensum "${this.form.value.plan_nombre}" importado: ${r.cursos.length} cursos en ${r.ciclos} ciclos.`);
          this.importado.emit(r.plan_id);
        }
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }

  previsualizar(): void {
    this.enviar(false);
  }

  importar(): void {
    if (!confirm('¿Importar el pensum? Se crearán/actualizarán los cursos y el plan de estudios.')) return;
    this.enviar(true);
  }
}
