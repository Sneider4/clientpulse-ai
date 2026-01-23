// auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap, switchMap } from 'rxjs/operators';

type AccessResponse = {
    ok: boolean;
    user: any;
    modules: string[];
    permissions: string[];
};

@Injectable({ providedIn: 'root' })
export class AuthService {
    private baseUrl = `${environment.apiUrl}/auth`;

    private _token = signal<string | null>(localStorage.getItem('token'));
    private _user = signal<any>(this.readJson('user'));
    private _modules = signal<string[]>(this.readJson('modules') ?? []);
    private _permissions = signal<string[]>(this.readJson('permissions') ?? []);

    isLoggedIn = computed(() => !!this._token());

    constructor(private http: HttpClient) { }

    login(correo: string, password: string) {
        return this.http.post<any>(`${this.baseUrl}/login`, { correo, password }).pipe(
            tap((resp) => {
                localStorage.setItem('token', resp.token);
                this._token.set(resp.token);
            }),
            // 👇 una vez loguea, trae access completo
            switchMap(() => this.loadAccess())
        );
    }

    loadAccess() {
        return this.http.get<AccessResponse>(`${this.baseUrl}/accesos`).pipe(
            tap((resp) => {
                localStorage.setItem('user', JSON.stringify(resp.user));
                console.log('User data:', resp.user);
                localStorage.setItem('modules', JSON.stringify(resp.modules));
                localStorage.setItem('permissions', JSON.stringify(resp.permissions));

                this._user.set(resp.user);
                this._modules.set(resp.modules);
                this._permissions.set(resp.permissions);
            })
        );
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('modules');
        localStorage.removeItem('permissions');

        this._token.set(null);
        this._user.set(null);
        this._modules.set([]);
        this._permissions.set([]);
    }

    getToken() { return this._token(); }

    hasModule(code: string) {
        return this._modules().includes(code);
    }

    hasPermission(code: string) {
        return this._permissions().includes(code);
    }

    // Si quieres validar "módulo + permiso" en un solo método
    can(moduleCode: string, permissionCode?: string) {
        if (!this.hasModule(moduleCode)) return false;
        if (permissionCode && !this.hasPermission(permissionCode)) return false;
        return true;
    }

    private readJson(key: string) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }
}
