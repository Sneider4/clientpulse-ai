import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, UsuarioAdmin, RolAdmin, ClienteBasico } from '../../../services/admin.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-admin-usuarios',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './admin-usuarios.component.html',
    styles: ``
})
export class AdminUsuariosComponent implements OnInit {
    private admin = inject(AdminService);
    private fb    = inject(FormBuilder);

    usuarios: UsuarioAdmin[] = [];
    roles: RolAdmin[]        = [];
    clientes: ClienteBasico[] = [];
    loading  = true;
    showForm = false;
    editId: number | null = null;

    form: FormGroup = this.fb.group({
        nombre:     ['', Validators.required],
        correo:     ['', [Validators.required, Validators.email]],
        password:   [''],
        id_rol:     [null, Validators.required],
        id_cliente: [null],
    });

    ngOnInit() { this.cargarTodo(); }

    cargarTodo() {
        this.loading = true;
        this.admin.getUsuarios().subscribe({ next: r => { this.usuarios = r.data; this.loading = false; } });
        this.admin.getRoles().subscribe({ next: r => this.roles = r.data });
        this.admin.getClientes().subscribe({ next: r => this.clientes = r.data });
    }

    abrirCrear() {
        this.editId = null;
        this.form.reset();
        this.form.get('password')!.setValidators(Validators.required);
        this.form.get('password')!.updateValueAndValidity();
        this.showForm = true;
    }

    abrirEditar(u: UsuarioAdmin) {
        this.editId = u.id_usuario;
        this.form.patchValue({ nombre: u.nombre, correo: u.correo, id_rol: u.id_rol, id_cliente: u.id_cliente, password: '' });
        this.form.get('password')!.clearValidators();
        this.form.get('password')!.updateValueAndValidity();
        this.showForm = true;
    }

    cancelar() { this.showForm = false; }

    guardar() {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        const { nombre, correo, password, id_rol, id_cliente } = this.form.value;
        const rolObj = this.roles.find(r => r.id_rol == id_rol);
        const payload = { nombre, correo, password, id_rol: Number(id_rol), id_cliente: id_cliente ? Number(id_cliente) : null, rol: rolObj?.codigo ?? '' };

        const obs = this.editId
            ? this.admin.actualizarUsuario(this.editId, payload)
            : this.admin.crearUsuario(payload);

        obs.subscribe({
            next: () => {
                Swal.fire({ icon: 'success', title: this.editId ? 'Usuario actualizado' : 'Usuario creado', timer: 1500, showConfirmButton: false });
                this.showForm = false;
                this.cargarTodo();
            },
            error: e => Swal.fire({ icon: 'error', title: 'Error', text: e.error?.message ?? 'Error inesperado' })
        });
    }

    toggle(u: UsuarioAdmin) {
        const accion = u.activo ? 'desactivar' : 'activar';
        Swal.fire({ title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.nombre}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Sí', cancelButtonText: 'No' })
            .then(r => {
                if (!r.isConfirmed) return;
                this.admin.toggleUsuario(u.id_usuario).subscribe({ next: () => this.cargarTodo() });
            });
    }

    hasError(field: string, error: string) {
        const c = this.form.get(field);
        return c?.touched && c?.hasError(error);
    }

    rolNombre(id: number) { return this.roles.find(r => r.id_rol === id)?.nombre ?? '-'; }
}
