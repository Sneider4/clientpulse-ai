// src/services/ticket.service.ts
//cSpell:disable
import { pool } from '../db/pool';
import { AnalisisIAResult } from '../models/ia.models';
import { AnalisisRow, CreateTicketDTO, TicketRow, TicketWithAnalysis, TicketContextoCreacion } from '../models/ticket.model';
import { analizarTextoTicketConIA } from './ia.service';
import { preprocesarTextoTicket } from '../utils/text-security.util';

export async function obtenerContextoCreacionTicketPorCliente(
    idCliente: number
): Promise<TicketContextoCreacion | null> {
    const clienteQuery = `
        SELECT
            id_cliente,
            nombre,
            nit,
            sector,
            fecha_inicio_relacion,
            estado
        FROM clientes
        WHERE id_cliente = $1
        LIMIT 1
    `;

    const clienteResult = await pool.query(clienteQuery, [idCliente]);

    if (clienteResult.rowCount === 0) {
        return null;
    }

    const c = clienteResult.rows[0];

    const cliente = {
        id_cliente: c.id_cliente,
        nombre: c.nombre,
        nit: c.nit,
        sector: c.sector,
        fecha_inicio_relacion: c.fecha_inicio_relacion,
        estado: c.estado
    };

    const contratosQuery = `
        SELECT
            id_contrato,
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            estado,
            nivel_servicio
        FROM contratos
        WHERE id_cliente = $1
          AND estado = 'VIGENTE'
        ORDER BY fecha_inicio DESC
    `;

    const contratosResult = await pool.query(contratosQuery, [idCliente]);

    const contratos_activos = contratosResult.rows.map((row: any) => ({
        id_contrato: row.id_contrato,
        nombre_proyecto: row.nombre_proyecto,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        estado: row.estado,
        nivel_servicio: row.nivel_servicio
    }));

    return {
        cliente,
        contratos_activos
    };
}

export async function obtenerContextoCreacionTicketPorNit(
    nit: string
): Promise<TicketContextoCreacion | null> {
    const clienteQuery = `
        SELECT
            id_cliente,
            nombre,
            nit,
            sector,
            fecha_inicio_relacion,
            estado
        FROM clientes
        WHERE nit = $1
        LIMIT 1
    `;

    const clienteResult = await pool.query(clienteQuery, [nit]);

    if (clienteResult.rowCount === 0) {
        return null;
    }

    const c = clienteResult.rows[0];

    const cliente = {
        id_cliente: c.id_cliente,
        nombre: c.nombre,
        nit: c.nit,
        sector: c.sector,
        fecha_inicio_relacion: c.fecha_inicio_relacion,
        estado: c.estado
    };

    const contratosQuery = `
        SELECT
            id_contrato,
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            estado,
            nivel_servicio
        FROM contratos
        WHERE id_cliente = $1
          AND estado = 'VIGENTE'
        ORDER BY fecha_inicio DESC
    `;

    const contratosResult = await pool.query(contratosQuery, [cliente.id_cliente]);

    const contratos_activos = contratosResult.rows.map((row: any) => ({
        id_contrato: row.id_contrato,
        nombre_proyecto: row.nombre_proyecto,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        estado: row.estado,
        nivel_servicio: row.nivel_servicio
    }));

    return {
        cliente,
        contratos_activos
    };
}

export async function validarContratoPerteneceACliente(
    idContrato: number,
    idCliente: number
): Promise<boolean> {
    const query = `
        SELECT 1
        FROM contratos
        WHERE id_contrato = $1
          AND id_cliente = $2
        LIMIT 1
    `;

    const result = await pool.query(query, [idContrato, idCliente]);
    return (result.rowCount ?? 0) > 0;
}


