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
import { AuthService } from '../../../services/auth/auth.service';
import {
    DashboardResumen,
    RiesgoResumen,
    SentimientoResumen,
} from '../../../../models/vortex.model';

import { Chart, ChartConfiguration } from 'chart.js/auto';

// Chart.js no puede leer var(--vx-*) directamente en el canvas, así que estos hex
// deben mantenerse sincronizados a mano con la paleta definida en :root de styles.scss.
// Colores de marca (azul marino) — para series neutrales/secuenciales, no de riesgo.
const VX_NAVY_1 = '#b3cfe5'; // claro
const VX_NAVY_2 = '#4a7fa7'; // medio (= --vx-sage)
const VX_NAVY_3 = '#1a3d63'; // oscuro (= --vx-sage-dark)
const VX_NAVY_4 = '#0a1931'; // muy oscuro (= --vx-sage-darker)
const VX_MUTED = '#5c6b7d';  // = --vx-muted
const VX_GRID = '#e3e8ee';   // = --vx-grid

// Rojo reservado solo para alertas de seguridad reales (no para severidad ordinal):
// bloqueo por seguridad y phishing/datos sensibles, para que nunca se confundan
// con un nivel más de la rampa de riesgo/prioridad.
const VX_CRIT = '#c0563f';
const VX_ND = '#a8a296';

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = VX_MUTED;
Chart.defaults.borderColor = VX_GRID;

const ESTADO_LABELS: Record<string, string> = {
    ENTREGADO: 'Entregado',
    EN_PROCESO: 'En proceso',
    CERRADO: 'Cerrado',
    BLOQUEADO_POR_SEGURIDAD: 'Bloqueado',
};

// Rampa secuencial azul (más progreso = más oscuro); el bloqueo por seguridad
// es una alerta real, no un estado de flujo, así que se queda en rojo para destacar.
const ESTADO_COLORS: Record<string, string> = {
    ENTREGADO: VX_NAVY_1,
    EN_PROCESO: VX_NAVY_2,
    CERRADO: VX_NAVY_4,
    BLOQUEADO_POR_SEGURIDAD: VX_CRIT,
};

const PRIORIDAD_LABELS: Record<string, string> = {
    CRITICA: 'Crítica',
    ALTA: 'Alta',
    MEDIA: 'Media',
    BAJA: 'Baja',
};

