import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../../../services/ticket.service';
import { TicketWithAnalysis } from '../../../../models/vortex.model'
import { catchError, Subscription, tap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import Swal from 'sweetalert2';

type FiltroAsignacion = 'todos' | 'sin_asignar' | 'mios';

@Component({
    selector: 'app-lista-tickets',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './lista-tickets.component.html',
    styleUrls: ['./lista-tickets.component.scss']
})
export class ListaTicketsComponent implements OnInit {
    tickets: TicketWithAnalysis[] = [];
    loading = false;
    errorMessage = '';
    tomandoId: number | null = null;

    pageSize = 10;
    currentPage = 1;
    filtro: FiltroAsignacion = 'todos';

    private subscriptions: Subscription = new Subscription();

    private ticketService = inject(TicketService)
    auth = inject(AuthService);

    constructor() { }

    ngOnInit(): void {
        this.cargarTickets();
    }

    get puedeGestionar(): boolean {
        return this.auth.can('TICKETS', 'TICKETS_GESTIONAR');
    }

    get ticketsFiltrados(): TicketWithAnalysis[] {
        if (!this.puedeGestionar || this.filtro === 'todos') return this.tickets;

        const miId = this.auth.currentUser()?.id_usuario;
        if (this.filtro === 'mios') {
            return this.tickets.filter((t) => t.ticket.id_agente_asignado === miId);
        }
        // sin_asignar
        return this.tickets.filter((t) => !t.ticket.id_agente_asignado);
    }

    cambiarFiltro(filtro: FiltroAsignacion): void {
        this.filtro = filtro;
        this.currentPage = 1;
    }

    cargarTickets() {
        this.loading = true;
        this.errorMessage = '';
        const tickets = this.ticketService.getTickets().pipe(
            tap((items) => {
                this.loading = false;
                this.tickets = items;
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessage =
                    error?.error?.message || 'Error al cargar la lista de tickets';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(tickets);
    }

    tomarTicket(idTicket: number): void {
        const miId = this.auth.currentUser()?.id_usuario;
        if (!miId) return;

        this.tomandoId = idTicket;
        const sub = this.ticketService.asignarTicket(idTicket, miId).pipe(
            tap(() => {
                this.tomandoId = null;
                this.cargarTickets();
            }),
            catchError((error) => {
                this.tomandoId = null;
                Swal.fire({ title: 'No se pudo tomar el ticket', text: error?.error?.message || 'Ocurrió un error.', icon: 'error', confirmButtonText: 'Aceptar' });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    getRiesgoClass(riesgo: string | null) {
        switch (riesgo) {
            case 'ALTO':
                return 'vx-badge-crit';
            case 'MEDIO':
                return 'vx-badge-warn';
            case 'BAJO':
                return 'vx-badge-good';
            default:
                return 'vx-badge-nd';
        }
    }

    getSentimientoClass(sentimiento: string | null) {
        switch (sentimiento) {
            case 'POSITIVO':
                return 'vx-badge-good';
            case 'NEGATIVO':
                return 'vx-badge-crit';
            case 'NEUTRO':
                return 'vx-badge-nd';
            default:
                return 'vx-badge-nd';
        }
    }

    getEstadoClass(estado: string) {
        switch (estado) {
            case 'ENTREGADO':
                return 'vx-badge-navy-1';
            case 'EN_PROCESO':
                return 'vx-badge-navy-3';
            case 'CERRADO':
                return 'vx-badge-good';
            case 'BLOQUEADO_POR_SEGURIDAD':
                return 'vx-badge-crit';
            default:
                return 'vx-badge-nd';
        }
    }

    get totalPages(): number {
        return Math.ceil(this.ticketsFiltrados.length / this.pageSize) || 1;
    }

    get pages(): number[] {
        const total = this.totalPages;
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    goToPage(page: number): void {
        if (page < 1 || page > this.totalPages) {
            return;
        }
        this.currentPage = page;
    }
}
