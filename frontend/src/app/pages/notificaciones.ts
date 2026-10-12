import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { mensajeError } from '../core/auth.interceptor';
import { Notificacion } from '../core/models';

@Component({
  selector: 'app-notificaciones',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="row">
      <h1>Notificaciones</h1><span class="spacer"></span>
      <button class="secondary" (click)="marcarTodas()">Marcar todas como leídas</button>
    </div>
    @for (n of notificaciones(); track n.id) {
      <div class="card" [style.opacity]="n.leida ? 0.65 : 1">
        <div class="row">
          <strong>{{ n.titulo }}</strong>
          @if (!n.leida) { <span class="badge">nueva</span> }
          <span class="spacer"></span>
          <span class="muted">{{ n.fecha | date: 'short' }}</span>
        </div>
        <p style="margin:.5rem 0 0">{{ n.mensaje }}</p>
        @if (!n.leida) { <button class="link" (click)="leer(n)">Marcar como leída</button> }
      </div>
    } @empty { <div class="card muted">No tiene notificaciones.</div> }

    <h2 style="margin-top:2rem">Cambiar contraseña</h2>
    <div class="card">
      @if (msg()) { <div class="alert" [class.error]="esError()" [class.ok]="!esError()">{{ msg() }}</div> }
      <div class="row">
        <input type="password" placeholder="Contraseña actual" [(ngModel)]="actual" />
        <input type="password" placeholder="Nueva contraseña (mín. 8)" [(ngModel)]="nueva" />
        <button [disabled]="!actual || nueva.length < 8" (click)="cambiarPassword()">Actualizar</button>
      </div>
    </div>
  `,
})
export class NotificacionesPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly notificaciones = signal<Notificacion[]>([]);
  protected readonly msg = signal('');
  protected readonly esError = signal(false);
  protected actual = '';
  protected nueva = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.api.notificaciones().subscribe((n) => this.notificaciones.set(n));
  }

  leer(n: Notificacion): void {
    this.api.marcarLeida(n.id).subscribe(() => this.cargar());
  }

  marcarTodas(): void {
    this.api.marcarTodas().subscribe(() => this.cargar());
  }

  cambiarPassword(): void {
    this.api.cambiarPassword(this.actual, this.nueva).subscribe({
      next: () => {
        this.msg.set('Contraseña actualizada.');
        this.esError.set(false);
        this.actual = this.nueva = '';
      },
      error: (e) => {
        this.msg.set(mensajeError(e));
        this.esError.set(true);
      },
    });
  }
}
