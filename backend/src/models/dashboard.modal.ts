export interface TopClienteRow {
    id_cliente: number;
    nombre_cliente: string;
    total_tickets: number;
    promedio_score_churn: number;
    riesgo_predominante: string | null;
}

export interface RiesgoResumenRow {
    riesgo_churn: string | null;
    cantidad: number;
}

export interface SentimientoResumenRow {
    sentimiento: string | null; // 'POSITIVO' | 'NEUTRO' | 'NEGATIVO' | null
    cantidad: number;
}

export interface EstadoResumenRow {
    estado: string | null;
    cantidad: number;
}

export interface PrioridadResumenRow {
    prioridad: string | null; // 'ALTA' | 'MEDIA' | 'BAJA' | null
    cantidad: number;
}

export interface AlertasSeguridad {
    phishing: number;
    datos_sensibles: number;
}

export interface TicketsPorDiaRow {
    dia: string;
    cantidad: number;
}

export interface NegocioResumen {
    total_clientes: number;
    clientes_activos: number;
    contratos_activos: number;
    mrr_total: number;
    contratos_por_vencer: number;
}

export interface DashboardResumen {
    contexto: 'ADMIN' | 'CLIENTE';
    top_clientes: TopClienteRow[];
    resumen_riesgo: RiesgoResumenRow[];
    total_tickets: number;
    total_clientes_con_tickets: number;
    churn_score_global: number;
    resumen_sentimiento: SentimientoResumenRow[];
    resumen_estado: EstadoResumenRow[];
    resumen_prioridad: PrioridadResumenRow[];
    alertas_seguridad: AlertasSeguridad;
    tickets_por_dia: TicketsPorDiaRow[];
    /** Solo presente cuando contexto = 'ADMIN' */
    negocio?: NegocioResumen;
}