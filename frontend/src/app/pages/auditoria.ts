import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../core/api.service';
import { Auditoria, Usuario } from '../core/models';

@Component({
  selector: 'app-auditoria',
  imports: [FormsModule, DatePipe],
  template: `
    <h1>Auditoría de operaciones</h1>
    <div class="card row">
      <label>Entidad
        <select [(ngModel)]="entidad" (change)="cargar()">
          <option value="">Todas</option>
          @for (e of entidades; track e) { <option [value]="e">{{ e }}</option> }
        </select>
      </label>
      <label>Usuario
        <select [(ngModel)]="usuarioId" (change)="cargar()">
          <option [ngValue]="null">Todos</option>
          @for (u of usuarios(); track u.id) { <option [ngValue]="u.id">{{ u.nombre }}</option> }
        </select>
      </label>
      <label>Desde <input type="date" [(ngModel)]="desde" (change)="cargar()" /></label>
      <label>Hasta <input type="date" [(ngModel)]="hasta" (change)="cargar()" /></label>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
        <tbody>
          @for (a of registros(); track a.id) {
            <tr>
              <td style="white-space:nowrap">{{ a.fecha | date: 'short' }}</td>
              <td>{{ nombreUsuario(a.usuario_id) }}</td>
              <td><span class="badge">{{ a.accion }}</span></td>
              <td>{{ a.entidad }}{{ a.entidad_id ? ' #' + a.entidad_id : '' }}</td>
              <td class="muted" style="font-family:monospace;font-size:.8rem;word-break:break-all">{{ a.detalle }}</td>
            </tr>
          } @empty { <tr><td colspan="5" class="muted">Sin registros.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class AuditoriaPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly entidades = [
    'usuario', 'institucion', 'parametro', 'estudiante', 'docente', 'carrera', 'curso', 'plan_estudio',
    'periodo', 'aula', 'seccion', 'inscripcion', 'evaluacion', 'notificacion',
  ];
  protected readonly registros = signal<Auditoria[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected entidad = '';
  protected usuarioId: number | null = null;
  protected desde = '';
  protected hasta = '';

  ngOnInit(): void {
    this.api.usuarios().subscribe((u) => this.usuarios.set(u));
    this.cargar();
  }

  cargar(): void {
    this.api
      .auditoria({
        entidad: this.entidad,
        usuario_id: this.usuarioId,
        desde: this.desde ? new Date(`${this.desde}T00:00:00`).toISOString() : null,
        hasta: this.hasta ? new Date(`${this.hasta}T23:59:59.999`).toISOString() : null,
      })
      .subscribe((r) => this.registros.set(r));
  }

  nombreUsuario(id: number | null): string {
    return this.usuarios().find((u) => u.id === id)?.nombre ?? (id ? `#${id}` : 'sistema');
  }
}
