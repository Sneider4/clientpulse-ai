import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, Subscription, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { EquipoService } from '../../services/equipo.service';
import { ServicioService } from '../../services/servicio.service';
import { Servicio, UsuarioFinal } from '../../../models/vortex.model';

@Component({
    selector: 'app-equipo',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './equipo.component.html',
})
export class EquipoComponent implements OnInit {
    private fb = inject(FormBuilder);
    private equipoService = inject(EquipoService);
    private servicioService = inject(ServicioService);
    private subscriptions = new Subscription();

    usuarios: UsuarioFinal[] = [];
    loading = false;
    creando = false;
    errorMessage = '';

    servicios: Servicio[] = [];
    loadingServicios = false;
    creandoServicio = false;
    errorMessageServicios = '';

    form: FormGroup = this.fb.group({
        nombre: ['', [Validators.required]],
        correo: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(4)]],
    });

    formServicio: FormGroup = this.fb.group({
        nombre: ['', [Validators.required]],
    });

    ngOnInit(): void {
        this.cargarUsuarios();
        this.cargarServicios();
    }

    hasError(controlName: string, error: string): boolean {
        const ctrl = this.form.get(controlName);
        return !!ctrl && ctrl.touched && ctrl.hasError(error);
    }

    cargarUsuarios(): void {
        this.loading = true;
        this.errorMessage = '';
        const sub = this.equipoService.listarUsuariosFinales().pipe(
            tap((data) => {
                this.loading = false;
                this.usuarios = data;
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessage = error?.error?.message || 'No se pudieron cargar los usuarios finales.';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    invitarUsuario(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.creando = true;
        const sub = this.equipoService.crearUsuarioFinal(this.form.value).pipe(
            tap(() => {
                this.creando = false;
                Swal.fire({
                    title: 'Usuario invitado',
                    text: 'El usuario final ya puede iniciar sesión y crear sus propios tickets.',
                    icon: 'success',
                    confirmButtonText: 'Aceptar',
                });
                this.form.reset();
                this.cargarUsuarios();
            }),
            catchError((error) => {
                this.creando = false;
                Swal.fire({
                    title: 'No se pudo invitar',
                    text: error?.error?.message || 'Ocurrió un error al crear el usuario.',
                    icon: 'error',
                    confirmButtonText: 'Aceptar',
                });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    cargarServicios(): void {
        this.loadingServicios = true;
        this.errorMessageServicios = '';
        const sub = this.servicioService.listarServicios().pipe(
            tap((data) => {
                this.loadingServicios = false;
                this.servicios = data;
            }),
            catchError((error) => {
                this.loadingServicios = false;
                this.errorMessageServicios = error?.error?.message || 'No se pudieron cargar los servicios.';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    crearServicio(): void {
        if (this.formServicio.invalid) {
            this.formServicio.markAllAsTouched();
            return;
        }

        this.creandoServicio = true;
        const sub = this.servicioService.crearServicio(this.formServicio.value.nombre).pipe(
            tap(() => {
                this.creandoServicio = false;
                this.formServicio.reset();
                this.cargarServicios();
            }),
            catchError((error) => {
                this.creandoServicio = false;
                Swal.fire({
                    title: 'No se pudo crear el servicio',
                    text: error?.error?.message || 'Ocurrió un error.',
                    icon: 'error',
                    confirmButtonText: 'Aceptar',
                });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    toggleServicio(servicio: Servicio): void {
        const sub = this.servicioService.toggleServicio(servicio.id_servicio).pipe(
            tap(() => this.cargarServicios()),
            catchError((error) => {
                Swal.fire({
                    title: 'No se pudo actualizar',
                    text: error?.error?.message || 'Ocurrió un error.',
                    icon: 'error',
                    confirmButtonText: 'Aceptar',
                });
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }
}
