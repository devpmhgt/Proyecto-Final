import { Routes } from '@angular/router';

import { authGuard, roleGuard } from './core/guards';
import { Shell } from './layout/shell';

const GESTION = ['admin', 'coordinador'];

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', loadComponent: () => import('./pages/inicio').then((m) => m.Inicio) },
      {
        path: 'institucion',
        data: { roles: ['admin'] },
        loadComponent: () => import('./pages/institucion').then((m) => m.InstitucionPage),
      },
      {
        path: 'usuarios',
        data: { roles: ['admin'] },
        loadComponent: () => import('./pages/usuarios').then((m) => m.UsuariosPage),
      },
      {
        path: 'estudiantes',
        data: { roles: GESTION },
        loadComponent: () => import('./pages/estudiantes').then((m) => m.EstudiantesPage),
      },
      {
        path: 'docentes',
        data: { roles: GESTION },
        loadComponent: () => import('./pages/docentes').then((m) => m.DocentesPage),
      },
      {
        path: 'catalogo',
        data: { roles: GESTION },
        loadComponent: () => import('./pages/catalogo').then((m) => m.CatalogoPage),
      },
      {
        path: 'oferta',
        data: { roles: GESTION },
        loadComponent: () => import('./pages/oferta').then((m) => m.OfertaPage),
      },
      {
        path: 'inscripciones',
        data: { roles: [...GESTION, 'estudiante'] },
        loadComponent: () => import('./pages/inscripciones').then((m) => m.InscripcionesPage),
      },
      {
        path: 'avance',
        data: { roles: [...GESTION, 'estudiante'] },
        loadComponent: () => import('./pages/avance').then((m) => m.AvancePage),
      },
      {
        path: 'notas',
        data: { roles: [...GESTION, 'docente'] },
        loadComponent: () => import('./pages/notas').then((m) => m.NotasPage),
      },
      {
        path: 'auditoria',
        data: { roles: ['admin'] },
        loadComponent: () => import('./pages/auditoria').then((m) => m.AuditoriaPage),
      },
      { path: 'notificaciones', loadComponent: () => import('./pages/notificaciones').then((m) => m.NotificacionesPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
