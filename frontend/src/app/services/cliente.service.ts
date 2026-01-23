import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Cliente, ClienteConContratosActivos, ClienteResumen, Contrato } from '../../models/vortex.model';

@Injectable({
    providedIn: 'root'
})
export class ClienteService {
    private baseUrl = `${environment.apiUrl}/clientes`;

    constructor(private http: HttpClient) { }

    getResumen(idCliente: number): Observable<ClienteResumen> {
        return this.http.get<ClienteResumen>(`${this.baseUrl}/${idCliente}/resumen-cliente`);
    }

    buscarPorNit(nit: string): Observable<ClienteConContratosActivos> {
        return this.http.get<ClienteConContratosActivos>(`${this.baseUrl}/consultar-cliente-por-nit/${nit}`);
    }

    crearCliente(data: any): Observable<Cliente> {
        return this.http.post<Cliente>(`${this.baseUrl}/insertar-cliente`, data);
    }



    listarClientes(): Observable<Cliente[]> {
        return this.http.get<Cliente[]>(`${this.baseUrl}/consultar-clientes`);
    }
}
