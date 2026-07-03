import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Servicio } from '../../models/vortex.model';

@Injectable({
    providedIn: 'root'
})
export class ServicioService {
    private baseUrl = `${environment.apiUrl}/equipo`;

    constructor(private http: HttpClient) { }

    listarServicios(): Observable<Servicio[]> {
        return this.http.get<{ items: Servicio[] }>(`${this.baseUrl}/servicios`).pipe(
            map((resp) => resp.items)
        );
    }

    crearServicio(nombre: string): Observable<Servicio> {
        return this.http.post<Servicio>(`${this.baseUrl}/servicios`, { nombre });
    }

    toggleServicio(idServicio: number): Observable<Servicio> {
        return this.http.patch<Servicio>(`${this.baseUrl}/servicios/${idServicio}/toggle`, {});
    }
}
