import {
    AfterViewInit,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, Subscription, tap } from 'rxjs';

import { DashboardService } from '../../../services/dashboard.service';
import {
    DashboardResumen,
    RiesgoResumen,
    SentimientoResumen,
} from '../../../../models/vortex.model';

import { Chart, ChartConfiguration } from 'chart.js/auto';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
    data: DashboardResumen | null = null;
    loading = false;
    errorMessage = '';

    private subscriptions = new Subscription();
    private dashboardService = inject(DashboardService);

    // Ya no vamos a usar flag de viewInitialized, solo nos aseguramos
    // de que existan los canvas antes de crear los charts.

    @ViewChild('riesgoChart') riesgoChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('satisfaccionChart')
    satisfaccionChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topClientesChart')
    topClientesChartRef!: ElementRef<HTMLCanvasElement>;

    private riesgoChart?: Chart;
    private satisfaccionChart?: Chart;
    private topClientesChart?: Chart;

    constructor() { }

    // ---------------- Ciclo de vida ----------------

    ngOnInit(): void {
        this.cargarResumen();
    }

    ngAfterViewInit(): void {
        // Si la data ya llegó antes de que el view se montara, intenta dibujar
        this.buildCharts();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        this.destroyCharts();
    }

    // ---------------- Carga de datos ----------------

    cargarResumen(): void {
        this.loading = true;
        this.errorMessage = '';

        const resumenSub = this.dashboardService
            .getResumen()
            .pipe(
                tap((data) => {
                    this.loading = false;
                    this.data = data;
                    console.log("🚀 ~ DashboardComponent ~ cargarResumen ~ data:", data)

                    // IMPORTANTE:
                    // Esperamos al siguiente "tick" para que Angular pinte los canvas
                    setTimeout(() => {
                        this.buildCharts();
                    });
                }),
                catchError((error) => {
                    this.loading = false;
                    console.error(error);
                    this.errorMessage =
                        error?.error?.message || 'Error al cargar el dashboard';
                    throw error;
                })
            )
            .subscribe();

        this.subscriptions.add(resumenSub);
    }

    // ---------------- Auxiliares: riesgo ----------------

    getCantidadPorRiesgo(riesgo: string): number {
        if (!this.data) return 0;
        const item = this.data.resumen_riesgo.find(
            (r: RiesgoResumen) => (r.riesgo_churn || 'N/D') === riesgo
        );
        return item ? item.cantidad : 0;
    }

    private getTotalRiesgo(): number {
        if (!this.data) return 0;
        return this.data.resumen_riesgo.reduce((acc, r) => acc + r.cantidad, 0);
    }

    // ---------------- Auxiliares: sentimiento ----------------

    private getSentimientoCantidad(sentimiento: string): number {
        if (!this.data) return 0;
        const item = this.data.resumen_sentimiento.find(
            (s: SentimientoResumen) => (s.sentimiento || 'N/D') === sentimiento
        );
        return item ? item.cantidad : 0;
    }

    get porcentajePositivo(): number {
        const pos = this.getSentimientoCantidad('POSITIVO');
        const neu = this.getSentimientoCantidad('NEUTRO');
        const neg = this.getSentimientoCantidad('NEGATIVO');
        const total = pos + neu + neg || 1;
        return Math.round((pos / total) * 100);
    }

    get porcentajeNeutro(): number {
        const pos = this.getSentimientoCantidad('POSITIVO');
        const neu = this.getSentimientoCantidad('NEUTRO');
        const neg = this.getSentimientoCantidad('NEGATIVO');
        const total = pos + neu + neg || 1;
        return Math.round((neu / total) * 100);
    }

    get porcentajeNegativo(): number {
        const pos = this.getSentimientoCantidad('POSITIVO');
        const neu = this.getSentimientoCantidad('NEUTRO');
        const neg = this.getSentimientoCantidad('NEGATIVO');
        const total = pos + neu + neg || 1;
        return Math.round((neg / total) * 100);
    }

    // ---------------- Auxiliares: churn global ----------------

    get churnScoreGlobal(): number {
        return this.data?.churn_score_global
            ? Math.round(this.data.churn_score_global)
            : 0;
    }

    get churnScoreNivel(): 'BAJO' | 'MEDIO' | 'ALTO' {
        const score = this.churnScoreGlobal;
        if (score < 30) return 'BAJO';
        if (score < 60) return 'MEDIO';
        return 'ALTO';
    }

    get churnScoreBadgeClass(): string {
        const nivel = this.churnScoreNivel;
        switch (nivel) {
            case 'BAJO':
                return 'text-bg-success';
            case 'MEDIO':
                return 'text-bg-warning text-dark';
            case 'ALTO':
            default:
                return 'text-bg-danger';
        }
    }

    // ---------------- Gráficas: Chart.js ----------------

    private buildCharts(): void {
        // si no hay data todavía, no hacemos nada
        if (!this.data) return;

        // si los canvas aún no existen en el DOM (por el @if), esperamos
        if (
            !this.riesgoChartRef ||
            !this.satisfaccionChartRef ||
            !this.topClientesChartRef
        ) {
            return;
        }

        this.destroyCharts();
        this.buildRiesgoChart();
        this.buildSatisfaccionChart();
        this.buildTopClientesChart();
    }

    private buildRiesgoChart(): void {
        const ctx = this.riesgoChartRef.nativeElement.getContext('2d');
        if (!ctx) return;

        const alto = this.getCantidadPorRiesgo('ALTO');
        const medio = this.getCantidadPorRiesgo('MEDIO');
        const bajo = this.getCantidadPorRiesgo('BAJO');
        const nd = this.getCantidadPorRiesgo('N/D');
        const total = alto + medio + bajo + nd || 1;

        const config: ChartConfiguration<'doughnut'> = {
            type: 'doughnut',
            data: {
                labels: ['Alto', 'Medio', 'Bajo', 'N/D'],
                datasets: [
                    {
                        data: [alto, medio, bajo, nd],
                        backgroundColor: ['#dc3545', '#ffc107', '#198754', '#6c757d'],
                    },
                ],
            },
            options: {
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const value = ctx.raw as number;
                                const pct = Math.round((value / total) * 100);
                                return `${ctx.label}: ${value} tickets (${pct}%)`;
                            },
                        },
                    },
                },
            },
        };

        this.riesgoChart = new Chart(ctx, config);
    }

    private buildSatisfaccionChart(): void {
        const ctx = this.satisfaccionChartRef.nativeElement.getContext('2d');
        if (!ctx) return;

        const pos = this.getSentimientoCantidad('POSITIVO');
        const neu = this.getSentimientoCantidad('NEUTRO');
        const neg = this.getSentimientoCantidad('NEGATIVO');

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels: ['Positivo', 'Neutro', 'Negativo'],
                datasets: [
                    {
                        label: 'Tickets por sentimiento',
                        data: [pos, neu, neg],
                        backgroundColor: ['#198754', '#ffc107', '#dc3545'],
                    },
                ],
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                    },
                },
                plugins: {
                    legend: { display: false },
                },
            },
        };

        this.satisfaccionChart = new Chart(ctx, config);
    }

    private buildTopClientesChart(): void {
        const ctx = this.topClientesChartRef.nativeElement.getContext('2d');
        if (!ctx || !this.data) return;

        const clientes = this.data.top_clientes || [];
        const labels = clientes.map((c) => c.nombre_cliente);
        const scores = clientes.map((c) => c.promedio_score_churn);

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Score promedio churn (0-100)',
                        data: scores,
                        backgroundColor: '#dc3545',
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20 },
                        title: {
                            display: true,
                            text: 'Score promedio de churn',
                        },
                    },
                    y: {
                        title: { display: false },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const score = ctx.raw as number;
                                let nivel = 'Bajo';
                                if (score >= 60) nivel = 'Alto';
                                else if (score >= 30) nivel = 'Medio';
                                return `${ctx.label}: ${score.toFixed(
                                    1
                                )} / 100 (Riesgo ${nivel})`;
                            },
                        },
                    },
                },
            },
        };

        this.topClientesChart = new Chart(ctx, config);
    }

    private destroyCharts(): void {
        if (this.riesgoChart) {
            this.riesgoChart.destroy();
            this.riesgoChart = undefined;
        }
        if (this.satisfaccionChart) {
            this.satisfaccionChart.destroy();
            this.satisfaccionChart = undefined;
        }
        if (this.topClientesChart) {
            this.topClientesChart.destroy();
            this.topClientesChart = undefined;
        }
    }
}
