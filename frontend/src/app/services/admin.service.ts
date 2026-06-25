import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const BASE = `${environment.apiUrl}/admin`;

export interface UsuarioAdmin {
    id_usuario: number; nombre: string; correo: string;
    rol: string; id_rol: number; id_cliente: number | null;
    nombre_cliente: string | null; activo: boolean;
}

export interface RolAdmin {
    id_rol: number; codigo: string; nombre: string;
    descripcion: string | null; permisos: number[];
}

export interface PermisoAdmin {
    id_permiso: number; codigo: string; nombre: string;
    descripcion: string | null; id_modulo: number;
    modulo_codigo: string; modulo_nombre: string;
}

export interface ModuloAdmin {
    id_modulo: number; codigo: string; nombre: string; habilitado: boolean;
}

export interface ClienteBasico {
    id_cliente: number; nombre: string; nit: string; estado: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private http = inject(HttpClient);

    // Usuarios
    getUsuarios()                          { return this.http.get<any>(`${BASE}/usuarios`); }
    crearUsuario(data: any)                { return this.http.post<any>(`${BASE}/usuarios`, data); }
    actualizarUsuario(id: number, d: any)  { return this.http.put<any>(`${BASE}/usuarios/${id}`, d); }
    toggleUsuario(id: number)              { return this.http.patch<any>(`${BASE}/usuarios/${id}/toggle`, {}); }

    // Roles
    getRoles()                             { return this.http.get<any>(`${BASE}/roles`); }
    crearRol(data: any)                    { return this.http.post<any>(`${BASE}/roles`, data); }
    actualizarRol(id: number, d: any)      { return this.http.put<any>(`${BASE}/roles/${id}`, d); }
    actualizarPermisos(id: number, p: number[]) { return this.http.put<any>(`${BASE}/roles/${id}/permisos`, { permisos: p }); }
    eliminarRol(id: number)                { return this.http.delete<any>(`${BASE}/roles/${id}`); }

    // Permisos
    getPermisos()                          { return this.http.get<any>(`${BASE}/permisos`); }

    // Módulos por cliente
    getModulosCliente(id: number)          { return this.http.get<any>(`${BASE}/clientes/${id}/modulos`); }
    actualizarModulos(id: number, m: number[]) { return this.http.put<any>(`${BASE}/clientes/${id}/modulos`, { modulos: m }); }

    // Clientes
    getClientes()                          { return this.http.get<any>(`${BASE}/clientes`); }
    toggleCliente(id: number)              { return this.http.patch<any>(`${BASE}/clientes/${id}/toggle`, {}); }
}
