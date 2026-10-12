import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { mensajeError } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div style="min-height:100vh;display:grid;place-items:center;padding:1rem">
      <form class="card" style="width:min(380px,100%)" [formGroup]="form" (ngSubmit)="entrar()">
        <h1>SAIU</h1>
        <p class="muted" style="margin-top:-.5rem">Sistema Académico Integral Universitario</p>
        @if (error()) { <div class="alert error">{{ error() }}</div> }
        <div class="grid">
          <label>Correo institucional <input type="email" formControlName="email" autocomplete="username" /></label>
          <label>Contraseña <input type="password" formControlName="password" autocomplete="current-password" /></label>
          <button type="submit" [disabled]="form.invalid || cargando()">
            {{ cargando() ? 'Ingresando…' : 'Iniciar sesión' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  entrar(): void {
    const { email, password } = this.form.getRawValue();
    this.cargando.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/inicio']),
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
