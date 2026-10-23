import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/auth.interceptor';
import { DIAS, Disponibilidad, Docente, Periodo, Seccion, Usuario } from '../core/models';

/** Eje del horario semanal: 06:00 a 22:00. */
const DESDE = 6 * 60;
const HASTA = 22 * 60;

@Component({
  selector: 'app-docentes',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="row"><h1>Docentes</h1><span class="spacer"></span>
      <button (click)="nuevo()">+ Nuevo docente</button>
    </div>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    @if (editando() !== undefined) {
      <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
        <h2>{{ editando() ? 'Editar docente' : 'Nuevo docente' }}</h2>
        <div class="form-grid">
          <label>Código <input formControlName="codigo" [readonly]="!!editando()" /></label>
          <label>Nombres <input formControlName="nombres" /></label>
          <label>Apellidos <input formControlName="apellidos" /></label>
          <label>Correo <input type="email" formControlName="email" /></label>
          <label>Teléfono <input formControlName="telefono" /></label>
          <label>Especialidad <input formControlName="especialidad" /></label>
          <label>Máx. horas semanales <input type="number" formControlName="max_horas_semana" /></label>
          <label>Estado
            <select formControlName="estado">
              <option value="activo">activo</option><option value="inactivo">inactivo</option><option value="licencia">licencia</option>
            </select>
          </label>
          <label>{{ !editando() ? 'Contraseña de acceso (opcional)' : editando()!.usuario_id ? 'Nueva contraseña (opcional)' : 'Crear acceso: contraseña (opcional)' }}
            <input type="password" formControlName="password" autocomplete="new-password" placeholder="mínimo 8 caracteres" />
          </label>
        </div>

        @if (editando(); as ed) {
          <div class="acceso">
            <h3>Cuenta de acceso</h3>
            @if (ed.usuario_id) {
              <p>Vinculada: inicia sesión con <strong>{{ ed.email }}</strong>.</p>
              <div class="row">
                <button type="button" class="secondary small" (click)="desvincular(ed)">Desvincular cuenta</button>
                <span class="muted">La cuenta no se borra; solo deja de estar asociada a este expediente.</span>
              </div>
            } @else {
              <p class="muted">Sin cuenta. Escribe una contraseña arriba para crear una nueva, o vincula una cuenta que ya exista:</p>
              <div class="row">
                <select [(ngModel)]="cuentaSel" [ngModelOptions]="{ standalone: true }" aria-label="Cuenta existente">
                  <option [ngValue]="null">{{ cuentasLibres().length ? 'Elige una cuenta…' : 'No hay cuentas de docente sin vincular' }}</option>
                  @for (u of cuentasLibres(); track u.id) { <option [ngValue]="u.id">{{ u.nombre }} · {{ u.email }}</option> }
                </select>
                <button type="button" class="secondary" [disabled]="!cuentaSel" (click)="vincular(ed)">Vincular cuenta</button>
              </div>
            }
          </div>
        }
        <div class="row">
          <button type="submit" [disabled]="form.invalid">Guardar</button>
          <button type="button" class="secondary" (click)="editando.set(undefined)">Cancelar</button>
        </div>
      </form>
    }

    <div class="card">
      <div class="row" style="margin-bottom:.75rem">
        <input placeholder="Buscar por código o nombre" [(ngModel)]="q" (keyup.enter)="cargar()" />
        <button class="secondary" (click)="cargar()">Buscar</button>
      </div>
      <div class="table-wrap">
        <table>
          <caption class="muted" style="caption-side:bottom;text-align:left;padding-top:.5rem">Toca un docente para ver su ficha: secciones, horario y disponibilidad.</caption>
          <thead><tr><th>Código</th><th>Nombre</th><th>Especialidad</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (d of docentes(); track d.id) {
              <tr class="clicable" [class.selected]="seleccionado()?.id === d.id" (click)="abrirFicha(d)">
                <td>{{ d.codigo }}</td>
                <td>{{ d.apellidos }}, {{ d.nombres }}</td>
                <td>{{ d.especialidad }}</td>
                <td>{{ d.email }}</td>
                <td><span class="badge" [class]="d.estado">{{ d.estado }}</span></td>
                <td class="right">
                  <button class="link" (click)="abrirFicha(d); $event.stopPropagation()">Ver ficha</button>
                  <button class="link" (click)="editar(d); $event.stopPropagation()">Editar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (seleccionado(); as d) {
      <div class="card ficha">
        <div class="row">
          <div style="min-width:0">
            <h2 style="margin:0">{{ d.nombres }} {{ d.apellidos }}</h2>
            <p class="muted" style="margin:.2rem 0 0">
              Código {{ d.codigo }} · {{ d.especialidad || 'Sin especialidad' }} · {{ d.email }} · Cuenta de acceso: {{ d.usuario_id ? 'sí' : 'no' }}
            </p>
          </div>
          <span class="spacer"></span>
          <span class="badge" [class]="d.estado">{{ d.estado }}</span>
          <button class="link" (click)="seleccionado.set(null)" aria-label="Cerrar ficha">✕</button>
        </div>

        <div class="grid grid-kpi resumen">
          <div class="kpi"><div class="valor">{{ seccionesDoc().length }}</div><div class="etq">secciones asignadas</div></div>
          <div class="kpi">
            <div class="valor" [class.excede]="horas() > d.max_horas_semana">{{ horas() }} / {{ d.max_horas_semana }} h</div>
            <div class="etq">carga semanal en periodos abiertos</div>
            <div class="bar"><span [style.width.%]="min100((100 * horas()) / d.max_horas_semana)"></span></div>
          </div>
          <div class="kpi"><div class="valor">{{ estudiantes() }}</div><div class="etq">estudiantes inscritos</div></div>
          <div class="kpi"><div class="valor">{{ actasCerradas() }}</div><div class="etq">actas cerradas</div></div>
        </div>

        <h3>Horario semanal</h3>
        <div class="semana" role="img" [attr.aria-label]="'Horario semanal de ' + d.nombres">
          <div class="eje">
            <span></span>
            <div class="horas">@for (h of marcas; track h) { <span [style.left.%]="pos(h * 60)">{{ h }}:00</span> }</div>
          </div>
          @for (n of [1, 2, 3, 4, 5, 6, 7]; track n) {
            <div class="dia">
              <span>{{ dias[n].slice(0, 3) }}</span>
              <div class="pista">
                @for (f of franjasDia(n); track $index) {
                  <span class="disp" [style.left.%]="pos(min(f.hora_inicio))" [style.width.%]="ancho(f.hora_inicio, f.hora_fin)"></span>
                }
                @for (b of clasesDia(n); track $index) {
                  <span class="clase" [class.choque]="b.fuera" [style.left.%]="pos(min(b.ini))" [style.width.%]="ancho(b.ini, b.fin)"
                    [title]="b.texto">{{ b.etiqueta }}</span>
                }
              </div>
            </div>
          }
          <div class="leyenda">
            <span><i class="disp"></i> Disponible</span>
            <span><i class="clase"></i> Clase asignada</span>
            <span><i class="clase choque"></i> Fuera de su disponibilidad</span>
            @if (!franjas().length) { <span class="muted">Sin franjas registradas: se considera disponible a cualquier hora.</span> }
          </div>
        </div>

        <h3>Secciones asignadas</h3>
        @if (error()) { <div class="alert error" style="margin:0">{{ error() }}</div> }
        @if (!seccionesDoc().length) {
          <p class="muted">No tiene secciones asignadas.</p>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Periodo</th><th>Curso</th><th>Sección</th><th>Horario</th><th>Inscritos</th><th>Acta</th><th>Reasignar a</th></tr></thead>
              <tbody>
                @for (s of seccionesDoc(); track s.id) {
                  <tr>
                    <td>{{ periodo(s.periodo_id)?.codigo }} <span class="badge" [class]="periodo(s.periodo_id)?.estado ?? ''">{{ periodo(s.periodo_id)?.estado }}</span></td>
                    <td>{{ s.curso.codigo }} · {{ s.curso.nombre }}</td>
                    <td>{{ s.codigo }}</td>
                    <td>{{ horario(s) }}</td>
                    <td>{{ s.inscritos }} / {{ s.cupo }}</td>
                    <td><span class="badge" [class.cerrado]="s.acta_cerrada">{{ s.acta_cerrada ? 'cerrada' : 'abierta' }}</span></td>
                    <td>
                      <div class="row" style="flex-wrap:nowrap">
                        <select [(ngModel)]="destino[s.id]" [attr.aria-label]="'Nuevo docente para ' + s.curso.codigo + ' ' + s.codigo">
                          <option [ngValue]="undefined" disabled>Elegir…</option>
                          <option [ngValue]="null">Sin asignar</option>
                          @for (o of otrosDocentes(); track o.id) { <option [ngValue]="o.id">{{ o.apellidos }}, {{ o.nombres }}</option> }
                        </select>
                        <button class="small secondary" [disabled]="destino[s.id] === undefined" (click)="reasignar(s)">Reasignar</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <div class="row acciones">
          <button class="secondary" (click)="editar(d)">Editar datos</button>
          @if (d.estado !== 'inactivo') { <button class="secondary" (click)="marcarInactivo(d)">Marcar inactivo</button> }
          @if (esAdmin) {
            <button class="danger" [disabled]="seccionesDoc().length > 0" (click)="eliminar(d)">Eliminar docente</button>
            @if (seccionesDoc().length) { <span class="muted">Para eliminarlo, primero reasigna sus {{ seccionesDoc().length }} sección(es).</span> }
          }
        </div>

        <h3>Disponibilidad</h3>
        <table>
          <thead><tr><th>Día</th><th>Desde</th><th>Hasta</th><th></th></tr></thead>
          <tbody>
            @for (f of franjas(); track $index) {
              <tr>
                <td>{{ dias[f.dia] }}</td><td>{{ f.hora_inicio.slice(0, 5) }}</td><td>{{ f.hora_fin.slice(0, 5) }}</td>
                <td class="right"><button class="link" (click)="quitarFranja($index)">Quitar</button></td>
              </tr>
            } @empty { <tr><td colspan="4" class="muted">Sin franjas registradas.</td></tr> }
          </tbody>
        </table>
        <div class="row" style="margin-top:.75rem">
          <select [(ngModel)]="nuevaFranja.dia" aria-label="Día">
            @for (n of [1, 2, 3, 4, 5, 6, 7]; track n) { <option [ngValue]="n">{{ dias[n] }}</option> }
          </select>
          <input type="time" [(ngModel)]="nuevaFranja.hora_inicio" aria-label="Desde" />
          <input type="time" [(ngModel)]="nuevaFranja.hora_fin" aria-label="Hasta" />
          <button class="secondary" (click)="agregarFranja()">Agregar franja</button>
          <span class="spacer"></span>
          <button (click)="guardarDisponibilidad(d)">Guardar disponibilidad</button>
        </div>
      </div>
    }
  `,
  styles: `
    tr.clicable { cursor: pointer; }
    .ficha { display: grid; gap: .9rem; }
    .ficha h3 { margin: .4rem 0 0; }
    .resumen .kpi { border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem; display: grid; gap: .3rem; }
    .resumen .valor { font-size: 1.4rem; }
    .valor.excede { color: var(--danger); }
    .semana { display: grid; gap: 4px; overflow-x: auto; }
    .eje, .dia { display: grid; grid-template-columns: 2.6rem minmax(420px, 1fr); align-items: center; gap: .4rem; }
    .dia > span { font-size: .8rem; color: var(--muted); }
    .horas { position: relative; height: 1rem; }
    .horas span { position: absolute; transform: translateX(-50%); font-size: .7rem; color: var(--muted); }
    .pista { position: relative; height: 26px; background: var(--bg); border: 1px solid var(--border); border-radius: 5px; }
    .pista span { position: absolute; top: 0; bottom: 0; }
    .disp, i.disp { background: var(--ok-soft); }
    .clase, i.clase { background: var(--primary); color: #fff; font-size: .7rem; line-height: 24px; padding: 0 .3rem; border-radius: 4px; overflow: hidden; white-space: nowrap; }
    .clase.choque, i.clase.choque { background: var(--danger); }
    .leyenda { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font-size: .8rem; margin-top: .3rem; }
    .leyenda i { display: inline-block; width: .9rem; height: .7rem; border-radius: 2px; vertical-align: middle; padding: 0; }
    .leyenda i.disp { border: 1px solid var(--ok); }
    .acciones { padding-top: .25rem; }
  `,
})
export class DocentesPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly esAdmin = inject(AuthService).tieneRol('admin');
  protected readonly dias = DIAS;

  protected readonly docentes = signal<Docente[]>([]);
  protected readonly error = signal('');
  protected readonly editando = signal<Docente | null | undefined>(undefined);
  protected readonly seleccionado = signal<Docente | null>(null);
  protected readonly franjas = signal<Disponibilidad[]>([]);
  protected readonly seccionesDoc = signal<Seccion[]>([]);
  private readonly periodos = signal<Periodo[]>([]);
  /** Docente destino elegido para reasignar cada sección (undefined = sin elegir, null = sin asignar). */
  protected destino: Record<number, number | null | undefined> = {};
  protected readonly marcas = [6, 8, 10, 12, 14, 16, 18, 20, 22];

  private readonly abiertas = computed(() =>
    this.seccionesDoc().filter((s) => this.periodo(s.periodo_id)?.estado !== 'cerrado'),
  );
  protected readonly horas = computed(() => {
    const minutos = this.abiertas()
      .flatMap((s) => s.horarios)
      .reduce((t, h) => t + this.min(h.hora_fin) - this.min(h.hora_inicio), 0);
    return Math.round((minutos / 60) * 10) / 10;
  });
  protected readonly estudiantes = computed(() => this.seccionesDoc().reduce((t, s) => t + s.inscritos, 0));
  protected readonly actasCerradas = computed(() => this.seccionesDoc().filter((s) => s.acta_cerrada).length);
  protected readonly otrosDocentes = computed(() =>
    this.docentes().filter((o) => o.id !== this.seleccionado()?.id && o.estado === 'activo'),
  );
  protected nuevaFranja: Disponibilidad = { dia: 1, hora_inicio: '07:00', hora_fin: '12:00' };
  protected q = '';
  protected cuentaSel: number | null = null;
  protected readonly cuentasLibres = signal<Usuario[]>([]);

  protected readonly form = inject(FormBuilder).group({
    codigo: ['', Validators.required],
    nombres: ['', Validators.required],
    apellidos: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    especialidad: [''],
    max_horas_semana: [20, [Validators.required, Validators.min(1)]],
    estado: ['activo' as Docente['estado']],
    password: ['', Validators.minLength(8)],
  });

  ngOnInit(): void {
    this.cargar();
    this.api.periodos().subscribe((p) => this.periodos.set(p));
  }

  cargar(): void {
    this.api.docentes({ q: this.q }).subscribe((d) => this.docentes.set(d));
  }

  nuevo(): void {
    this.form.reset({ estado: 'activo', max_horas_semana: 20 });
    this.editando.set(null);
  }

  editar(d: Docente): void {
    this.form.reset({ ...d, password: '' });
    this.editando.set(d);
    this.cuentaSel = null;
    if (!d.usuario_id) this.cargarCuentasLibres();
  }

  private cargarCuentasLibres(): void {
    this.api.cuentasSinExpediente('docente').subscribe((c) => this.cuentasLibres.set(c));
  }

  vincular(r: Docente): void {
    this.error.set('');
    this.api.vincularDocente(r.id, this.cuentaSel!).subscribe({
      next: (act) => {
        this.cuentaSel = null;
        this.editar(act);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  desvincular(r: Docente): void {
    if (!confirm(`¿Desvincular la cuenta ${r.email} de este expediente? La persona ya no podrá ver sus datos académicos.`)) return;
    this.error.set('');
    this.api.desvincularDocente(r.id).subscribe({
      next: (act) => {
        this.editar(act);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  guardar(): void {
    this.error.set('');
    const { password, codigo, ...datos } = this.form.getRawValue();
    const actual = this.editando();
    const peticion = actual
      ? this.api.actualizarDocente(actual.id, { ...datos, ...(password ? { password } : {}) } as Partial<Docente>)
      : this.api.crearDocente({ ...datos, codigo, ...(password ? { password } : {}) } as Partial<Docente>);
    peticion.subscribe({
      next: () => {
        this.editando.set(undefined);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  eliminar(d: Docente): void {
    const cuenta = d.usuario_id ? ' Su cuenta de acceso se desactivará.' : '';
    if (!confirm(`¿Eliminar al docente ${d.nombres} ${d.apellidos} (código ${d.codigo})?${cuenta} Esta acción no se puede deshacer.`)) return;
    this.error.set('');
    this.api.eliminarDocente(d.id).subscribe({
      next: () => {
        if (this.seleccionado()?.id === d.id) this.seleccionado.set(null);
        if ((this.editando() as Docente | null | undefined)?.id === d.id) this.editando.set(undefined);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  abrirFicha(d: Docente): void {
    this.seleccionado.set(d);
    this.destino = {};
    this.franjas.set([...d.disponibilidad].sort((a, b) => a.dia - b.dia || a.hora_inicio.localeCompare(b.hora_inicio)));
    this.cargarSecciones(d.id);
  }

  private cargarSecciones(docenteId: number): void {
    this.api.secciones({ docente_id: docenteId }).subscribe((s) =>
      this.seccionesDoc.set([...s].sort((a, b) => b.periodo_id - a.periodo_id || a.curso.codigo.localeCompare(b.curso.codigo))),
    );
  }

  reasignar(s: Seccion): void {
    const nuevo = this.destino[s.id] ?? null;
    const nombre = nuevo === null ? 'nadie (sin docente)' : this.docentes().find((o) => o.id === nuevo)?.nombres;
    const aviso = s.acta_cerrada ? ' El acta de esta sección ya está cerrada: el registro dejará de mostrar quién la calificó.' : '';
    if (!confirm(`¿Reasignar ${s.curso.codigo} sección ${s.codigo} a ${nombre}?${aviso}`)) return;
    this.error.set('');
    this.api.actualizarSeccion(s.id, { docente_id: nuevo }).subscribe({
      next: () => {
        delete this.destino[s.id];
        this.cargarSecciones(this.seleccionado()!.id);
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  marcarInactivo(d: Docente): void {
    this.error.set('');
    this.api.actualizarDocente(d.id, { estado: 'inactivo' }).subscribe({
      next: (act) => {
        this.seleccionado.set(act);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  periodo(id: number): Periodo | undefined {
    return this.periodos().find((p) => p.id === id);
  }

  horario(s: Seccion): string {
    return (
      s.horarios.map((h) => `${DIAS[h.dia].slice(0, 3)} ${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)} · ${h.aula.codigo}`).join(', ') ||
      'Sin horario'
    );
  }

  franjasDia(dia: number): Disponibilidad[] {
    return this.franjas().filter((f) => f.dia === dia);
  }

  clasesDia(dia: number) {
    const franjas = this.franjasDia(dia);
    return this.abiertas().flatMap((s) =>
      s.horarios
        .filter((h) => h.dia === dia)
        .map((h) => ({
          ini: h.hora_inicio,
          fin: h.hora_fin,
          etiqueta: `${s.curso.codigo} ${s.codigo}`,
          texto: `${s.curso.codigo} · ${s.curso.nombre} · sección ${s.codigo} · ${h.hora_inicio.slice(0, 5)}–${h.hora_fin.slice(0, 5)} · ${h.aula.codigo}`,
          fuera:
            this.franjas().length > 0 &&
            !franjas.some((f) => this.min(f.hora_inicio) <= this.min(h.hora_inicio) && this.min(h.hora_fin) <= this.min(f.hora_fin)),
        })),
    );
  }

  min(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  pos(minutos: number): number {
    return (100 * (Math.min(Math.max(minutos, DESDE), HASTA) - DESDE)) / (HASTA - DESDE);
  }

  ancho(ini: string, fin: string): number {
    return Math.max(0, this.pos(this.min(fin)) - this.pos(this.min(ini)));
  }

  min100(v: number): number {
    return Math.min(100, v);
  }

  agregarFranja(): void {
    this.franjas.update((f) => [...f, { ...this.nuevaFranja }]);
  }

  quitarFranja(i: number): void {
    this.franjas.update((f) => f.filter((_, idx) => idx !== i));
  }

  guardarDisponibilidad(d: Docente): void {
    this.error.set('');
    const franjas = this.franjas().map(({ dia, hora_inicio, hora_fin }) => ({ dia, hora_inicio, hora_fin }));
    this.api.disponibilidad(d.id, franjas).subscribe({
      next: (act) => {
        this.abrirFicha(act);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }
}
