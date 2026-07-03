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
        nombre_servicio: string | null;
    }[];
}

export interface Cliente {
    id_cliente?: number;
    nombre: string;
    nit: string;
    sector: string | null;
    fecha_inicio_relacion: string;
    estado: string;
}

export interface ContratoInput {
    id_cliente: number;
    nombre_proyecto: string;
    fecha_inicio: string;   // 'YYYY-MM-DD'
    fecha_fin?: string | null;
    valor_mensual: number;
    estado: string;         // 'ACTIVO', 'INACTIVO', etc.
    nivel_servicio?: string | null;
}

export interface Contrato {
    id_contrato: number;
    id_cliente: number;
    nombre_cliente?: string;
    nombre_proyecto: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    valor_mensual: string;  // PG numeric → viene como string
    estado: string;
    nivel_servicio: string | null;
}