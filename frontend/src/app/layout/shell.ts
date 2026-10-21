import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Rol } from '../core/models';

interface ItemMenu {
  ruta: string;
  texto: string;
  roles: Rol[] | null;
}

const MENU: ItemMenu[] = [
  { ruta: '/inicio', texto: 'Inicio', roles: null },
  { ruta: '/institucion', texto: 'Configuración', roles: ['admin'] },
  { ruta: '/usuarios', texto: 'Usuarios', roles: ['admin'] },
  { ruta: '/estudiantes', texto: 'Estudiantes', roles: ['admin', 'coordinador'] },
  { ruta: '/docentes', texto: 'Docentes', roles: ['admin', 'coordinador'] },
  { ruta: '/catalogo', texto: 'Catálogo académico', roles: ['admin', 'coordinador'] },
  { ruta: '/oferta', texto: 'Oferta y horarios', roles: ['admin', 'coordinador'] },
  { ruta: '/avance', texto: 'Mi avance', roles: ['estudiante'] },
  { ruta: '/inscripciones', texto: 'Inscripciones', roles: ['admin', 'coordinador', 'estudiante'] },
  { ruta: '/notas', texto: 'Notas y actas', roles: ['admin', 'coordinador', 'docente'] },
  { ruta: '/auditoria', texto: 'Auditoría', roles: ['admin'] },
  { ruta: '/notificaciones', texto: 'Notificaciones', roles: null },
];

const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  docente: 'Docente',
  estudiante: 'Estudiante',
};

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <nav class="sidebar">
        <div class="marca">SAIU<small>Sistema Académico Integral</small></div>
        @for (item of menu(); track item.ruta) {
          <a [routerLink]="item.ruta" routerLinkActive="active">{{ item.texto }}</a>
        }
      </nav>
      <div>
        <header class="topbar">
          <span class="spacer"></span>
          <a class="campana" routerLink="/notificaciones" title="Notificaciones">
            🔔 @if (noLeidas() > 0) { <span class="count">{{ noLeidas() }}</span> }
          </a>
          <span>
            <strong>{{ auth.usuario()?.nombre }}</strong>
            <span class="muted"> · {{ nombreRol() }}</span>
          </span>
          <button class="secondary small" (click)="auth.logout()">Cerrar sesión</button>
        </header>
        <main class="contenido"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private timer?: ReturnType<typeof setInterval>;

  protected readonly noLeidas = signal(0);
  protected readonly menu = computed(() => {
    const rol = this.auth.rol();
    return MENU.filter((m) => m.roles === null || (rol !== null && m.roles.includes(rol)));
  });
  protected readonly nombreRol = computed(() => {
    const rol = this.auth.rol();
    return rol ? NOMBRE_ROL[rol] : '';
  });

  ngOnInit(): void {
    this.contarNotificaciones();
    this.timer = setInterval(() => this.contarNotificaciones(), 60_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private contarNotificaciones(): void {
    this.api.notificaciones(true).subscribe({ next: (n) => this.noLeidas.set(n.length), error: () => {} });
  }
}
