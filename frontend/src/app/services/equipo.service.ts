import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { CrearUsuarioFinalRequest, UsuarioFinal } from '../../models/vortex.model';

@Injectable({
    providedIn: 'root'
})
export class EquipoService {
    private baseUrl = `${environment.apiUrl}/equipo`;

    constructor(private http: HttpClient) { }

    listarUsuariosFinales(): Observable<UsuarioFinal[]> {
        return this.http.get<{ items: UsuarioFinal[] }>(`${this.baseUrl}/usuarios-finales`).pipe(
            map((resp) => resp.items)
        );
    }

    crearUsuarioFinal(data: CrearUsuarioFinalRequest): Observable<UsuarioFinal> {
        return this.http.post<UsuarioFinal>(`${this.baseUrl}/usuarios-finales`, data);
    }
}
