import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Contrato } from '../../models/vortex.model';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class ContratoService {
    private baseUrl = `${environment.apiUrl}/contratos`;

    constructor(private http: HttpClient) { }

    crearContrato(data: any): Observable<Contrato> {
        return this.http.post<Contrato>(`${this.baseUrl}/insertar-contrato`, data);
    }

    listarContratos(): Observable<Contrato[]> {
        return this.http.get<Contrato[]>(`${this.baseUrl}/consultar-contratos`);
    }
}
