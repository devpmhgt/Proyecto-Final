import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { Acta, Periodo, Seccion } from '../core/models';

@Component({
  selector: 'app-notas',
  imports: [FormsModule],
  template: `
    <h1>Registro de notas y cierre de actas</h1>
    @if (msg()) { <div class="alert" [class.error]="esError()" [class.ok]="!esError()">{{ msg() }}</div> }

    <div class="card row">
      <label>Periodo
        <select [(ngModel)]="periodoId" (change)="cargarSecciones()">
          @for (p of periodos(); track p.id) { <option [ngValue]="p.id">{{ p.codigo }}</option> }
        </select>
      </label>
      <label>Sección
        <select [(ngModel)]="seccionId" (change)="cargarActa()">
          <option [ngValue]="null">Seleccione…</option>
          @for (s of secciones(); track s.id) {
            <option [ngValue]="s.id">{{ s.curso.codigo }} · {{ s.curso.nombre }} ({{ s.codigo }})</option>
          }
        </select>
      </label>
    </div>

    @if (acta(); as a) {
      <div class="card">
        <div class="row">
          <h2>Ponderaciones</h2>
          <span class="spacer"></span>
          <span class="badge" [class.ok]="totalPond() === 100" [class.warn]="totalPond() !== 100">Total: {{ totalPond() }}%</span>
        </div>
        <table>
          @for (e of a.evaluaciones; track e.id) {
            <tr>
              <td>{{ e.nombre }}</td><td>{{ e.ponderacion }}%</td>
              <td class="right">
                @if (!a.acta_cerrada) { <button class="link" (click)="eliminarEvaluacion(e.id)">Eliminar</button> }
              </td>
            </tr>
          } @empty { <tr><td class="muted">Defina las evaluaciones de la sección.</td></tr> }
        </table>
        @if (!a.acta_cerrada) {
          <div class="row" style="margin-top:.75rem">
            <input placeholder="Nombre (ej. Parcial 1)" [(ngModel)]="nuevaEval.nombre" />
            <input type="number" placeholder="%" [(ngModel)]="nuevaEval.ponderacion" style="width:6rem" />
            <button class="secondary" [disabled]="!nuevaEval.nombre || !nuevaEval.ponderacion" (click)="crearEvaluacion()">Agregar</button>
          </div>
        }
      </div>

      <div class="card">
        <div class="row">
          <h2>Acta de calificaciones</h2>
          <span class="spacer"></span>
          @if (a.acta_cerrada) {
            <span class="badge cerrado">Acta cerrada</span>
            @if (esGestor) { <button class="secondary small" (click)="reabrir()">Reabrir acta</button> }
          } @else {
            <button class="secondary" (click)="guardarNotas()">Guardar notas</button>
            <button class="danger" [disabled]="totalPond() !== 100" (click)="cerrar()">Cerrar acta</button>
          }
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Carnet</th><th>Estudiante</th>
                @for (e of a.evaluaciones; track e.id) { <th>{{ e.nombre }}<br /><span class="muted">{{ e.ponderacion }}%</span></th> }
                <th>Acumulado</th><th>Final</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (f of a.filas; track f.inscripcion_id) {
                <tr>
                  <td>{{ f.estudiante.carnet }}</td>
                  <td>{{ f.estudiante.apellidos }}, {{ f.estudiante.nombres }}</td>
                  @for (e of a.evaluaciones; track e.id) {
                    <td>
                      @if (a.acta_cerrada) { {{ f.notas[e.id] ?? '—' }} }
                      @else {
                        <input type="number" min="0" max="100" step="0.01"
                          [ngModel]="valor(f.inscripcion_id, e.id, f.notas[e.id])"
                          (ngModelChange)="editar(f.inscripcion_id, e.id, $event)" />
                      }
                    </td>
                  }
                  <td>{{ f.nota_acumulada }}</td>
                  <td><strong>{{ f.nota_final ?? '—' }}</strong></td>
                  <td><span class="badge" [class]="f.estado">{{ f.estado }}</span></td>
                </tr>
              } @empty { <tr><td [attr.colspan]="a.evaluaciones.length + 5" class="muted">No hay estudiantes inscritos.</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="muted">Al cerrar el acta se calcula la nota final ponderada, se asigna aprobado/reprobado según la nota mínima
          institucional y se notifica a cada estudiante. Un acta cerrada ya no admite cambios.</p>
      </div>
    }
  `,
})
export class NotasPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  protected readonly esGestor = this.auth.tieneRol('admin', 'coordinador');

  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly secciones = signal<Seccion[]>([]);
  protected readonly acta = signal<Acta | null>(null);
  protected readonly msg = signal('');
  protected readonly esError = signal(false);
  protected readonly totalPond = computed(() =>
    (this.acta()?.evaluaciones ?? []).reduce((s, e) => s + Number(e.ponderacion), 0),
  );

  protected periodoId: number | null = null;
  protected seccionId: number | null = null;
  protected nuevaEval = { nombre: '', ponderacion: null as number | null };
  private docenteId: number | null = null;
  /** Notas modificadas y aún no guardadas: clave "inscripcion:evaluacion" */
  private cambios = new Map<string, number>();

  ngOnInit(): void {
    const iniciar = () =>
      this.api.periodos().subscribe((p) => {
        this.periodos.set(p);
        this.periodoId = p[0]?.id ?? null;
        this.cargarSecciones();
      });
    if (this.auth.rol() === 'docente') {
      this.api.miPerfilDocente().subscribe((d) => {
        this.docenteId = d.id;
        iniciar();
      });
    } else {
      iniciar();
    }
  }

  private aviso(texto: string, error = false): void {
    this.msg.set(texto);
    this.esError.set(error);
  }

  private manejar = (ok: string) => ({
    next: (a: Acta | void) => {
      if (a) this.acta.set(a);
      else this.cargarActa();
      this.cambios.clear();
      this.aviso(ok);
    },
    error: (e: unknown) => this.aviso(mensajeError(e), true),
  });

  cargarSecciones(): void {
    this.acta.set(null);
    this.seccionId = null;
    if (!this.periodoId) return;
    this.api
      .secciones({ periodo_id: this.periodoId, docente_id: this.docenteId })
      .subscribe((s) => this.secciones.set(s));
  }

  cargarActa(): void {
    this.cambios.clear();
    if (!this.seccionId) {
      this.acta.set(null);
      return;
    }
    this.api.acta(this.seccionId).subscribe({ next: (a) => this.acta.set(a), error: (e) => this.aviso(mensajeError(e), true) });
  }

  valor(insc: number, ev: number, original?: string): number | null {
    const k = `${insc}:${ev}`;
    if (this.cambios.has(k)) return this.cambios.get(k)!;
    return original !== undefined ? Number(original) : null;
  }

  editar(insc: number, ev: number, v: number | null): void {
    if (v === null || Number.isNaN(v)) this.cambios.delete(`${insc}:${ev}`);
    else this.cambios.set(`${insc}:${ev}`, v);
  }

  guardarNotas(): void {
    const notas = [...this.cambios].map(([k, nota]) => {
      const [inscripcion_id, evaluacion_id] = k.split(':').map(Number);
      return { inscripcion_id, evaluacion_id, nota };
    });
    if (!notas.length) return this.aviso('No hay cambios por guardar.');
    this.api.registrarNotas(this.seccionId!, notas).subscribe(this.manejar(`${notas.length} nota(s) guardada(s).`));
  }

  crearEvaluacion(): void {
    const { nombre, ponderacion } = this.nuevaEval;
    this.api.crearEvaluacion(this.seccionId!, nombre, Number(ponderacion)).subscribe({
      next: () => {
        this.nuevaEval = { nombre: '', ponderacion: null };
        this.cargarActa();
      },
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }

  eliminarEvaluacion(id: number): void {
    if (!confirm('¿Eliminar la evaluación y sus notas registradas?')) return;
    this.api.eliminarEvaluacion(id).subscribe(this.manejar('Evaluación eliminada.'));
  }

  cerrar(): void {
    if (this.cambios.size && !confirm('Hay notas sin guardar que se perderán. ¿Continuar?')) return;
    if (!confirm('¿Cerrar el acta? Esta acción calcula las notas finales y bloquea cambios.')) return;
    this.api.cerrarActa(this.seccionId!).subscribe(this.manejar('Acta cerrada y notas finales publicadas.'));
  }

  reabrir(): void {
    if (!confirm('¿Reabrir el acta? Se anularán las notas finales.')) return;
    this.api.reabrirActa(this.seccionId!).subscribe(this.manejar('Acta reabierta.'));
  }
}
