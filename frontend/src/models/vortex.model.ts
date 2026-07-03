export interface CreateTicketRequest {
    // id_cliente solo lo manda el admin (elige empresa); para el resto lo
    // infiere el backend de la sesión.
    id_cliente?: number;
    id_servicio?: number | null;
    titulo: string;
    descripcion: string;
    tipo?: string | null;
    prioridad?: string | null;
}

export interface Ticket {
    id_ticket: number;
    id_cliente: number | null;
    id_servicio: number | null;
    titulo: string;
    descripcion: string;
    tipo: string | null;
    prioridad: string | null;
    estado: string;
    fecha_creacion: string;
    fecha_cierre: string | null;
    id_usuario_creador: number | null;
    id_agente_asignado: number | null;
    nombre_agente_asignado?: string | null;
    nombre_servicio?: string | null;
}

export interface Servicio {
    id_servicio: number;
    nombre: string;
    estado: string;
}

export type EstadoTicketAsignable = 'ENTREGADO' | 'EN_PROCESO' | 'CERRADO';

export type TipoMensajeTicket = 'RESPUESTA' | 'NOTA_INTERNA';

export interface TicketMensaje {
    id_mensaje: number;
    id_ticket: number;
    id_usuario_autor: number;
    nombre_autor: string;
    mensaje: string;
    tipo: TipoMensajeTicket;
    fecha_creacion: string;
}

export interface AgenteDisponible {
    id_usuario: number;
    nombre: string;
    correo: string;
}

/** Contexto para crear un ticket: la empresa y su catálogo de servicios propios
 *  (sin precio ni nivel de servicio — eso es solo de `contratos`, admin/negocio). */
export interface ContextoCreacionTicket {
    cliente: {
        id_cliente: number;
        nombre: string;
        nit: string | null;
        sector: string | null;
        fecha_inicio_relacion: string | null;
        estado: string;
    };
    servicios_activos: Servicio[];
}

export interface UsuarioFinal {
    id_usuario: number;
    nombre: string;
    correo: string;
    activo: boolean;
}

export interface CrearUsuarioFinalRequest {
    nombre: string;
    correo: string;
    password: string;
}

export interface AnalisisTicket {
    id_analisis: number;
    id_ticket: number;
    sentimiento: string | null;
    frustracion: string | null;
    score_churn: number | null;
    riesgo_churn: string | null;
    es_potencial_phishing: boolean | undefined;
    tiene_datos_sensibles: boolean;
    recomendaciones: string | null;
    fecha_analisis: string;
}

export interface CreateTicketResponse {
    ticket: Ticket;
    analisis: AnalisisTicket;
}

export type TicketWithAnalysis = CreateTicketResponse;

export interface TopCliente {
    id_cliente: number;
    nombre_cliente: string;
    total_tickets: number;
    promedio_score_churn: number;
    riesgo_predominante: string | null;
}

export interface RiesgoResumen {
    riesgo_churn: string | null;
    cantidad: number;
}

export interface SentimientoResumen {
    sentimiento: string | null;
    cantidad: number;
}

export interface EstadoResumen {
    estado: string | null;
    cantidad: number;
}

export interface PrioridadResumen {
    prioridad: string | null;
    cantidad: number;
}

export interface AlertasSeguridad {
    phishing: number;
    datos_sensibles: number;
}

export interface TicketsPorDia {
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
    top_clientes: TopCliente[];
    resumen_riesgo: RiesgoResumen[];
    total_tickets: number;
    total_clientes_con_tickets: number;
    churn_score_global: number;
    resumen_sentimiento: SentimientoResumen[];
    resumen_estado: EstadoResumen[];
    resumen_prioridad: PrioridadResumen[];
    alertas_seguridad: AlertasSeguridad;
    tickets_por_dia: TicketsPorDia[];
    /** Solo presente cuando contexto = 'ADMIN' */
    negocio?: NegocioResumen;
}

export interface ClienteResumen {
    cliente: {
        id_cliente: number;
        nombre: string;
        nit: string | null;
        sector: string | null;
        fecha_inicio_relacion: string | null;
        estado: string;
    };
    contratos: {
        id_contrato: number;
        nombre_proyecto: string;
        fecha_inicio: string | null;
        fecha_fin: string | null;
        estado: string;
        nivel_servicio: string | null;
    }[];
    resumen: {
        total_tickets: number;
        promedio_score_churn: number;
        riesgo_predominante: string | null;
        tickets_por_riesgo: { riesgo_churn: string | null; cantidad: number }[];
    };
    tickets_recientes: {
        id_ticket: number;
        titulo: string;
        nombre_servicio: string | null;
        descripcion: string;
        prioridad: string | null;
        estado: string;
        fecha_creacion: string;
        sentimiento: string | null;
        frustracion: string | null;
        score_churn: number | null;
        riesgo_churn: string | null;
        es_potencial_phishing: boolean;
        tiene_datos_sensibles: boolean;
    }[];
}

export interface Cliente {
    id_cliente: number;
    cantidad_contratos?: number;
    nombre: string;
    nit: string;
    sector: string | null;
    fecha_inicio_relacion: string;
    estado: string;
}

export interface Contrato {
    id_contrato: number;
    id_cliente: number;
    nombre_cliente?: string;
    nombre_proyecto: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    valor_mensual: string;
    estado: string;
    nivel_servicio: string | null;
}


export interface TicketDetalle {
    id_ticket: number;
    id_cliente: number | null;
    id_servicio: number | null;
    nombre_servicio: string | null;
    id_agente_asignado: number | null;
    nombre_agente_asignado: string | null;
    titulo: string;
    descripcion: string;
    tipo: string;
    prioridad: string;
    estado: string;
    fecha_creacion: string;
    fecha_cierre: string | null;
    id_analisis: number;
    sentimiento: string;
    frustracion: string;
    es_potencial_phishing: boolean;
    tiene_datos_sensibles: boolean;
    recomendaciones: string;
    fecha_analisis: string;
    score_churn: string;      // viene como '85.00'
    riesgo_churn: string;
}
