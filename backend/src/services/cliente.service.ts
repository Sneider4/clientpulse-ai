// src/services/cliente.service.ts
import { pool } from '../db/pool';
import { Cliente, ClienteResumen, Contrato, ContratoInput } from '../models/cliente.model';

export async function crearCliente(data: Cliente): Promise<Cliente> {
    const {
        nombre,
        nit,
        sector,
        fecha_inicio_relacion,
        estado
    } = data;

    const query = `
    INSERT INTO clientes (
        nombre,
        nit,
        sector,
        fecha_inicio_relacion,
        estado
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
        id_cliente,
        nombre,
        nit,
        sector,
        fecha_inicio_relacion,
        estado
    `;

    const values = [
        nombre,
        nit,
        sector ?? null,
        fecha_inicio_relacion,
        estado
    ];

    const result = await pool.query<Cliente>(query, values);
    return result.rows[0];
}

export async function crearContrato(data: ContratoInput): Promise<Contrato> {
    const {
        id_cliente,
        nombre_proyecto,
        fecha_inicio,
        fecha_fin,
        valor_mensual,
        estado,
        nivel_servicio
    } = data;

    const query = `
        INSERT INTO contratos (
            id_cliente,
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            valor_mensual,
            nivel_servicio
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id_contrato,
            id_cliente,
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            valor_mensual,
            estado,
            nivel_servicio
    `;

    const values = [
        id_cliente,
        nombre_proyecto,
        fecha_inicio,
        fecha_fin ?? null,
        valor_mensual,
        nivel_servicio ?? null
    ];

    const result = await pool.query<Contrato>(query, values);
    return result.rows[0];
}

export async function listarContratos(): Promise<Contrato[]> {
    const query = `
        SELECT
            c.id_contrato,
            c.id_cliente,
            cli.nombre AS nombre_cliente,
            c.nombre_proyecto,
            c.fecha_inicio,
            c.fecha_fin,
            c.valor_mensual,
            c.estado,
            c.nivel_servicio
        FROM contratos c
        INNER JOIN clientes cli ON cli.id_cliente = c.id_cliente
        ORDER BY c.id_contrato DESC;
            `;

    const result = await pool.query<Contrato>(query);
    return result.rows;
}




export async function listarClientes(): Promise<Cliente[]> {
    const query = `
        SELECT
            cli.id_cliente,
            cli.nombre,
            cli.nit,
            cli.sector,
            cli.fecha_inicio_relacion,
            cli.estado,
            COUNT(ct.id_contrato) AS cantidad_contratos
        FROM clientes cli
        LEFT JOIN contratos ct ON ct.id_cliente = cli.id_cliente
        GROUP BY cli.id_cliente
        ORDER BY cli.id_cliente DESC
    `;

    const result = await pool.query<Cliente>(query);
    return result.rows;
}


export async function getClienteResumen(idCliente: number): Promise<ClienteResumen | null> {
    // Datos básicos del cliente
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

    // Contratos del cliente
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
            ORDER BY fecha_inicio DESC
    `;
    const contratosResult = await pool.query(contratosQuery, [idCliente]);

    const contratos = contratosResult.rows.map((row: any) => ({
        id_contrato: row.id_contrato,
        nombre_proyecto: row.nombre_proyecto,
        fecha_inicio: row.fecha_inicio,
        fecha_fin: row.fecha_fin,
        estado: row.estado,
        nivel_servicio: row.nivel_servicio
    }));

    // Resumen agregado de tickets + churn (por id_cliente directo — los tickets
    // ya no dependen de id_contrato desde el rediseño de servicios)
    const resumenQuery = `
        SELECT
            COUNT(t.id_ticket) AS total_tickets,
            AVG(a.score_churn) AS promedio_score_churn,
            MODE() WITHIN GROUP (ORDER BY a.riesgo_churn) AS riesgo_predominante
        FROM tickets t
        JOIN analisis_ticket a
        ON a.id_ticket = t.id_ticket
        WHERE t.id_cliente = $1
    `;
    const resumenResult = await pool.query(resumenQuery, [idCliente]);

    const r = resumenResult.rows[0] || {};
    const total_tickets = Number(r.total_tickets || 0);
    const promedio_score_churn = Number(r.promedio_score_churn || 0);
    const riesgo_predominante = r.riesgo_predominante || null;

    const ticketsPorRiesgoQuery = `
        SELECT
            a.riesgo_churn,
            COUNT(*) AS cantidad
        FROM tickets t
        JOIN analisis_ticket a ON a.id_ticket = t.id_ticket
        WHERE t.id_cliente = $1
        GROUP BY a.riesgo_churn
    `;
    const ticketsPorRiesgoResult = await pool.query(ticketsPorRiesgoQuery, [
        idCliente
    ]);

    const tickets_por_riesgo = ticketsPorRiesgoResult.rows.map((row: any) => ({
        riesgo_churn: row.riesgo_churn,
        cantidad: Number(row.cantidad)
    }));

    // Últimos tickets con análisis
    const ticketsRecientesQuery = `
        SELECT
            t.id_ticket,
            t.titulo,
            t.descripcion,
            t.prioridad,
            t.estado,
            t.fecha_creacion,
            a.sentimiento,
            a.frustracion,
            a.score_churn,
            a.riesgo_churn,
            a.es_potencial_phishing,
            a.tiene_datos_sensibles,
            sv.nombre AS nombre_servicio

        FROM tickets t

        LEFT JOIN servicios sv
        ON sv.id_servicio = t.id_servicio

        LEFT JOIN analisis_ticket a
        ON a.id_ticket = t.id_ticket

        WHERE t.id_cliente = $1
        ORDER BY t.fecha_creacion DESC
        LIMIT 20
    `;
    const ticketsRecientesResult = await pool.query(ticketsRecientesQuery, [
        idCliente
    ]);

    const tickets_recientes = ticketsRecientesResult.rows.map((row: any) => ({
        id_ticket: row.id_ticket,
        titulo: row.titulo,
        descripcion: row.descripcion,
        prioridad: row.prioridad,
        estado: row.estado,
        fecha_creacion: row.fecha_creacion,
        sentimiento: row.sentimiento,
        frustracion: row.frustracion,
        score_churn: row.score_churn,
        riesgo_churn: row.riesgo_churn,
        es_potencial_phishing: row.es_potencial_phishing,
        tiene_datos_sensibles: row.tiene_datos_sensibles,
        nombre_servicio: row.nombre_servicio,
    }));

    return {
        cliente,
        contratos,
        resumen: {
            total_tickets,
            promedio_score_churn,
            riesgo_predominante,
            tickets_por_riesgo
        },
        tickets_recientes
    };
}

