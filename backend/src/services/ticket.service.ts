// src/services/ticket.service.ts
//cSpell:disable
import { pool } from '../db/pool';
import { AnalisisIAResult } from '../models/ia.models';
import { AnalisisRow, CreateTicketDTO, TicketRow, TicketWithAnalysis, TicketContextoCreacion, ListarTicketsFiltro, ESTADOS_TICKET_ASIGNABLES, EstadoTicketAsignable } from '../models/ticket.model';
import { analizarTextoTicketConIA } from './ia.service';
import { preprocesarTextoTicket } from '../utils/text-security.util';
import { userHasPermission } from '../middlewares/requirePermission';
import { JwtUser } from '../middlewares/authJwt';

/**
 * Scoping compartido: ¿puede este usuario ver este ticket? Admin ve todo;
 * un usuario de empresa solo ve tickets de su propia empresa, y si no tiene
 * TICKETS_VER_TODOS, únicamente los que él mismo creó. Reutilizado por
 * getDetalleTicketHandler y por el hilo de mensajes (mensaje.controller.ts).
 */
export async function puedeVerTicket(
    user: JwtUser,
    ticketData: { id_cliente: number | null; id_usuario_creador: number | null }
): Promise<boolean> {
    if (user.id_cliente === null) return true; // admin global
    if (ticketData.id_cliente !== user.id_cliente) return false;
    const puedeVerTodos = await userHasPermission(user, 'TICKETS_VER_TODOS');
    if (puedeVerTodos) return true;
    return ticketData.id_usuario_creador === user.id_usuario;
}

/**
 * Contexto para crear un ticket: datos del cliente (empresa) y su catálogo de
 * servicios propios. Deliberadamente NO incluye nada de `contratos` (precio,
 * nivel de servicio) — eso es la relación comercial ClientPulse↔Cliente y
 * nunca debe llegar a quien presenta el ticket (personal de la empresa o su
 * usuario final).
 */
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

    const serviciosQuery = `
        SELECT id_servicio, nombre, estado
        FROM servicios
        WHERE id_cliente = $1
          AND estado = 'ACTIVO'
        ORDER BY nombre
    `;

    const serviciosResult = await pool.query(serviciosQuery, [idCliente]);

    const servicios_activos = serviciosResult.rows.map((row: any) => ({
        id_servicio: row.id_servicio,
        nombre: row.nombre,
        estado: row.estado
    }));

    return {
        cliente,
        servicios_activos
    };
}

export async function validarServicioPerteneceACliente(
    idServicio: number,
    idCliente: number
): Promise<boolean> {
    const query = `
        SELECT 1
        FROM servicios
        WHERE id_servicio = $1
          AND id_cliente = $2
        LIMIT 1
    `;

    const result = await pool.query(query, [idServicio, idCliente]);
    return (result.rowCount ?? 0) > 0;
}

export async function obtenerDetalleTicket(idTicket: number): Promise<any | null> {
    const query = `
        SELECT
            t.id_ticket,
            t.id_cliente,
            t.id_servicio,
            t.titulo,
            t.descripcion,
            t.tipo,
            t.prioridad,
            t.estado,
            t.fecha_creacion,
            t.fecha_cierre,
            t.id_usuario_creador,
            t.id_agente_asignado,

            a.id_analisis,
            a.sentimiento,
            a.frustracion,
            a.es_potencial_phishing,
            a.tiene_datos_sensibles,
            a.recomendaciones,
            a.fecha_analisis,
            a.score_churn,
            a.riesgo_churn,

            s.nombre as nombre_servicio,
            cli.nombre as nombre_cliente,
            cli.nit as nit_cliente,
            ag.nombre as nombre_agente_asignado

        FROM tickets t
        LEFT JOIN analisis_ticket a
        ON a.id_ticket = t.id_ticket
        LEFT JOIN servicios s
        ON t.id_servicio = s.id_servicio
        LEFT JOIN clientes cli
        ON t.id_cliente = cli.id_cliente
        LEFT JOIN usuarios ag
        ON t.id_agente_asignado = ag.id_usuario
        WHERE t.id_ticket = $1;
    `;

    const result = await pool.query<any>(query, [idTicket]);
    return result.rows[0] ?? null;
}

/**
 * Agentes/supervisores activos de una empresa, para poblar el selector de
 * "asignar a" — mismo molde que listarUsuariosFinalesPorCliente en admin.service.ts.
 */
export async function listarAgentesPorCliente(idCliente: number) {
    const { rows } = await pool.query(`
        SELECT u.id_usuario, u.nombre, u.correo
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_cliente = $1
          AND r.codigo IN ('AGENTE', 'SUPERVISOR')
          AND u.activo = TRUE
        ORDER BY u.nombre
    `, [idCliente]);
    return rows;
}

async function validarTicketPerteneceACliente(idTicket: number, idCliente: number): Promise<boolean> {
    const { rowCount } = await pool.query(
        `SELECT 1 FROM tickets WHERE id_ticket = $1 AND id_cliente = $2 LIMIT 1`,
        [idTicket, idCliente]
    );
    return (rowCount ?? 0) > 0;
}

