import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketService } from '../../../services/ticket.service';
import { ClienteService } from '../../../services/cliente.service';
import { AuthService } from '../../../services/auth/auth.service';
import { Cliente, ContextoCreacionTicket, CreateTicketResponse, Servicio } from '../../../../models/vortex.model';
import { catchError, Subscription, tap } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-nuevo-ticket',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './nuevo-ticket.component.html',
    styleUrls: ['./nuevo-ticket.component.scss']
})
export class NuevoTicketComponent implements OnInit {
    form: FormGroup;
    loading = false;
    errorMessage = '';
    errorMessageTicket = '';
    resultado: CreateTicketResponse | null = null;

    clienteSeleccionado: ContextoCreacionTicket['cliente'] | null = null;
    serviciosActivos: Servicio[] = [];
    clientesDisponibles: Cliente[] = [];

    private auth = inject(AuthService);
    private ticketService = inject(TicketService);
    private clienteService = inject(ClienteService);
    private subscriptions: Subscription = new Subscription();

    /**
     * El admin no tiene una empresa fija, así que elige primero a qué cliente
     * pertenece el ticket (de la lista que ya administra), en vez de buscar
     * por NIT — eso exponía contratos de cualquier empresa sin restricción.
     */
    get esAdmin(): boolean {
        return this.auth.isAdmin();
    }

    constructor(private fb: FormBuilder) {
        this.form = this.fb.group({
            id_cliente: [null],
            id_servicio: [null],
            titulo: ['', [Validators.required, Validators.maxLength(200)]],
            descripcion: ['', [Validators.required]]
        });
    }

    ngOnInit(): void {
        if (this.esAdmin) {
            this.cargarClientesDisponibles();
        } else {
            this.cargarContextoPropio();
        }
    }

    private cargarClientesDisponibles(): void {
        this.loading = true;
        const sub = this.clienteService.listarClientes().pipe(
            tap((clientes) => {
                this.loading = false;
                this.clientesDisponibles = clientes;
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessage = error?.error?.message || 'No se pudo cargar la lista de clientes';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    onClienteSeleccionado(idCliente: string): void {
        this.clienteSeleccionado = null;
        this.serviciosActivos = [];
        this.form.patchValue({ id_cliente: idCliente || null, id_servicio: null });

        if (!idCliente) return;

        this.loading = true;
        const sub = this.ticketService.getContextoCreacion(Number(idCliente)).pipe(
            tap((data) => {
                this.loading = false;
                this.clienteSeleccionado = data.cliente;
                this.serviciosActivos = data.servicios_activos || [];
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessage = error?.error?.message || 'No se pudo cargar el contexto de ese cliente';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    private cargarContextoPropio(): void {
        this.loading = true;
        const sub = this.ticketService.getContextoCreacion().pipe(
            tap((data) => {
                this.loading = false;
                this.clienteSeleccionado = data.cliente;
                this.serviciosActivos = data.servicios_activos || [];
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessage = error?.error?.message || 'No se pudo cargar tu información';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(sub);
    }

    enviarTicket() {
        this.errorMessage = '';
        this.resultado = null;

        if (this.form.invalid || (this.esAdmin && !this.form.value.id_cliente)) {
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

        const dataTicket: any = {
            id_servicio: this.form.value.id_servicio || null,
            titulo: this.form.value.titulo,
            descripcion: this.form.value.descripcion
        };
        if (this.esAdmin) {
            dataTicket.id_cliente = Number(this.form.value.id_cliente);
        }

        const crearTicket = this.ticketService.crearTicket(dataTicket).pipe(
            tap((resp) => {
                this.loading = false;
                this.resultado = resp;
                Swal.fire({ icon: 'success', title: 'Ticket creado con exito', text: 'se ha generado con exito el ticket. Pronto nos pondremos en contacto.', iconColor: '#28a745', confirmButtonColor: '#0d6efd', confirmButtonText: 'Aceptar', allowOutsideClick: false })
            }),
            catchError((error) => {
                this.loading = false;
                this.errorMessageTicket =
                    error?.error?.message || 'Ocurrió un error al crear el ticket';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(crearTicket);
    }

    hasError(controlName: string, error: string): boolean {
        const control = this.form.get(controlName);
        return !!control && control.touched && control.hasError(error);
    }
}
