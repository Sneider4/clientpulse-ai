import { Component, inject, OnInit } from '@angular/core';
import { catchError, Subscription, tap } from 'rxjs';
import { TicketService } from '../../../services/ticket.service';
import { AuthService } from '../../../services/auth/auth.service';
import { ActivatedRoute } from '@angular/router';
import moment from 'moment';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgenteDisponible, EstadoTicketAsignable, TicketMensaje } from '../../../../models/vortex.model';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-detalle-ticket',
    imports: [NgClass, FormsModule],
    templateUrl: './detalle-ticket.component.html',
    styleUrl: './detalle-ticket.component.scss'
})
export class DetalleTicketComponent implements OnInit {

    ticketId!: number;
    data: any = null;
    loading = false;
    errorMessage = '';

    agentesDisponibles: AgenteDisponible[] = [];
    gestionando = false;

    mensajes: TicketMensaje[] = [];
    loadingMensajes = false;
    nuevoMensajeTexto = '';
    nuevoMensajeEsNotaInterna = false;
    enviandoMensaje = false;

    private subscriptions: Subscription = new Subscription();

    private route = inject(ActivatedRoute)
    private ticketService = inject(TicketService)
    auth = inject(AuthService);

    constructor() { }

    ngOnInit(): void {
        this.route.paramMap.subscribe((params) => {
            const id = Number(params.get('id'));
            if (!Number.isNaN(id)) {
                this.ticketId = id;
                this.cargarDetalleTicket();
                this.cargarMensajes();
            } else {
                this.errorMessage = 'ID de cliente inválido';
            }
        });

        if (this.auth.can('TICKETS', 'TICKETS_GESTIONAR')) {
            this.cargarAgentesDisponibles();
        }
    }

    cargarDetalleTicket() {
        const resumen = this.ticketService.getDetalleTicket(this.ticketId).pipe(
            tap((data) => {
                this.loading = false;
                this.data = data;
                console.log(data);
            }),
            catchError((error) => {
                this.loading = false;
                console.error(error);
                this.errorMessage =
                    error?.error?.message || 'Error al cargar el detalle del cliente';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(resumen);
    }

    cargarAgentesDisponibles() {
        const sub = this.ticketService.getAgentesDisponibles().pipe(
            tap((data) => (this.agentesDisponibles = data)),
            catchError((error) => {
                console.error(error);
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    asignar(idAgente: string) {
        if (!idAgente) return;
        this.gestionando = true;
        const sub = this.ticketService.asignarTicket(this.ticketId, Number(idAgente)).pipe(
            tap(() => {
                this.gestionando = false;
                this.cargarDetalleTicket();
            }),
            catchError((error) => {
                this.gestionando = false;
                Swal.fire({ title: 'No se pudo asignar', text: error?.error?.message || 'Ocurrió un error.', icon: 'error', confirmButtonText: 'Aceptar' });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    cambiarEstado(estado: EstadoTicketAsignable) {
        this.gestionando = true;
        const sub = this.ticketService.actualizarEstado(this.ticketId, estado).pipe(
            tap(() => {
                this.gestionando = false;
                this.cargarDetalleTicket();
            }),
            catchError((error) => {
                this.gestionando = false;
                Swal.fire({ title: 'No se pudo actualizar el estado', text: error?.error?.message || 'Ocurrió un error.', icon: 'error', confirmButtonText: 'Aceptar' });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    cargarMensajes() {
        this.loadingMensajes = true;
        const sub = this.ticketService.getMensajes(this.ticketId).pipe(
            tap((data) => {
                this.loadingMensajes = false;
                this.mensajes = data;
            }),
            catchError((error) => {
                this.loadingMensajes = false;
                console.error(error);
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    enviarMensaje() {
        const texto = this.nuevoMensajeTexto.trim();
        if (!texto) return;

        this.enviandoMensaje = true;
        const tipo = this.nuevoMensajeEsNotaInterna ? 'NOTA_INTERNA' : 'RESPUESTA';
        const sub = this.ticketService.enviarMensaje(this.ticketId, texto, tipo).pipe(
            tap(() => {
                this.enviandoMensaje = false;
                this.nuevoMensajeTexto = '';
                this.nuevoMensajeEsNotaInterna = false;
                this.cargarMensajes();
            }),
            catchError((error) => {
                this.enviandoMensaje = false;
                Swal.fire({ title: 'No se pudo enviar', text: error?.error?.message || 'Ocurrió un error.', icon: 'error', confirmButtonText: 'Aceptar' });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    getPrioridadClass(prioridad: string | null | undefined): string {
        const p = (prioridad || '').toUpperCase();
        switch (p) {
            case 'CRITICA':
            case 'CRÍTICA':
            case 'ALTA':
                return 'vx-badge-crit';
            case 'MEDIA':
                return 'vx-badge-warn';
            case 'BAJA':
                return 'vx-badge-good';
            default:
                return 'vx-badge-nd';
        }
    }

    getSentimientoClass(sentimiento: string | null | undefined): string {
        switch (sentimiento) {
            case 'POSITIVO':
                return 'vx-badge-good';
            case 'NEUTRO':
                return 'vx-badge-nd';
            case 'NEGATIVO':
                return 'vx-badge-crit';
            default:
                return 'vx-badge-nd';
        }
    }

    getRiesgoClass(riesgo: string | null | undefined): string {
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

    formateadorFecha(fecha: string | null) {
        moment.locale('es');
        return moment(fecha).format('dddd, DD [de] MMMM YYYY');
    }

    goBack(): void {
        window.history.back();
    }
}
