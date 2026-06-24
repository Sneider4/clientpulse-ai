import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, RolAdmin, PermisoAdmin } from '../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-admin-roles',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './admin-roles.component.html',
    styles: ``
})
export class AdminRolesComponent implements OnInit {
    private admin = inject(AdminService);
    private fb    = inject(FormBuilder);

    roles: RolAdmin[]     = [];
    permisos: PermisoAdmin[] = [];
    modulosGrupo: { codigo: string; nombre: string; permisos: PermisoAdmin[] }[] = [];

    loading   = true;
    showForm  = false;
    editId: number | null = null;

    // Rol seleccionado para editar permisos
    rolSeleccionado: RolAdmin | null = null;
    permisosSeleccionados = new Set<number>();

    form: FormGroup = this.fb.group({
        codigo:      ['', Validators.required],
        nombre:      ['', Validators.required],
        descripcion: [''],
    });

    ngOnInit() { this.cargarTodo(); }

    cargarTodo() {
        this.loading = true;
        this.admin.getRoles().subscribe({ next: r => { this.roles = r.data; this.loading = false; } });
        this.admin.getPermisos().subscribe({ next: r => {
            this.permisos = r.data;
            // Agrupar por módulo
            const map = new Map<string, { codigo: string; nombre: string; permisos: PermisoAdmin[] }>();
            for (const p of r.data as PermisoAdmin[]) {
                if (!map.has(p.modulo_codigo)) {
                    map.set(p.modulo_codigo, { codigo: p.modulo_codigo, nombre: p.modulo_nombre, permisos: [] });
                }
                map.get(p.modulo_codigo)!.permisos.push(p);
            }
            this.modulosGrupo = [...map.values()];
        }});
    }

    abrirCrear() {
        this.editId = null;
        this.form.reset();
        this.form.get('codigo')!.enable();
        this.showForm = true;
        this.rolSeleccionado = null;
    }

    abrirEditar(r: RolAdmin) {
        this.editId = r.id_rol;
        this.form.patchValue({ codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion });
        this.form.get('codigo')!.disable();
        this.showForm = true;
        this.rolSeleccionado = null;
    }

    cancelar() { this.showForm = false; this.rolSeleccionado = null; }

    guardar() {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        const { nombre, descripcion, codigo } = this.form.getRawValue();
        const obs = this.editId
            ? this.admin.actualizarRol(this.editId, { nombre, descripcion })
            : this.admin.crearRol({ codigo, nombre, descripcion });

        obs.subscribe({
            next: () => {
                Swal.fire({ icon: 'success', title: this.editId ? 'Rol actualizado' : 'Rol creado', timer: 1500, showConfirmButton: false });
                this.showForm = false;
                this.cargarTodo();
            },
            error: e => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message ?? 'Error inesperado' })
        });
    }

    eliminar(r: RolAdmin) {
        Swal.fire({ title: `¿Eliminar rol "${r.nombre}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', confirmButtonColor: '#d33' })
            .then(res => {
                if (!res.isConfirmed) return;
                this.admin.eliminarRol(r.id_rol).subscribe({
                    next: () => { Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false }); this.cargarTodo(); },
                    error: e => Swal.fire({ icon: 'error', title: 'No se puede eliminar', text: e.error?.message })
                });
            });
    }

    // ── Gestión de permisos del rol ──────────────────────────────────────────
    abrirPermisos(r: RolAdmin) {
        this.rolSeleccionado = r;
        this.permisosSeleccionados = new Set(r.permisos.map(Number));
        this.showForm = false;
    }

    tienePermiso(id: number) { return this.permisosSeleccionados.has(id); }

    togglePermiso(id: number) {
        if (this.permisosSeleccionados.has(id)) this.permisosSeleccionados.delete(id);
        else this.permisosSeleccionados.add(id);
    }

    toggleModulo(mods: PermisoAdmin[], todos: boolean) {
        for (const p of mods) {
            if (todos) this.permisosSeleccionados.add(p.id_permiso);
            else this.permisosSeleccionados.delete(p.id_permiso);
        }
    }

    todosDelModulo(mods: PermisoAdmin[]) { return mods.every(p => this.permisosSeleccionados.has(p.id_permiso)); }

    guardarPermisos() {
        if (!this.rolSeleccionado) return;
        this.admin.actualizarPermisos(this.rolSeleccionado.id_rol, [...this.permisosSeleccionados]).subscribe({
            next: () => {
                Swal.fire({ icon: 'success', title: 'Permisos actualizados', timer: 1500, showConfirmButton: false });
                this.rolSeleccionado = null;
                this.cargarTodo();
            },
            error: e => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message })
        });
    }

    hasError(f: string, e: string) { const c = this.form.get(f); return c?.touched && c?.hasError(e); }
}