const PRIORIDAD_COLORS: Record<string, string> = {
    BAJA: VX_NAVY_1,
    MEDIA: VX_NAVY_2,
    ALTA: VX_NAVY_3,
    CRITICA: VX_NAVY_4,
};

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
    auth = inject(AuthService);

    @ViewChild('riesgoChart') riesgoChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('satisfaccionChart') satisfaccionChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('estadoChart') estadoChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('prioridadChart') prioridadChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('tendenciaChart') tendenciaChartRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('topClientesChart') topClientesChartRef!: ElementRef<HTMLCanvasElement>;

    private riesgoChart?: Chart;
    private satisfaccionChart?: Chart;
    private estadoChart?: Chart;
    private prioridadChart?: Chart;
    private tendenciaChart?: Chart;
    private topClientesChart?: Chart;

    constructor() { }

    // ---------------- Ciclo de vida ----------------

    ngOnInit(): void {
        this.cargarResumen();
    }

    ngAfterViewInit(): void {
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

    // ---------------- Hero de bienvenida ----------------

    get userName(): string {
        const user = this.auth.currentUser();
        return user?.nombre?.split(' ')[0] || user?.correo || 'usuario';
    }

    get saludo(): string {
        const hora = new Date().getHours();
        if (hora < 12) return 'Buenos días';
        if (hora < 19) return 'Buenas tardes';
        return 'Buenas noches';
    }

    get todayLabel(): string {
        const label = new Date().toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    get heroSubtitle(): string {
        return this.auth.isAdmin()
            ? 'Este es el resumen de tu operación: clientes, contratos y riesgo de churn.'
            : 'Este es el resumen de soporte y riesgo de churn de tus tickets.';
    }

    // ---------------- Auxiliares: estado / prioridad / seguridad ----------------

    getEstadoLabel(estado: string | null): string {
        return ESTADO_LABELS[estado || ''] || estado || 'N/D';
    }

    getPrioridadLabel(prioridad: string | null): string {
        return PRIORIDAD_LABELS[prioridad || ''] || prioridad || 'N/D';
    }

    get totalAlertasSeguridad(): number {
        if (!this.data) return 0;
        return this.data.alertas_seguridad.phishing + this.data.alertas_seguridad.datos_sensibles;
    }

    get ticketsAbiertos(): number {
        if (!this.data) return 0;
        return this.data.resumen_estado
            .filter((e) => e.estado !== 'CERRADO')
            .reduce((acc, e) => acc + e.cantidad, 0);
    }

    formatCOP(valor: number): string {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
        }).format(valor);
    }

    // ---------------- Gráficas: Chart.js ----------------

    private buildCharts(): void {
        if (!this.data) return;

        // Cada gráfica se construye de forma independiente: "Top clientes" solo
        // existe en el DOM para el contexto ADMIN, así que su canvas nunca está
        // presente en el dashboard de un cliente. Antes, un único guard que exigía
        // las 6 referencias a la vez cancelaba TODAS las gráficas en ese caso.
        this.destroyCharts();
        if (this.riesgoChartRef) this.buildRiesgoChart();
        if (this.satisfaccionChartRef) this.buildSatisfaccionChart();
        if (this.estadoChartRef) this.buildEstadoChart();
        if (this.prioridadChartRef) this.buildPrioridadChart();
        if (this.tendenciaChartRef) this.buildTendenciaChart();
        if (this.topClientesChartRef) this.buildTopClientesChart();
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
                        backgroundColor: [VX_NAVY_3, VX_NAVY_2, VX_NAVY_1, VX_ND],
                        borderColor: '#fff',
                        borderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, boxHeight: 10, padding: 14 },
                    },
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
                        backgroundColor: [VX_NAVY_1, VX_NAVY_2, VX_NAVY_3],
                        borderRadius: 6,
                        maxBarThickness: 48,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: VX_GRID },
                    },
                    x: { grid: { display: false } },
                },
                plugins: {
                    legend: { display: false },
                },
            },
        };

        this.satisfaccionChart = new Chart(ctx, config);
    }

    private buildEstadoChart(): void {
        const ctx = this.estadoChartRef.nativeElement.getContext('2d');
        if (!ctx || !this.data) return;

        const filas = this.data.resumen_estado;
        const labels = filas.map((f) => this.getEstadoLabel(f.estado));
        const valores = filas.map((f) => f.cantidad);
        const colores = filas.map((f) => ESTADO_COLORS[f.estado || ''] || VX_ND);

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Tickets por estado',
                        data: valores,
                        backgroundColor: colores,
                        borderRadius: 6,
                        maxBarThickness: 48,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: VX_GRID },
                    },
                    x: { grid: { display: false } },
                },
                plugins: {
                    legend: { display: false },
                },
            },
        };

        this.estadoChart = new Chart(ctx, config);
    }

    private buildPrioridadChart(): void {
        const ctx = this.prioridadChartRef.nativeElement.getContext('2d');
        if (!ctx || !this.data) return;

        const filas = this.data.resumen_prioridad;
        const labels = filas.map((f) => this.getPrioridadLabel(f.prioridad));
        const valores = filas.map((f) => f.cantidad);
        const colores = filas.map((f) => PRIORIDAD_COLORS[f.prioridad || ''] || VX_ND);

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Tickets por prioridad',
                        data: valores,
                        backgroundColor: colores,
                        borderRadius: 6,
                        maxBarThickness: 48,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: VX_GRID },
                    },
                    x: { grid: { display: false } },
                },
                plugins: {
                    legend: { display: false },
                },
            },
        };

        this.prioridadChart = new Chart(ctx, config);
    }

    private buildTendenciaChart(): void {
        const ctx = this.tendenciaChartRef.nativeElement.getContext('2d');
        if (!ctx || !this.data) return;

        const filas = this.data.tickets_por_dia;
        const labels = filas.map((f) =>
            new Date(f.dia).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        );
        const valores = filas.map((f) => f.cantidad);

        const config: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Tickets creados',
                        data: valores,
                        borderColor: VX_NAVY_2,
                        backgroundColor: 'rgba(74, 127, 167, 0.15)',
                        pointBackgroundColor: VX_NAVY_2,
                        pointRadius: 4,
                        tension: 0.35,
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: VX_GRID },
                    },
                    x: { grid: { display: false } },
                },
                plugins: {
                    legend: { display: false },
                },
            },
        };

        this.tendenciaChart = new Chart(ctx, config);
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
                        backgroundColor: VX_NAVY_3,
                        borderRadius: 6,
                        maxBarThickness: 28,
                    },
                ],
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { stepSize: 20 },
                        grid: { color: VX_GRID },
                        title: {
                            display: true,
                            text: 'Score promedio de churn',
                        },
                    },
                    y: {
                        grid: { display: false },
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
        this.riesgoChart?.destroy();
        this.riesgoChart = undefined;
        this.satisfaccionChart?.destroy();
        this.satisfaccionChart = undefined;
        this.estadoChart?.destroy();
        this.estadoChart = undefined;
        this.prioridadChart?.destroy();
        this.prioridadChart = undefined;
        this.tendenciaChart?.destroy();
        this.tendenciaChart = undefined;
        this.topClientesChart?.destroy();
        this.topClientesChart = undefined;
    }
}
