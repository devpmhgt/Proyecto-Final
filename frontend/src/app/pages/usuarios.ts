import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/auth.interceptor';
import { Rol, Usuario } from '../core/models';

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  template: `
    <h1>Usuarios y roles</h1>
    @if (error()) { <div class="alert error">{{ error() }}</div> }

    <form class="card" [formGroup]="form" (ngSubmit)="crear()">
      <h2>Nueva cuenta</h2>
      <p class="muted">Aquí se crean cuentas de administración y coordinación. Las de estudiantes y docentes se crean desde su
        expediente, en <a routerLink="/estudiantes">Estudiantes</a> o <a routerLink="/docentes">Docentes</a>, para que queden vinculadas.</p>
      <div class="form-grid">
        <label>Nombre <input formControlName="nombre" /></label>
        <label>Correo <input type="email" formControlName="email" /></label>
        <label>Rol
          <select formControlName="rol">
            @for (r of rolesPersonal; track r) { <option [value]="r">{{ r }}</option> }
          </select>
        </label>
        <label>Contraseña inicial (mín. 8) <input type="password" formControlName="password" /></label>
      </div>
      <button type="submit" [disabled]="form.invalid">Crear usuario</button>
    </form>

    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Creado</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (u of usuarios(); track u.id) {
            <tr>
              <td>{{ u.nombre }}</td>
              <td>{{ u.email }}</td>
              <td>
                @if (esPersonal(u) && u.id !== miId) {
                  <select (change)="cambiarRol(u, $any($event.target).value)" [attr.aria-label]="'Rol de ' + u.nombre">
                    @for (r of rolesPersonal; track r) { <option [value]="r" [selected]="r === u.rol">{{ r }}</option> }
                  </select>
                } @else {
                  <span class="badge">{{ u.rol }}</span>
                  @if (!esPersonal(u)) {
                    <a class="muted" style="font-size:.8rem;margin-left:.3rem" [routerLink]="u.rol === 'estudiante' ? '/estudiantes' : '/docentes'">ver expediente</a>
                  }
                }
              </td>
              <td>{{ u.creado_en | date: 'shortDate' }}</td>
              <td><span class="badge" [class]="u.activo ? 'activo' : 'inactivo'">{{ u.activo ? 'activo' : 'inactivo' }}</span></td>
              <td class="right">
                @if (u.id !== miId) { <button class="link" (click)="alternar(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button> }
                <button class="link" (click)="resetear(u)">Restablecer contraseña</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class UsuariosPage implements OnInit {
  private readonly api = inject(ApiService);
  /** Estudiantes y docentes dependen de su expediente: su rol no se cambia aquí. */
  protected readonly rolesPersonal: Rol[] = ['admin', 'coordinador'];
  protected readonly miId = inject(AuthService).usuario()?.id;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly error = signal('');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    rol: ['coordinador' as Rol, Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.api.usuarios().subscribe((u) => this.usuarios.set(u));
  }

  private actualizar(u: Usuario, cambios: Partial<Usuario> & { password?: string }): void {
    this.error.set('');
    this.api.actualizarUsuario(u.id, cambios).subscribe({
      next: () => this.cargar(),
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargar(); // devuelve el selector de rol a su valor real
      },
    });
  }

  crear(): void {
    this.error.set('');
    this.api.crearUsuario(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset();
        this.cargar();
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  esPersonal(u: Usuario): boolean {
    return this.rolesPersonal.includes(u.rol);
  }

  cambiarRol(u: Usuario, rol: Rol): void {
    this.actualizar(u, { rol });
  }

  alternar(u: Usuario): void {
    this.actualizar(u, { activo: !u.activo });
  }

  resetear(u: Usuario): void {
    const password = prompt(`Nueva contraseña para ${u.email} (mínimo 8 caracteres):`);
    if (password) this.actualizar(u, { password });
  }
}
