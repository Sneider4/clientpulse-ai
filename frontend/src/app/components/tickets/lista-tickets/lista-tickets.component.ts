import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../../../services/ticket.service';
import { TicketWithAnalysis } from '../../../../models/vortex.model'
import { catchError, Subscription, tap } from 'rxjs';
import { RouterLink } from '@angular/router';

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

    pageSize = 10;
    currentPage = 1;

    private subscriptions: Subscription = new Subscription();

    private ticketService = inject(TicketService)

    constructor() { }

    ngOnInit(): void {
        this.cargarTickets();
    }

    cargarTickets() {
        this.loading = true;
        this.errorMessage = '';
        const tickets = this.ticketService.getTickets().pipe(
            tap((items) => {
                this.loading = false;
                this.tickets = items;
                console.log("🚀 ~ ListaTicketsComponent ~ cargarTickets ~ this.tickets:", this.tickets)
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


    getRiesgoClass(riesgo: string | null) {
        switch (riesgo) {
            case 'ALTO':
                return 'text-bg-danger';
            case 'MEDIO':
                return 'text-bg-warning';
            case 'BAJO':
                return 'text-bg-success';
            default:
                return 'text-bg-secondary';
        }
    }

    getSentimientoClass(sentimiento: string | null) {
        switch (sentimiento) {
            case 'POSITIVO':
                return 'text-bg-success';
            case 'NEGATIVO':
                return 'text-bg-danger';
            case 'NEUTRO':
                return 'text-bg-secondary';
            default:
                return 'text-bg-light text-muted';
        }
    }

    get totalPages(): number {
        return Math.ceil(this.tickets.length / this.pageSize) || 1;
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
