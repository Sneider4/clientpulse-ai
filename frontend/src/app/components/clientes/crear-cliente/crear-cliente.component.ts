import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClienteService } from '../../../services/cliente.service';
import { Cliente } from '../../../../models/vortex.model';
import { catchError, Subscription, tap } from 'rxjs';
import moment from 'moment';
import { RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-crear-cliente',
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './crear-cliente.component.html',
    styleUrl: './crear-cliente.component.scss'
})
export class CrearClienteComponent {

    clientes: Cliente[] = [];
    booleanCrearContrato: boolean = false;

    private subscriptions: Subscription = new Subscription();

    private fb = inject(FormBuilder);
    private clienteService = inject(ClienteService);

    form: FormGroup = this.fb.group({
        nombre: ['', [Validators.required]],
        nit: ['', [Validators.required]],
        sector: [''],
        fecha_inicio_relacion: ['', [Validators.required]],
        estado: ['ACTIVO', [Validators.required]],
    });

    loading = false;
    errorMessage = '';
    clienteCreado: Cliente | null = null;

    ngOnInit() {
        this.cargarClientes();
    }

    hasError(controlName: string, error: string): boolean {
        const ctrl = this.form.get(controlName);
        return !!ctrl && ctrl.touched && ctrl.hasError(error);
    }

    crearCliente() {
        if (this.form.invalid) {
            Swal.fire({
                title: 'Formulario invalido',
                text: 'Complete los campos requeridos.',
                icon: 'error',
                iconColor: '#dc3545',
                confirmButtonColor: '#0d6efd',
                confirmButtonText: 'Aceptar',
                allowOutsideClick: false
            })
            this.form.markAllAsTouched();
            return;
        }

        this.loading = true;
        this.errorMessage = '';
        this.clienteCreado = null;
            const cliente = this.clienteService.crearCliente(this.form.value).pipe(
                tap((cliente) => {
                    this.clienteCreado = cliente;
                    this.loading = false;
                    Swal.fire({
                        title: 'Cliente creado',
                        text: 'Se ha creado exitosamente el cliente.',
                        icon: 'success',
                        iconColor: '#28a745',
                        confirmButtonColor: '#0d6efd',
                        confirmButtonText: 'Aceptar',
                        allowOutsideClick: false
                    })
                    this.form.reset();
                    this.cargarClientes();
                }),
                catchError((error) => {
                    this.errorMessage = error?.error?.message ||    'Ocurrió un error creando el cliente.';
                    this.loading = false;
                    throw error;
                }),
            ).subscribe();
            this.subscriptions.add(cliente);
    }

    cargarClientes(): void {
        const listaClientes = this.clienteService.listarClientes().pipe(
            tap((data) => {
                this.clientes = data
                console.log('Clientes cargados:', data);
            }),
            catchError((error) => {
                this.errorMessage = error?.error?.message ||
                    'No se pudieron cargar los clientes. Verifica la API /clientes.';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(listaClientes);
    }

    crearC(cancelar: boolean = false): void {
        if (cancelar) {
            this.form.reset();
            this.booleanCrearContrato = false;
        }
        else {
            this.booleanCrearContrato = true;
        }
    }

    formateadorFecha(fecha: string | null) {
        moment.locale('es');
        return moment(fecha).format('dddd, DD [de] MMMM YYYY');
    }
}
