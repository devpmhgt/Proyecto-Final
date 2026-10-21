import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { Avance, CursoAvance, EstadoAvance } from '../core/models';

const ETIQUETA: Record<EstadoAvance, string> = {
  aprobado: 'Aprobado',
  en_curso: 'En curso',
  disponible: 'Disponible',
  bloqueado: 'Bloqueado',
};

const ICONO: Record<EstadoAvance, string> = { aprobado: '✓', en_curso: '●', disponible: '○', bloqueado: '🔒' };

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

@Component({
  selector: 'app-avance',
  imports: [DecimalPipe, RouterLink],
  template: `
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @if (avance(); as a) {
      <div class="row" style="margin-bottom:.25rem">
        <h1 style="margin:0">{{ esPropio() ? 'Mi avance académico' : 'Avance de ' + a.estudiante.nombres + ' ' + a.estudiante.apellidos }}</h1>
        <span class="spacer"></span>
        @if (!esPropio()) { <a routerLink="/estudiantes">← Volver a estudiantes</a> }
      </div>
      <p class="muted" style="margin-top:.25rem">
        {{ a.carrera }} · {{ a.plan ? a.plan.nombre + ' (' + a.plan.codigo + ')' : 'sin plan de estudios asignado' }}
        · Carné {{ a.estudiante.carnet }}
      </p>

      @if (!a.plan) {
        <div class="card muted">No hay un plan de estudios para tu carrera todavía. Pide a la coordinación que lo cargue.</div>
      } @else {
        <div class="resumen card">
          <div class="anillo" [attr.aria-label]="a.porcentaje + '% completado'">
            <svg viewBox="0 0 120 120" width="132" height="132">
              <circle cx="60" cy="60" r="52" class="pista" />
              <circle cx="60" cy="60" r="52" class="progreso"
                [attr.stroke-dasharray]="circunferencia"
                [attr.stroke-dashoffset]="circunferencia * (1 - a.porcentaje / 100)" />
            </svg>
            <div class="centro"><strong>{{ a.porcentaje | number: '1.0-1' }}%</strong><span>completado</span></div>
          </div>
          <div class="kpis">
            <div><strong>{{ a.creditos_aprobados }}</strong><span>de {{ a.creditos_totales }} créditos</span></div>
            <div><strong>{{ a.cursos_aprobados }}</strong><span>de {{ a.cursos_totales }} cursos aprobados</span></div>
            <div><strong>{{ a.promedio ?? '—' }}</strong><span>promedio</span></div>
            <div><strong>{{ a.en_curso }}</strong><span>en curso</span></div>
            <div><strong>{{ a.disponibles }}</strong><span>disponibles para inscribir</span></div>
            <div><strong>{{ a.creditos_totales - a.creditos_aprobados }}</strong><span>créditos restantes</span></div>
          </div>
        </div>

        <div class="row filtros">
          <span class="muted">Mostrar:</span>
          <button class="chip" [class.on]="filtro() === null" (click)="filtro.set(null)">Todos</button>
          @for (e of estados; track e) {
            <button class="chip" [class]="'chip ' + e" [class.on]="filtro() === e" (click)="filtro.set(filtro() === e ? null : e)">
              {{ icono[e] }} {{ etiqueta[e] }} <span class="cnt">{{ conteo()[e] }}</span>
            </button>
          }
          <span class="spacer"></span>
          <span class="muted pista-txt">Toca un curso para ver sus requisitos y lo que desbloquea</span>
        </div>

        <div class="pensum" (keydown.escape)="seleccionado.set(null)">
          @for (c of a.ciclos; track c.semestre) {
            <section class="ciclo">
              <header>
                <span>Ciclo {{ romano(c.semestre) }}</span>
                <span class="muted">{{ creditosCiclo(c.cursos) }}</span>
              </header>
              <div class="mini"><span [style.width.%]="pctCiclo(c.cursos)"></span></div>
              @for (cu of c.cursos; track cu.id) {
                <button type="button" class="curso" [class]="'curso ' + cu.estado"
                  [class.atenuado]="atenuado(cu)" [class.sel]="seleccionado()?.id === cu.id"
                  [class.req]="esRequisito(cu)" [class.desb]="esDesbloqueado(cu)"
                  (click)="seleccionar(cu)" [attr.aria-pressed]="seleccionado()?.id === cu.id"
                  [attr.aria-label]="cu.nombre + ', ' + etiqueta[cu.estado]">
                  <span class="top"><code>{{ cu.codigo }}</code><span class="ico">{{ icono[cu.estado] }}</span></span>
                  <span class="nom">{{ cu.nombre }}</span>
                  <span class="pie">
                    <span>{{ cu.creditos }} cr</span>
                    @if (cu.nota) { <strong>{{ cu.nota | number: '1.0-0' }}</strong> }
                    @if (cu.intentos_reprobados) { <span class="rep" title="Intentos reprobados">✗{{ cu.intentos_reprobados }}</span> }
                  </span>
                </button>
              }
            </section>
          }
        </div>

        @if (seleccionado(); as s) {
          <div class="card detalle" [class]="'card detalle ' + s.estado">
            <div class="row">
              <h2 style="margin:0">{{ s.codigo }} · {{ s.nombre }}</h2>
              <span class="spacer"></span>
              <span class="estado-tag">{{ icono[s.estado] }} {{ etiqueta[s.estado] }}</span>
              <button class="link" (click)="seleccionado.set(null)" aria-label="Cerrar detalle">✕</button>
            </div>
            <p class="muted">Ciclo {{ romano(s.semestre) }} · {{ s.creditos }} créditos
              @if (s.nota) { · Nota final <strong>{{ s.nota }}</strong> }
              @if (s.intentos_reprobados) { · Reprobado {{ s.intentos_reprobados }} vez/veces }
            </p>
            <p class="mensaje">{{ mensaje(s) }}</p>

            <div class="grid grid-2">
              <div>
                <h3>Requisitos</h3>
                <ul class="lista">
                  @for (p of s.prerrequisitos; track p.id) {
                    <li [class.ok]="!s.faltantes.includes(p.codigo)">
                      {{ s.faltantes.includes(p.codigo) ? '✗' : '✓' }} <code>{{ p.codigo }}</code> {{ p.nombre }}
                    </li>
                  }
                  @if (s.creditos_requeridos) {
                    <li [class.ok]="!s.creditos_faltantes">
                      {{ s.creditos_faltantes ? '✗' : '✓' }} {{ s.creditos_requeridos }} créditos aprobados
                      <span class="muted">(llevas {{ a.creditos_aprobados_total }})</span>
                      <div class="mini"><span [style.width.%]="min100(a.creditos_aprobados_total / s.creditos_requeridos * 100)"></span></div>
                    </li>
                  }
                  @if (!s.prerrequisitos.length && !s.creditos_requeridos) { <li class="ok">Sin requisitos</li> }
                </ul>
              </div>
              <div>
                <h3>Desbloquea</h3>
                <ul class="lista">
                  @for (d of desbloqueados(); track d.id) {
                    <li><button class="link" (click)="seleccionar(d)"><code>{{ d.codigo }}</code> {{ d.nombre }}</button>
                      <span class="muted">· ciclo {{ romano(d.semestre) }}</span></li>
                  } @empty { <li class="muted">No es requisito de otros cursos del plan</li> }
                </ul>
              </div>
            </div>
            @if (s.estado === 'disponible' && esPropio()) {
              <a routerLink="/inscripciones">Ver secciones para inscribir →</a>
            }
          </div>
        }

        <div class="card">
          <h2>Puedes inscribir ahora</h2>
          <div class="row">
            @for (d of disponibles(); track d.id) {
              <button class="chip disponible" (click)="seleccionar(d)"><code>{{ d.codigo }}</code> {{ d.nombre }} · {{ d.creditos }} cr</button>
            } @empty { <span class="muted">No hay cursos disponibles en este momento.</span> }
          </div>
        </div>
      }
    } @else if (!error()) {
      <p class="muted">Cargando avance…</p>
    }
  `,
  styles: `
    .resumen { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap; }
    .anillo { position: relative; width: 132px; height: 132px; flex: none; }
    .anillo svg { transform: rotate(-90deg); }
    .pista { fill: none; stroke: var(--primary-soft); stroke-width: 12; }
    .progreso { fill: none; stroke: var(--ok); stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset .8s ease; }
    .centro { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
    .centro strong { font-size: 1.6rem; }
    .centro span, .kpis span { color: var(--muted); font-size: .8rem; }
    .kpis { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: .75rem; }
    .kpis div { display: flex; flex-direction: column; }
    .kpis strong { font-size: 1.35rem; }
    .filtros { margin: .25rem 0 .75rem; }
    .chip { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 999px; padding: .3rem .7rem; font-size: .85rem; }
    .chip.on { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
    .chip .cnt { color: var(--muted); margin-left: .2rem; }
    .pensum { display: flex; gap: .6rem; overflow-x: auto; padding-bottom: .75rem; margin-bottom: 1rem; }
    .ciclo { flex: 0 0 168px; display: flex; flex-direction: column; gap: .45rem; }
    .ciclo header { display: flex; justify-content: space-between; font-weight: 600; font-size: .85rem; }
    .mini { height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; }
    .mini span { display: block; height: 100%; background: var(--ok); }
    .curso { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: .25rem;
      min-height: 92px; padding: .5rem .55rem; border-radius: 8px; border: 1.5px solid var(--border);
      background: var(--surface); font-size: .8rem; transition: opacity .15s, transform .15s, box-shadow .15s; }
    .curso:hover { transform: translateY(-2px); box-shadow: 0 3px 10px rgba(20, 30, 60, .12); }
    .curso:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .curso .top, .curso .pie { display: flex; justify-content: space-between; gap: .3rem; }
    .curso .nom { font-weight: 600; line-height: 1.2; flex: 1; }
    .curso .pie { color: var(--muted); }
    .curso .rep { color: var(--danger); }
    .curso.aprobado { background: var(--ok-soft); border-color: var(--ok); }
    .curso.aprobado .ico, .curso.aprobado .pie strong { color: var(--ok); }
    .curso.en_curso { background: var(--primary-soft); border-color: var(--primary); }
    .curso.en_curso .ico { color: var(--primary); }
    .curso.disponible { border-style: dashed; border-color: var(--primary); }
    .curso.bloqueado { background: #f1f3f7; color: var(--muted); }
    .curso.atenuado { opacity: .25; }
    .curso.sel { box-shadow: 0 0 0 3px var(--text); opacity: 1; }
    .curso.req { box-shadow: 0 0 0 3px var(--warn); opacity: 1; }
    .curso.desb { box-shadow: 0 0 0 3px var(--primary); opacity: 1; }
    .detalle { border-left: 5px solid var(--border); }
    .detalle.aprobado { border-left-color: var(--ok); }
    .detalle.en_curso, .detalle.disponible { border-left-color: var(--primary); }
    .estado-tag { font-weight: 600; }
    .mensaje { font-weight: 500; }
    .lista { list-style: none; padding: 0; margin: 0; display: grid; gap: .35rem; }
    .lista li { color: var(--danger); }
    .lista li.ok { color: var(--ok); }
    .lista .muted, .lista button { color: var(--text); }
    .chip.disponible { border-style: dashed; border-color: var(--primary); }
    @media (max-width: 700px) { .pista-txt { display: none; } .ciclo { flex-basis: 150px; } }
  `,
})
export class AvancePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  /** Query param ?estudiante=ID (vista de administración). */
  readonly estudiante = input<string>();

  protected readonly etiqueta = ETIQUETA;
  protected readonly icono = ICONO;
  protected readonly estados: EstadoAvance[] = ['aprobado', 'en_curso', 'disponible', 'bloqueado'];
  protected readonly circunferencia = 2 * Math.PI * 52;

  protected readonly avance = signal<Avance | null>(null);
  protected readonly error = signal('');
  protected readonly filtro = signal<EstadoAvance | null>(null);
  protected readonly seleccionado = signal<CursoAvance | null>(null);

  protected readonly esPropio = computed(() => !this.estudiante() || this.auth.rol() === 'estudiante');
  private readonly cursos = computed(() => this.avance()?.ciclos.flatMap((c) => c.cursos) ?? []);
  protected readonly conteo = computed(() => {
    const r: Record<EstadoAvance, number> = { aprobado: 0, en_curso: 0, disponible: 0, bloqueado: 0 };
    for (const c of this.cursos()) r[c.estado]++;
    return r;
  });
  protected readonly disponibles = computed(() => this.cursos().filter((c) => c.estado === 'disponible'));
  protected readonly desbloqueados = computed(() => {
    const ids = new Set(this.seleccionado()?.desbloquea ?? []);
    return this.cursos().filter((c) => ids.has(c.id));
  });
  private readonly requisitosSel = computed(() => new Set(this.seleccionado()?.prerrequisitos.map((p) => p.id) ?? []));

  ngOnInit(): void {
    const id = Number(this.estudiante());
    const peticion = id && !this.esPropio() ? this.api.avanceEstudiante(id) : this.api.miAvance();
    peticion.subscribe({ next: (a) => this.avance.set(a), error: (e) => this.error.set(mensajeError(e)) });
  }

  seleccionar(c: CursoAvance): void {
    this.seleccionado.set(this.seleccionado()?.id === c.id ? null : c);
  }

  esRequisito(c: CursoAvance): boolean {
    return this.requisitosSel().has(c.id);
  }

  esDesbloqueado(c: CursoAvance): boolean {
    return this.seleccionado()?.desbloquea.includes(c.id) ?? false;
  }

  atenuado(c: CursoAvance): boolean {
    const sel = this.seleccionado();
    if (sel) return sel.id !== c.id && !this.esRequisito(c) && !this.esDesbloqueado(c);
    const f = this.filtro();
    return f !== null && c.estado !== f;
  }

  mensaje(c: CursoAvance): string {
    switch (c.estado) {
      case 'aprobado':
        return '¡Curso aprobado!';
      case 'en_curso':
        return 'Lo estás cursando este periodo.';
      case 'disponible':
        return 'Cumples todos los requisitos: puedes inscribirlo.';
      default: {
        const partes: string[] = [];
        if (c.faltantes.length) partes.push(`aprobar ${c.faltantes.join(', ')}`);
        if (c.creditos_faltantes) partes.push(`${c.creditos_faltantes} créditos más`);
        return `Para desbloquearlo te falta: ${partes.join(' y ')}.`;
      }
    }
  }

  creditosCiclo(cursos: CursoAvance[]): string {
    const total = cursos.reduce((s, c) => s + c.creditos, 0);
    const ok = cursos.filter((c) => c.estado === 'aprobado').reduce((s, c) => s + c.creditos, 0);
    return `${ok}/${total} cr`;
  }

  pctCiclo(cursos: CursoAvance[]): number {
    const total = cursos.reduce((s, c) => s + c.creditos, 0);
    const ok = cursos.filter((c) => c.estado === 'aprobado').reduce((s, c) => s + c.creditos, 0);
    return total ? (100 * ok) / total : 0;
  }

  romano(n: number): string {
    return ROMANOS[n] ?? String(n);
  }

  min100(v: number): number {
    return Math.min(100, v);
  }
}
