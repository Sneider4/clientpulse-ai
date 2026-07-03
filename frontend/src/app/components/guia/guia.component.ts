import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

export type GuiaMenuItem = { label: string; icon?: string; route: string };

type PasoGuia = { titulo: string; detalle: string };

@Component({
    selector: 'app-guia',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './guia.component.html',
    styleUrls: ['./guia.component.scss'],
})
export class GuiaComponent {
    @Input() menuItems: GuiaMenuItem[] = [];
    @Output() cerrar = new EventEmitter<void>();

    auth = inject(AuthService);

    get nombreUsuario(): string {
        return this.auth.currentUser()?.nombre?.split(' ')[0] || 'ahí';
    }

    /** Rol legible según lo que el usuario realmente puede hacer, no un código interno. */
    get rolLabel(): string {
        if (this.auth.isAdmin()) return 'Administrador global';
        if (this.auth.can('EQUIPO', 'USUARIOS_FINALES_GESTIONAR')) return 'Supervisor de empresa';
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS') && this.auth.can('TICKETS', 'TICKETS_CREAR')) return 'Agente de soporte';
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS')) return 'Visualizador (solo lectura)';
        return 'Usuario final';
    }

    get rolDescripcion(): string {
        if (this.auth.isAdmin()) {
            return 'Ves y administras toda la plataforma: todos los clientes, contratos, tickets y usuarios.';
        }
        if (this.auth.can('EQUIPO', 'USUARIOS_FINALES_GESTIONAR')) {
            return 'Ves todo lo de tu empresa (tickets, clientes, contratos) e invitas a los usuarios finales que presentan quejas o solicitudes.';
        }
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS') && this.auth.can('TICKETS', 'TICKETS_CREAR')) {
            return 'Creas y das seguimiento a todos los tickets de tu empresa.';
        }
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS')) {
            return 'Puedes consultar la información de tu empresa, pero no crear ni modificar nada.';
        }
        return 'Presentas tus propias quejas o solicitudes y consultas únicamente el estado de las tuyas.';
    }

    get pasos(): PasoGuia[] {
        if (this.auth.isAdmin()) {
            return [
                { titulo: 'Revisa el Dashboard', detalle: 'Visión general del negocio: clientes activos, contratos, ingreso mensual (MRR) y riesgo de churn de toda la plataforma.' },
                { titulo: 'Consulta Clientes y Contratos', detalle: 'Registra nuevas empresas cliente y sus contratos, o revisa el estado de los existentes.' },
                { titulo: 'Supervisa Tickets', detalle: 'Ve todos los tickets de todas las empresas y su análisis de IA (sentimiento, riesgo, prioridad).' },
                { titulo: 'Administración', detalle: 'Crea usuarios, roles y permisos, y habilita módulos por empresa cliente.' },
            ];
        }
        if (this.auth.can('EQUIPO', 'USUARIOS_FINALES_GESTIONAR')) {
            return [
                { titulo: 'Revisa el Dashboard', detalle: 'Métricas de soporte y riesgo de churn acotadas a tu empresa.' },
                { titulo: 'Invita a tu equipo en "Mi equipo"', detalle: 'Da de alta a los usuarios finales (tus clientes) para que puedan presentar sus propias quejas o solicitudes con su propia cuenta.' },
                { titulo: 'Crea y da seguimiento a tickets', detalle: 'Registra solicitudes y revisa el estado de todos los tickets de tu empresa, incluidos los que crean tus usuarios finales.' },
            ];
        }
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS') && this.auth.can('TICKETS', 'TICKETS_CREAR')) {
            return [
                { titulo: 'Revisa el Dashboard', detalle: 'Métricas de soporte y riesgo de churn de tu empresa.' },
                { titulo: 'Crea un ticket nuevo', detalle: 'Busca al cliente por NIT, selecciona el contrato y describe la solicitud — la IA la analiza automáticamente.' },
                { titulo: 'Haz seguimiento en "Tickets"', detalle: 'Consulta el estado, sentimiento y riesgo de churn de cada ticket de tu empresa.' },
            ];
        }
        if (this.auth.can('TICKETS', 'TICKETS_VER_TODOS')) {
            return [
                { titulo: 'Revisa el Dashboard', detalle: 'Métricas de soporte y riesgo de churn de tu empresa, en modo solo lectura.' },
                { titulo: 'Consulta "Tickets"', detalle: 'Revisa el estado y análisis de todos los tickets de tu empresa.' },
            ];
        }
        return [
            { titulo: 'Ve a "Nuevo ticket"', detalle: 'Cuenta tu problema o solicitud — tu empresa y contrato ya quedan seleccionados automáticamente.' },
            { titulo: 'La IA lo analiza al instante', detalle: 'Se detecta el sentimiento, la prioridad y se genera una recomendación para el equipo de soporte.' },
            { titulo: 'Consulta "Mis tickets"', detalle: 'Ahí puedes ver el estado de todo lo que has reportado — solo lo tuyo, nadie más de tu empresa lo ve mezclado con lo tuyo.' },
        ];
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.cerrar.emit();
        }
    }
}