export async function obtenerDetalleTicket(idTicket: number): Promise<any | null> {
    const query = `
        SELECT
            t.id_ticket,
            t.id_contrato,
            t.titulo,
            t.descripcion,
            t.tipo,
            t.prioridad,
            t.estado,
            t.fecha_creacion,
            t.fecha_cierre,

            a.id_analisis,
            a.sentimiento,
            a.frustracion,
            a.es_potencial_phishing,
            a.tiene_datos_sensibles,
            a.recomendaciones,
            a.fecha_analisis,
            a.score_churn,
            a.riesgo_churn,
            
            c.nombre_proyecto as nombre_contrato,
            cli.nombre as nombre_cliente,
            cli.nit as nit_cliente

        FROM tickets t
        LEFT JOIN analisis_ticket a
        ON a.id_ticket = t.id_ticket
        LEFT JOIN contratos c
        ON t.id_contrato = c.id_contrato
        LEFT JOIN clientes cli
        ON c.id_cliente = cli.id_cliente
        WHERE t.id_ticket = $1;
    `;

    const result = await pool.query<any>(query, [idTicket]);
    console.log(result);
    return result.rows[0] ?? null;
}

export async function createTicketWithAnalysis(data: CreateTicketDTO): Promise<{
    ticket: TicketRow; analisis: AnalisisRow;
    contextoCliente: {
        nombre: string;
        fecha_inicio_relacion: Date;
        total_contratos: number;
    };
}> {
    const pre = preprocesarTextoTicket(data.descripcion);

    const estadoInicial = pre.esPhishingSospechoso
        ? 'BLOQUEADO_POR_SEGURIDAD'
        : 'ENTREGADO';

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const clienteInfoQuery = `
            SELECT
                c.id_cliente,
                cli.nombre,
                cli.fecha_inicio_relacion,
                (
                SELECT COUNT(*)
                FROM contratos c2
                WHERE c2.id_cliente = c.id_cliente
                ) AS total_contratos
            FROM contratos c
            INNER JOIN clientes cli ON cli.id_cliente = c.id_cliente
            WHERE c.id_contrato = $1
            LIMIT 1
        `;

        const clienteInfoResult = await client.query(clienteInfoQuery, [
            data.id_contrato
        ]);

        if (clienteInfoResult.rows.length === 0) {
            throw new Error(
                `No se encontró cliente asociado al contrato ${data.id_contrato}`
            );
        }

        const clienteRow = clienteInfoResult.rows[0] as {
            nombre: string;
            fecha_inicio_relacion: Date;
            total_contratos: number;
        };

        const contextoCliente = {
            nombre: clienteRow.nombre,
            fecha_inicio_relacion: clienteRow.fecha_inicio_relacion,
            total_contratos: Number(clienteRow.total_contratos)
        };

        const insertTicketQuery = `
            INSERT INTO tickets (
                id_contrato,
                titulo,
                descripcion,
                estado
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const ticketResult = await client.query<TicketRow>(insertTicketQuery, [
            data.id_contrato,
            data.titulo,
            data.descripcion,
            estadoInicial
        ]);

        const ticket = ticketResult.rows[0];

        let analisisIA: AnalisisIAResult;

        try {
            analisisIA = await analizarTextoTicketConIA(pre.textoAnonimizado, {
                nombre_cliente: contextoCliente.nombre,
                fecha_inicio_relacion: contextoCliente.fecha_inicio_relacion,
                total_contratos_cliente: contextoCliente.total_contratos
            });
            console.log('✅ Análisis IA completado para ticket ID:', contextoCliente);
        } catch (error) {
            console.error('||||||| Error llamando a Gemini, usando fallback local:', error);
            analisisIA = analizarTextoTicketFallback(pre.textoAnonimizado);
        }

        // 5. Combinar flags de seguridad locales con los de la IA
        analisisIA.tiene_datos_sensibles =
            analisisIA.tiene_datos_sensibles || pre.tieneDatosSensibles;

        analisisIA.es_potencial_phishing =
            analisisIA.es_potencial_phishing || pre.esPhishingSospechoso;

        // 6. Guardar análisis
        const insertAnalisisQuery = `
            INSERT INTO analisis_ticket (
                id_ticket,
                sentimiento,
                frustracion,
                score_churn,
                riesgo_churn,
                es_potencial_phishing,
                tiene_datos_sensibles,
                recomendaciones
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
        `;

        const analisisResult = await client.query<AnalisisRow>(
            insertAnalisisQuery,
            [
                ticket.id_ticket,
                analisisIA.sentimiento,
                analisisIA.frustracion,
                analisisIA.score_churn,
                analisisIA.riesgo_churn,
                analisisIA.es_potencial_phishing,
                analisisIA.tiene_datos_sensibles,
                analisisIA.recomendaciones
            ]
        );

        const analisisRow = analisisResult.rows[0];

        const updateTicketMetaQuery = `
            UPDATE tickets
            SET tipo = $1,
                prioridad = $2
            WHERE id_ticket = $3
            RETURNING *
        `;
        const updatedTicketResult = await client.query<TicketRow>(
            updateTicketMetaQuery,
            [analisisIA.tipo_ticket, analisisIA.prioridad_ticket, ticket.id_ticket]
        );

        const updatedTicket = updatedTicketResult.rows[0];

        await client.query('COMMIT');

        return {
            ticket: updatedTicket,
            analisis: analisisRow,
            contextoCliente
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en createTicketWithAnalysis:', error);
        throw error;
    } finally {
        client.release();
    }
}


export async function listTicketsWithAnalysis(): Promise<TicketWithAnalysis[]> {
    const query = `
        SELECT 
            t.id_ticket,
            t.id_contrato,
            t.titulo,
            t.descripcion,
            t.tipo,
            t.prioridad,
            t.estado,
            t.fecha_creacion,
            t.fecha_cierre,

            a.id_analisis,
            a.sentimiento,
            a.frustracion,
            a.score_churn,
            a.riesgo_churn,
            a.es_potencial_phishing,
            a.tiene_datos_sensibles,
            a.recomendaciones,
            a.fecha_analisis
        FROM tickets t
        LEFT JOIN analisis_ticket a ON a.id_ticket = t.id_ticket
        ORDER BY t.fecha_creacion DESC
    `;

    const result = await pool.query(query);

    const items: TicketWithAnalysis[] = result.rows.map((row: any) => {
        // 🔹 1. Enmascarar descripción ANTES de enviarla al frontend
        const pre = preprocesarTextoTicket(row.descripcion);

        const ticket: TicketRow = {
            id_ticket: row.id_ticket,
            id_contrato: row.id_contrato,
            titulo: row.titulo,
            // el frontend SIEMPRE recibe la versión anonimizadaa
            descripcion: pre.textoAnonimizado,
            tipo: row.tipo,
            prioridad: row.prioridad,
            estado: row.estado,
            fecha_creacion: row.fecha_creacion,
            fecha_cierre: row.fecha_cierre
        };

        let analisis: AnalisisRow | null = null;

        if (row.id_analisis) {
            analisis = {
                id_analisis: row.id_analisis,
                id_ticket: row.id_ticket,
                sentimiento: row.sentimiento,
                frustracion: row.frustracion,
                score_churn: row.score_churn,
                riesgo_churn: row.riesgo_churn,
                // combinamos lo de BD con lo que detecta el preprocesador
                es_potencial_phishing:
                    row.es_potencial_phishing || pre.esPhishingSospechoso,
                tiene_datos_sensibles:
                    row.tiene_datos_sensibles || pre.tieneDatosSensibles,
                recomendaciones: row.recomendaciones,
                fecha_analisis: row.fecha_analisis
            };
        }

        return { ticket, analisis };
    });

    return items;
}

function analizarTextoTicketFallback(descripcion: string): AnalisisIAResult {
    const texto = descripcion.toLowerCase();

    const palabrasNegativas = [
        'molesto',
        'inaceptable',
        'decepcionado',
        'indignado',
        'frustrado',
        'urgente',
        'crítico',
        'critica',
        'caído',
        'caido',
        'no funciona',
        'no ha funcionado',
        'sigue igual',
        'perdiendo dinero',
        'llevo esperando'
    ];

    const palabrasPositivas = [
        'gracias',
        'agradezco',
        'excelente',
        'muy buen',
        'funciona bien',
        'satisfecho',
        'satisfechos'
    ];

    let scorePositivo = 0;
    let scoreNegativo = 0;

    for (const p of palabrasPositivas) {
        if (texto.includes(p)) scorePositivo++;
    }
    for (const p of palabrasNegativas) {
        if (texto.includes(p)) scoreNegativo++;
    }

    let sentimiento: 'POSITIVO' | 'NEUTRO' | 'NEGATIVO' = 'NEUTRO';
    if (scoreNegativo > scorePositivo && scoreNegativo > 0) {
        sentimiento = 'NEGATIVO';
    } else if (scorePositivo > scoreNegativo && scorePositivo > 0) {
        sentimiento = 'POSITIVO';
    }

    let frustracion: 'BAJA' | 'MEDIA' | 'ALTA' = 'BAJA';
    if (sentimiento === 'NEGATIVO' && texto.includes('inaceptable')) {
        frustracion = 'ALTA';
    } else if (sentimiento === 'NEGATIVO') {
        frustracion = 'MEDIA';
    }

    const es_potencial_phishing =
        texto.includes('http://') ||
        texto.includes('https://') ||
        texto.includes('verificar cuenta') ||
        texto.includes('bloqueo de su cuenta');

    const tiene_datos_sensibles =
        texto.includes('usuario') ||
        texto.includes('contraseña') ||
        texto.includes('password') ||
        texto.includes('clave');

    let score_churn = 20;
    if (sentimiento === 'NEGATIVO') score_churn += 40;
    if (frustracion === 'MEDIA') score_churn += 20;
    if (frustracion === 'ALTA') score_churn += 35;
    if (es_potencial_phishing) score_churn += 5;
    if (tiene_datos_sensibles) score_churn += 5;
    if (score_churn > 100) score_churn = 100;

    let riesgo_churn: 'BAJO' | 'MEDIO' | 'ALTO' = 'BAJO';
    if (score_churn >= 70) riesgo_churn = 'ALTO';
    else if (score_churn >= 40) riesgo_churn = 'MEDIO';

    let prioridad_ticket: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'MEDIA';
    if (
        texto.includes('caído') ||
        texto.includes('caido') ||
        texto.includes('no funciona') ||
        texto.includes('perdiendo dinero')
    ) {
        prioridad_ticket = 'CRITICA';
    } else if (texto.includes('urgente')) {
        prioridad_ticket = 'ALTA';
    }

    let tipo_ticket: 'CORRECTIVO' | 'EVOLUTIVO' | 'OTRO' = 'CORRECTIVO';
    if (
        texto.includes('mejora') ||
        texto.includes('ajuste') ||
        texto.includes('nueva funcionalidad')
    ) {
        tipo_ticket = 'EVOLUTIVO';
    }

    let recomendaciones = 'Analizado con motor de reglas local (fallback). ';
    if (riesgo_churn === 'ALTO') {
        recomendaciones +=
            'Contactar al cliente en las próximas 24 horas y priorizar la resolución del incidente.';
    } else if (riesgo_churn === 'MEDIO') {
        recomendaciones +=
            'Hacer seguimiento al ticket y mantener informado al cliente del avance.';
    } else {
        recomendaciones +=
            'Mantener nivel de servicio actual y reforzar la comunicación positiva con el cliente.';
    }

    if (es_potencial_phishing) {
        recomendaciones += ' ⚠️ Posible caso de phishing, escalar a seguridad.';
    }
    if (tiene_datos_sensibles) {
        recomendaciones +=
            ' ⚠️ El ticket incluye posibles credenciales o datos sensibles, pedir al cliente que los elimine.';
    }

    return {
        sentimiento,
        frustracion,
        score_churn,
        riesgo_churn,
        es_potencial_phishing,
        tiene_datos_sensibles,
        tipo_ticket,
        prioridad_ticket,
        recomendaciones
    };
}
