import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth/auth.service';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Swal from 'sweetalert2';

type MenuItem = {
    label: string;
    icon?: string;
    route: string;
    module: string;
    permission?: string; // opcional
};

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, RouterLinkActive, RouterLink, CommonModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})

export class AppComponent {
    title = 'frontend';
    isSidebarCollapsed = false;
    currentYear = new Date().getFullYear();

    items: MenuItem[] = [
        { label: 'Dashboard', icon: 'bi bi-speedometer2', route: '/dashboard', module: 'DASHBOARD', permission: 'DASHBOARD_VER' },
        { label: 'Nuevo ticket', icon: 'bi bi-plus-circle', route: '/nuevo-ticket', module: 'TICKETS', permission: 'TICKETS_CREAR' },
        { label: 'Tickets', icon: 'bi bi-list-check', route: '/tickets', module: 'TICKETS', permission: 'TICKETS_VER' },
        { label: 'Clientes', icon: 'bi bi-people', route: '/clientes/nuevo', module: 'CLIENTES', permission: 'CLIENTES_VER' },
        { label: 'Contratos', icon: 'bi bi-journal-text', route: '/contratos/nuevo', module: 'CONTRATOS', permission: 'CONTRATOS_VER' },
    ];

    auth = inject(AuthService);
    private router = inject(Router);

    constructor() {
        if (this.auth.isLoggedIn()) {
            this.auth.loadAccess().subscribe(); // refresca user/modules/perms
        }
    }

    visibleItems() {
        return this.items.filter(i => this.auth.can(i.module, i.permission));
    }

    toggleSidebar(): void {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    goToLogin(): void {
        this.router.navigate(['/login']);
    }

    logout(): void {
        Swal.fire({
            title: "¿Cerrar sesión?",
            text: "¿Estás seguro de que deseas cerrar sesión?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, cerrar sesión",
            cancelButtonText: "Cancelar",
            allowOutsideClick: false
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    icon: "success",
                    title: "Sesión cerrada",
                    text: "Has cerrado sesión correctamente.",
                    showConfirmButton: false,
                    timer: 1500
                });
                // Al cerrar sesión, lo mandamos a nuevo-ticket
                this.auth.logout();
                this.router.navigate(['/']);
            }
        });
    }

}
