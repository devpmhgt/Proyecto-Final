import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Parametro } from '../core/models';

@Component({
  selector: 'app-institucion',
  imports: [ReactiveFormsModule],
  template: `
    <h1>Configuración institucional</h1>
    @if (msg()) { <div class="alert" [class.error]="esError()" [class.ok]="!esError()">{{ msg() }}</div> }

    <form class="card" [formGroup]="form" (ngSubmit)="guardar()">
      <h2>Datos de la universidad</h2>
      <div class="form-grid">
        <label>Nombre <input formControlName="nombre" /></label>
        <label>Siglas <input formControlName="siglas" /></label>
        <label>Rector(a) <input formControlName="rector" /></label>
        <label>Dirección <input formControlName="direccion" /></label>
        <label>Teléfono <input formControlName="telefono" /></label>
        <label>Correo <input formControlName="email" /></label>
        <label>Sitio web <input formControlName="sitio_web" /></label>
      </div>
      <button type="submit" [disabled]="form.invalid">Guardar datos</button>
    </form>

    <div class="card">
      <h2>Parámetros académicos y reglas generales</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Clave</th><th>Valor</th><th>Descripción</th><th></th></tr></thead>
          <tbody>
            @for (p of parametros(); track p.id) {
              <tr>
                <td><code>{{ p.clave }}</code></td>
                <td><input #v [value]="p.valor" style="width:8rem" /></td>
                <td class="muted">{{ p.descripcion }}</td>
                <td class="right">
                  <button class="small" (click)="guardarParametro({ clave: p.clave, valor: v.value })">Guardar</button>
                  <button class="link" (click)="eliminar(p)">Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <h3 style="margin-top:1rem">Nuevo parámetro</h3>
      <form class="row" [formGroup]="nuevo" (ngSubmit)="guardarParametro(nuevo.getRawValue()); nuevo.reset()">
        <input placeholder="clave" formControlName="clave" />
        <input placeholder="valor" formControlName="valor" />
        <input placeholder="descripción" formControlName="descripcion" style="flex:1" />
        <button type="submit" [disabled]="nuevo.invalid">Agregar</button>
      </form>
    </div>
  `,
})
export class InstitucionPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly parametros = signal<Parametro[]>([]);
  protected readonly msg = signal('');
  protected readonly esError = signal(false);

  protected readonly form = this.fb.group({
    nombre: ['', Validators.required],
    siglas: [''],
    rector: [''],
    direccion: [''],
    telefono: [''],
    email: [''],
    sitio_web: [''],
  });
  protected readonly nuevo = this.fb.group({
    clave: ['', Validators.required],
    valor: ['', Validators.required],
    descripcion: [''],
  });

  ngOnInit(): void {
    this.api.institucion().subscribe((i) => i && this.form.patchValue(i as never));
    this.cargarParametros();
  }

  private cargarParametros(): void {
    this.api.parametros().subscribe((p) => this.parametros.set(p));
  }

  private aviso(texto: string, error = false): void {
    this.msg.set(texto);
    this.esError.set(error);
  }

  guardar(): void {
    this.api.guardarInstitucion(this.form.getRawValue()).subscribe({
      next: () => this.aviso('Datos institucionales guardados.'),
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }

  guardarParametro(p: Parametro): void {
    this.api.guardarParametro(p).subscribe({
      next: () => {
        this.aviso(`Parámetro "${p.clave}" guardado.`);
        this.cargarParametros();
      },
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }

  eliminar(p: Parametro): void {
    if (!confirm(`¿Eliminar el parámetro ${p.clave}? Se usará su valor por defecto.`)) return;
    this.api.eliminarParametro(p.id!).subscribe(() => this.cargarParametros());
  }
}
