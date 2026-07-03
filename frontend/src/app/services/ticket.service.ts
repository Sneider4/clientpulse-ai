import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { map, Observable } from 'rxjs';
import { CreateTicketRequest, CreateTicketResponse, TicketWithAnalysis, ContextoCreacionTicket, AgenteDisponible, EstadoTicketAsignable, TicketMensaje, TipoMensajeTicket } from '../../models/vortex.model';

@Injectable({
    providedIn: 'root'
})
export class TicketService {
    private baseUrl = `${environment.apiUrl}/tickets`;

    constructor(private http: HttpClient) { }

    crearTicket(data: CreateTicketRequest): Observable<CreateTicketResponse> {
        return this.http.post<CreateTicketResponse>(`${this.baseUrl}/listadoTicketAnalisis`, data);
    }

    getTickets(): Observable<TicketWithAnalysis[]> {
        return this.http.get<{ items: TicketWithAnalysis[] }>(`${this.baseUrl}/listadoTicket`).pipe(
            // nos quedamos solo con el array items
            map((resp) => resp.items)
        );
    }

    getDetalleTicket(idTicket: number): Observable<any> {
        return this.http.get<any>(`${this.baseUrl}/${idTicket}/detalleTicket`);
    }

    /**
     * Contexto (cliente + catálogo de servicios propios) para crear un ticket.
     * Para usuarios con id_cliente fijo, el backend lo infiere de la sesión.
     * El admin (sin id_cliente fijo) debe pasar idCliente explícitamente.
     */
    getContextoCreacion(idCliente?: number): Observable<ContextoCreacionTicket> {
        let params = new HttpParams();
        if (idCliente) {
            params = params.set('id_cliente', idCliente);
        }
        return this.http.get<ContextoCreacionTicket>(`${this.baseUrl}/contexto-creacion`, { params });
    }

    /** Agentes/supervisores de la propia empresa, para el selector "Asignar a". */
    getAgentesDisponibles(): Observable<AgenteDisponible[]> {
        return this.http.get<{ items: AgenteDisponible[] }>(`${this.baseUrl}/agentes-disponibles`).pipe(
            map((resp) => resp.items)
        );
    }

    asignarTicket(idTicket: number, idAgente: number): Observable<any> {
        return this.http.patch<any>(`${this.baseUrl}/${idTicket}/asignar`, { id_agente: idAgente });
    }

    actualizarEstado(idTicket: number, estado: EstadoTicketAsignable): Observable<any> {
        return this.http.patch<any>(`${this.baseUrl}/${idTicket}/estado`, { estado });
    }

    /** Hilo de conversación del ticket: respuestas visibles al cliente + notas internas (si aplica). */
    getMensajes(idTicket: number): Observable<TicketMensaje[]> {
        return this.http.get<{ items: TicketMensaje[] }>(`${this.baseUrl}/${idTicket}/mensajes`).pipe(
            map((resp) => resp.items)
        );
    }

    enviarMensaje(idTicket: number, mensaje: string, tipo?: TipoMensajeTicket): Observable<TicketMensaje> {
        return this.http.post<TicketMensaje>(`${this.baseUrl}/${idTicket}/mensajes`, { mensaje, tipo });
    }
}
