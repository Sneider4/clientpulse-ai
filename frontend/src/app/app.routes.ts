import { Routes } from '@angular/router';
import { NuevoTicketComponent } from './components/tickets/nuevo-ticket/nuevo-ticket.component';
import { ListaTicketsComponent } from './components/tickets/lista-tickets/lista-tickets.component';
import { DashboardComponent } from './components/dashboard/dashboard/dashboard.component';
import { ClienteDetalleComponent } from './components/clientes/cliente-detalle/cliente-detalle.component';
import { CrearClienteComponent } from './components/clientes/crear-cliente/crear-cliente.component';
import { CrearContratoComponent } from './components/clientes/crear-contrato/crear-contrato.component';
import { authGuard } from './services/auth/auth.guard';
import { LoginComponent } from './components/login/login/login.component';
import { DetalleTicketComponent } from './components/tickets/detalle-ticket/detalle-ticket.component';
import { PerdidoComponent } from './components/error/perdido/perdido.component';

export const routes: Routes = [

    {
        path: 'login',
        component: LoginComponent,
    },
    {
        path: 'nuevo-ticket',
        component: NuevoTicketComponent,
        canMatch: [authGuard],
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        canMatch: [authGuard],
    },
    {
        path: 'tickets',
        component: ListaTicketsComponent,
        canMatch: [authGuard],
    },
    {
        path: 'cliente-detalle/:id',
        component: ClienteDetalleComponent,
        canMatch: [authGuard],
    },
    {
        path: 'detalle-ticket/:id',
        component: DetalleTicketComponent,
        canMatch: [authGuard],
    },
    {
        path: 'clientes/nuevo',
        component: CrearClienteComponent,
        canMatch: [authGuard]
    },
    {
        path: 'contratos/nuevo',
        component: CrearContratoComponent,
        canMatch: [authGuard],
    },
    {
        path: 'error',
        component: PerdidoComponent,
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'login',  // al iniciar, va a login
    },
    {
        path: '**',
        redirectTo: 'error',
    },
];
