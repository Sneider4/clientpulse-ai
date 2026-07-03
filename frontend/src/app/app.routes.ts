import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NuevoTicketComponent } from './components/tickets/nuevo-ticket/nuevo-ticket.component';
import { ListaTicketsComponent } from './components/tickets/lista-tickets/lista-tickets.component';
import { DashboardComponent } from './components/dashboard/dashboard/dashboard.component';
import { ClienteDetalleComponent } from './components/clientes/cliente-detalle/cliente-detalle.component';
import { CrearClienteComponent } from './components/clientes/crear-cliente/crear-cliente.component';
import { CrearContratoComponent } from './components/clientes/crear-contrato/crear-contrato.component';
import { authGuard } from './services/auth/auth.guard';
import { moduleGuard } from './services/auth/module.guard';
import { AuthService } from './services/auth/auth.service';
import { LoginComponent } from './components/login/login/login.component';
import { DetalleTicketComponent } from './components/tickets/detalle-ticket/detalle-ticket.component';
import { PerdidoComponent } from './components/error/perdido/perdido.component';
import { SinAccesoComponent } from './components/error/sin-acceso/sin-acceso.component';
import { AdminPanelComponent } from './components/admin/admin-panel/admin-panel.component';
import { EquipoComponent } from './components/equipo/equipo.component';

const adminGuard = () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) { router.navigate(['/login']); return false; }
    if (!auth.isAdmin())    { router.navigate(['/sin-acceso']); return false; }
    return true;
};

export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent,
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        canMatch: [moduleGuard('DASHBOARD', 'DASHBOARD_VER')],
    },
    {
        path: 'nuevo-ticket',
        component: NuevoTicketComponent,
        canMatch: [moduleGuard('TICKETS', 'TICKETS_CREAR')],
    },
    {
        path: 'tickets',
        component: ListaTicketsComponent,
        canMatch: [moduleGuard('TICKETS', 'TICKETS_VER')],
    },
    {
        path: 'detalle-ticket/:id',
        component: DetalleTicketComponent,
        canMatch: [moduleGuard('TICKETS', 'TICKETS_VER')],
    },
    {
        path: 'clientes/nuevo',
        component: CrearClienteComponent,
        canMatch: [moduleGuard('CLIENTES', 'CLIENTES_VER')],
    },
    {
        path: 'cliente-detalle/:id',
        component: ClienteDetalleComponent,
        canMatch: [moduleGuard('CLIENTES', 'CLIENTES_VER')],
    },
    {
        path: 'contratos/nuevo',
        component: CrearContratoComponent,
        canMatch: [moduleGuard('CONTRATOS', 'CONTRATOS_VER')],
    },
    {
        path: 'admin',
        component: AdminPanelComponent,
        canMatch: [adminGuard],
    },
    {
        path: 'equipo',
        component: EquipoComponent,
        canMatch: [moduleGuard('EQUIPO', 'USUARIOS_FINALES_GESTIONAR')],
    },
    {
        path: 'sin-acceso',
        component: SinAccesoComponent,
        canMatch: [authGuard],
    },
    {
        path: 'error',
        component: PerdidoComponent,
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',
    },
    {
        path: '**',
        redirectTo: 'error',
    },
];