export async function asignarTicket(idTicket: number, idAgente: number, idClienteContexto: number): Promise<TicketRow> {
    const ticketValido = await validarTicketPerteneceACliente(idTicket, idClienteContexto);
    if (!ticketValido) {
        throw new Error('El ticket no pertenece a esa empresa');
    }

    const { rows: agenteRows } = await pool.query(
        `SELECT 1 FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = $1 AND u.id_cliente = $2 AND r.codigo IN ('AGENTE','SUPERVISOR') LIMIT 1`,
        [idAgente, idClienteContexto]
    );
    if (agenteRows.length === 0) {
        throw new Error('El agente indicado no pertenece a esa empresa');
    }

    const { rows } = await pool.query<TicketRow>(
        `UPDATE tickets SET id_agente_asignado = $1 WHERE id_ticket = $2 RETURNING *`,
        [idAgente, idTicket]
    );
    return rows[0];
}

export async function actualizarEstadoTicket(
    idTicket: number,
    nuevoEstado: EstadoTicketAsignable,
    idClienteContexto: number
): Promise<TicketRow> {
    if (!ESTADOS_TICKET_ASIGNABLES.includes(nuevoEstado)) {
        // BLOQUEADO_POR_SEGURIDAD u otro valor no permitido manualmente:
        // ese estado lo asigna únicamente el sistema al detectar phishing.
        throw new Error('Estado no permitido');
    }

    const ticketValido = await validarTicketPerteneceACliente(idTicket, idClienteContexto);
    if (!ticketValido) {
        throw new Error('El ticket no pertenece a esa empresa');
    }

    const { rows } = await pool.query<TicketRow>(
        `UPDATE tickets
         SET estado = $1::varchar,
             fecha_cierre = CASE WHEN $1::varchar = 'CERRADO' THEN NOW() ELSE NULL END
         WHERE id_ticket = $2
         RETURNING *`,
        [nuevoEstado, idTicket]
    );
    return rows[0];
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

        // total_contratos es una señal interna para el análisis de IA (tamaño de
        // la relación comercial), no se expone nunca al frontend del ticket.
        const clienteInfoQuery = `
            SELECT
                cli.id_cliente,
                cli.nombre,
                cli.fecha_inicio_relacion,
                (SELECT COUNT(*) FROM contratos c2 WHERE c2.id_cliente = cli.id_cliente) AS total_contratos
            FROM clientes cli
            WHERE cli.id_cliente = $1
            LIMIT 1
        `;

        const clienteInfoResult = await client.query(clienteInfoQuery, [
            data.id_cliente
        ]);

        if (clienteInfoResult.rows.length === 0) {
            throw new Error(
                `No se encontró el cliente ${data.id_cliente}`
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
                id_cliente,
                id_servicio,
                titulo,
                descripcion,
                estado,
                id_usuario_creador
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const ticketResult = await client.query<TicketRow>(insertTicketQuery, [
            data.id_cliente,
            data.id_servicio,
            data.titulo,
            data.descripcion,
            estadoInicial,
            data.id_usuario_creador
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


export async function listTicketsWithAnalysis(filtro: ListarTicketsFiltro): Promise<TicketWithAnalysis[]> {
    const params: any[] = [];
    const condiciones: string[] = [];

    if (filtro.idCliente !== null) {
        params.push(filtro.idCliente);
        condiciones.push(`t.id_cliente = $${params.length}`);
    }
    if (filtro.idUsuarioCreador !== null) {
        params.push(filtro.idUsuarioCreador);
        condiciones.push(`t.id_usuario_creador = $${params.length}`);
    }
    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const query = `
        SELECT
            t.id_ticket,
            t.id_cliente,
            t.id_servicio,
            t.titulo,
            t.descripcion,
            t.tipo,
            t.prioridad,
            t.estado,
            t.fecha_creacion,
            t.fecha_cierre,
            t.id_usuario_creador,
            t.id_agente_asignado,
            ag.nombre as nombre_agente_asignado,
            sv.nombre as nombre_servicio,

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
        LEFT JOIN usuarios ag ON ag.id_usuario = t.id_agente_asignado
        LEFT JOIN servicios sv ON sv.id_servicio = t.id_servicio
        ${whereClause}
        ORDER BY t.fecha_creacion DESC
    `;

    const result = await pool.query(query, params);

    const items: TicketWithAnalysis[] = result.rows.map((row: any) => {
        // 🔹 1. Enmascarar descripción ANTES de enviarla al frontend
        const pre = preprocesarTextoTicket(row.descripcion);

        const ticket: TicketRow = {
            id_ticket: row.id_ticket,
            id_cliente: row.id_cliente,
            id_servicio: row.id_servicio,
            titulo: row.titulo,
            // el frontend SIEMPRE recibe la versión anonimizadaa
            descripcion: pre.textoAnonimizado,
            tipo: row.tipo,
            prioridad: row.prioridad,
            estado: row.estado,
            fecha_creacion: row.fecha_creacion,
            fecha_cierre: row.fecha_cierre,
            id_usuario_creador: row.id_usuario_creador,
            id_agente_asignado: row.id_agente_asignado,
            nombre_agente_asignado: row.nombre_agente_asignado,
            nombre_servicio: row.nombre_servicio
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
