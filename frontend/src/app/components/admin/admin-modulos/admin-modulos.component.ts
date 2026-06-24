import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, ClienteBasico, ModuloAdmin } from '../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-admin-modulos',
    imports: [CommonModule],
    templateUrl: './admin-modulos.component.html',
    styles: ``
})
export class AdminModulosComponent implements OnInit {
    private admin = inject(AdminService);

    clientes: ClienteBasico[] = [];
    modulos: ModuloAdmin[]    = [];
    clienteId: number | null  = null;
    habilitados = new Set<number>();
    loading     = false;
    loadingGuardar = false;

    ngOnInit() {
        this.admin.getClientes().subscribe({ next: r => this.clientes = r.data });
    }

    seleccionarCliente(id: number) {
        this.clienteId = id;
        this.loading = true;
        this.admin.getModulosCliente(id).subscribe({
            next: r => {
                this.modulos = r.data;
                this.habilitados = new Set(r.data.filter((m: ModuloAdmin) => m.habilitado).map((m: ModuloAdmin) => m.id_modulo));
                this.loading = false;
            }
        });
    }

    toggleModulo(id: number) {
        if (this.habilitados.has(id)) this.habilitados.delete(id);
        else this.habilitados.add(id);
    }

    guardar() {
        if (!this.clienteId) return;
        this.loadingGuardar = true;
        this.admin.actualizarModulos(this.clienteId, [...this.habilitados]).subscribe({
            next: () => {
                this.loadingGuardar = false;
                Swal.fire({ icon: 'success', title: 'Módulos actualizados', timer: 1500, showConfirmButton: false });
            },
            error: e => {
                this.loadingGuardar = false;
                Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message });
            }
        });
    }

    clienteNombre() { return this.clientes.find(c => c.id_cliente === this.clienteId)?.nombre ?? ''; }
}
