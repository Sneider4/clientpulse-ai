export interface CreateTicketDTO {
    id_cliente: number;
    id_servicio: number | null;
    titulo: string;
    descripcion: string;
    tipo?: string | null;
    prioridad?: string | null;
    id_usuario_creador: number | null;
}

export interface TicketRow {
    id_ticket: number;
    id_cliente: number | null;
    id_servicio: number | null;
    titulo: string;
    descripcion: string;
    tipo: string | null;
    prioridad: string | null;
    estado: string;
    fecha_creacion: Date;
    fecha_cierre: Date | null;
    id_usuario_creador: number | null;
    id_agente_asignado: number | null;
    nombre_agente_asignado?: string | null;
    nombre_servicio?: string | null;
}

export const ESTADOS_TICKET_ASIGNABLES = ['ENTREGADO', 'EN_PROCESO', 'CERRADO'] as const;
export type EstadoTicketAsignable = typeof ESTADOS_TICKET_ASIGNABLES[number];

export interface ListarTicketsFiltro {
    idCliente: number | null;
    idUsuarioCreador: number | null;
}

export interface AnalisisRow {
    id_analisis: number;
    id_ticket: number;
    sentimiento: string | null;
    frustracion: string | null;
    score_churn: number | null;
    riesgo_churn: string | null;
    es_potencial_phishing: boolean;
    tiene_datos_sensibles: boolean;
    recomendaciones: string | null;
    fecha_analisis: Date;
}

export interface TicketWithAnalysis {
    ticket: TicketRow;
    analisis: AnalisisRow | null;
}

export interface PreprocesamientoTextoResult {
    textoOriginal: string;
    textoAnonimizado: string;
    tieneDatosSensibles: boolean;
    esPhishingSospechoso: boolean;
}

export interface TicketContextoCreacion {
    cliente: {
        id_cliente: number;
        nombre: string;
        nit: string | null;
        sector: string | null;
        fecha_inicio_relacion: string | null;
        estado: string;
    };
    servicios_activos: {
        id_servicio: number;
        nombre: string;
        estado: string;
    }[];
}
