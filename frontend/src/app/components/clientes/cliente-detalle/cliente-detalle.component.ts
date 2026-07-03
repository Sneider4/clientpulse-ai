import { Component, inject, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ClienteService } from '../../../services/cliente.service';
import { ClienteResumen } from '../../../../models/vortex.model'
import moment from 'moment';
import 'moment/locale/es';
import { catchError, Subscription, tap } from 'rxjs';

@Component({
    selector: 'app-cliente-detalle',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './cliente-detalle.component.html',
    styleUrls: ['./cliente-detalle.component.scss']
})
export class ClienteDetalleComponent implements OnInit {

    clienteId!: number;
    data: ClienteResumen | null = null;
    loading = false;
    errorMessage = '';

    private subscriptions: Subscription = new Subscription();

    private route = inject(ActivatedRoute)
    private clienteService = inject(ClienteService)

    constructor() { }

    ngOnInit(): void {
        this.route.paramMap.subscribe((params) => {
            const id = Number(params.get('id'));
            if (!Number.isNaN(id)) {
                this.clienteId = id;
                this.cargarResumen();
            } else {
                this.errorMessage = 'ID de cliente inválido';
            }
        });
    }

    cargarResumen() {
        const resumen = this.clienteService.getResumen(this.clienteId).pipe(
            tap((data) => {
                this.loading = false;
                this.data = data;
                console.log(data);
            }),
            catchError((error) => {
                this.loading = false;
                console.error(error);
                this.errorMessage =
                    error?.error?.message || 'Error al cargar el detalle del cliente';
                throw error;
            }),
        ).subscribe();
        this.subscriptions.add(resumen);
    }

    getCantidadPorRiesgo(riesgo: string): number {
        if (!this.data) return 0;
        const item = this.data.resumen.tickets_por_riesgo.find(
            (r) => (r.riesgo_churn || 'N/D') === riesgo
        );
        return item ? item.cantidad : 0;
    }

    formateadorFecha(fecha: string | null) {
        if (!fecha) return '-';
        moment.locale('es');
        return moment(fecha).format('dddd, DD [de] MMMM YYYY');
    }

    goBack(): void {
        // si prefieres Router, lo cambias por router.navigate...
        window.history.back();
    }

}
