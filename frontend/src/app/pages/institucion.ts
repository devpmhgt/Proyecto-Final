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
      <h2>Reglas académicas</h2>
      <p class="muted">El sistema aplica estas reglas al inscribir, retirar y cerrar actas. Los cambios rigen desde que se guardan.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Regla</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            @for (p of parametros(); track p.clave) {
              <tr>
                <td>{{ p.descripcion }} <span class="muted" style="font-size:.8rem">({{ p.minimo }} a {{ p.maximo }})</span></td>
                <td><input #v type="number" [min]="p.minimo" [max]="p.maximo" [value]="p.valor" style="width:7rem" [attr.aria-label]="p.descripcion" /></td>
                <td class="right">
                  <button class="small" (click)="guardarParametro(p, v.value)">Guardar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
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

  guardarParametro(p: Parametro, valor: string): void {
    this.api.guardarParametro({ clave: p.clave, valor }).subscribe({
      next: () => {
        this.aviso(`Regla guardada: ${p.descripcion}.`);
        this.cargarParametros();
      },
      error: (e) => this.aviso(mensajeError(e), true),
    });
  }
}
