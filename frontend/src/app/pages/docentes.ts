import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/auth.interceptor';
import { DIAS, Disponibilidad, Docente, Usuario } from '../core/models';

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
          <thead><tr><th>Código</th><th>Nombre</th><th>Especialidad</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (d of docentes(); track d.id) {
              <tr [class.selected]="seleccionado()?.id === d.id">
                <td>{{ d.codigo }}</td>
                <td>{{ d.apellidos }}, {{ d.nombres }}</td>
                <td>{{ d.especialidad }}</td>
                <td>{{ d.email }}</td>
                <td><span class="badge" [class]="d.estado">{{ d.estado }}</span></td>
                <td class="right">
                  <button class="link" (click)="editar(d)">Editar</button>
                  <button class="link" (click)="verDisponibilidad(d)">Disponibilidad</button>
                  @if (esAdmin) { <button class="link peligro" (click)="eliminar(d)">Eliminar</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (seleccionado(); as d) {
      <div class="card">
        <h2>Disponibilidad de {{ d.nombres }} {{ d.apellidos }}</h2>
        <p class="muted">Si no se registran franjas, el docente se considera disponible en cualquier horario.</p>
        <table>
          <thead><tr><th>Día</th><th>Desde</th><th>Hasta</th><th></th></tr></thead>
          <tbody>
            @for (f of franjas(); track $index) {
              <tr>
                <td>{{ dias[f.dia] }}</td><td>{{ f.hora_inicio.slice(0, 5) }}</td><td>{{ f.hora_fin.slice(0, 5) }}</td>
                <td class="right"><button class="link" (click)="quitarFranja($index)">Quitar</button></td>
              </tr>
            }
          </tbody>
        </table>
        <div class="row" style="margin-top:.75rem">
          <select [(ngModel)]="nuevaFranja.dia">
            @for (n of [1, 2, 3, 4, 5, 6, 7]; track n) { <option [ngValue]="n">{{ dias[n] }}</option> }
          </select>
          <input type="time" [(ngModel)]="nuevaFranja.hora_inicio" />
          <input type="time" [(ngModel)]="nuevaFranja.hora_fin" />
          <button class="secondary" (click)="agregarFranja()">Agregar franja</button>
          <span class="spacer"></span>
          <button (click)="guardarDisponibilidad(d)">Guardar disponibilidad</button>
        </div>
      </div>
    }
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

  verDisponibilidad(d: Docente): void {
    this.seleccionado.set(d);
    this.franjas.set([...d.disponibilidad].sort((a, b) => a.dia - b.dia || a.hora_inicio.localeCompare(b.hora_inicio)));
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
        this.verDisponibilidad(act);
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }
}
