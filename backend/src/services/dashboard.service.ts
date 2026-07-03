// src/services/dashboard.service.ts
import { pool } from '../db/pool';
import { DashboardResumen } from '../models/dashboard.modal';

/**
 * Métricas de tickets/análisis compartidas entre el dashboard de admin (global)
 * y el de cliente (acotado a su propio id_cliente, directo en tickets.id_cliente).
 */
async function getTicketMetrics(idCliente: number | null) {
    const filtroTickets = idCliente !== null
        ? 'WHERE t.id_cliente = $1'
        : '';
    const filtroAnalisis = idCliente !== null
        ? 'JOIN tickets t ON t.id_ticket = a.id_ticket WHERE t.id_cliente = $1'
        : '';
    const params = idCliente !== null ? [idCliente] : [];

    const totalTicketsResult = await pool.query(
        `SELECT COUNT(*) AS total_tickets FROM tickets t ${filtroTickets};`,
        params
    );
    const total_tickets = Number(totalTicketsResult.rows[0].total_tickets || 0);

    const resumenRiesgoResult = await pool.query(
        `SELECT a.riesgo_churn, COUNT(*) AS cantidad FROM analisis_ticket a ${filtroAnalisis} GROUP BY a.riesgo_churn;`,
        params
    );
    const resumen_riesgo = resumenRiesgoResult.rows.map((row: any) => ({
        riesgo_churn: row.riesgo_churn,
        cantidad: Number(row.cantidad)
    }));

    const churnScoreResult = await pool.query(
        `SELECT AVG(a.score_churn) AS churn_score_global FROM analisis_ticket a ${filtroAnalisis};`,
        params
    );
    const churn_score_global = Number(churnScoreResult.rows[0]?.churn_score_global ?? 0);

    const resumenSentimientoResult = await pool.query(
        `SELECT a.sentimiento, COUNT(*) AS cantidad FROM analisis_ticket a ${filtroAnalisis} GROUP BY a.sentimiento;`,
        params
    );
    const resumen_sentimiento = resumenSentimientoResult.rows.map((row: any) => ({
        sentimiento: row.sentimiento,
        cantidad: Number(row.cantidad)
    }));

    const resumenEstadoResult = await pool.query(
        `SELECT t.estado, COUNT(*) AS cantidad FROM tickets t ${filtroTickets} GROUP BY t.estado;`,
        params
    );
    const resumen_estado = resumenEstadoResult.rows.map((row: any) => ({
        estado: row.estado,
        cantidad: Number(row.cantidad)
    }));

    const resumenPrioridadResult = await pool.query(
        `SELECT t.prioridad, COUNT(*) AS cantidad FROM tickets t ${filtroTickets} GROUP BY t.prioridad;`,
        params
    );
    const resumen_prioridad = resumenPrioridadResult.rows.map((row: any) => ({
        prioridad: row.prioridad,
        cantidad: Number(row.cantidad)
    }));

    const alertasSeguridadResult = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE a.es_potencial_phishing) AS phishing,
            COUNT(*) FILTER (WHERE a.tiene_datos_sensibles) AS datos_sensibles
         FROM analisis_ticket a ${filtroAnalisis};`,
        params
    );
    const alertas_seguridad = {
        phishing: Number(alertasSeguridadResult.rows[0]?.phishing ?? 0),
        datos_sensibles: Number(alertasSeguridadResult.rows[0]?.datos_sensibles ?? 0)
    };

    const ticketsPorDiaResult = await pool.query(
        `SELECT DATE(t.fecha_creacion) AS dia, COUNT(*) AS cantidad FROM tickets t ${filtroTickets} GROUP BY dia ORDER BY dia;`,
        params
    );
    const tickets_por_dia = ticketsPorDiaResult.rows.map((row: any) => ({
        dia: row.dia,
        cantidad: Number(row.cantidad)
    }));

    return {
        total_tickets,
        resumen_riesgo,
        churn_score_global,
        resumen_sentimiento,
        resumen_estado,
        resumen_prioridad,
        alertas_seguridad,
        tickets_por_dia
    };
}

/**
 * Dashboard de administrador: visión de negocio — todos los clientes,
 * ranking de riesgo y salud de contratos/MRR.
 */
export async function getDashboardResumenAdmin(): Promise<DashboardResumen> {
    const metrics = await getTicketMetrics(null);

    const topClientesQuery = `
    SELECT
        c.id_cliente,
        c.nombre AS nombre_cliente,
        COUNT(t.id_ticket) AS total_tickets,
        AVG(a.score_churn) AS promedio_score_churn,
        MODE() WITHIN GROUP (ORDER BY a.riesgo_churn) AS riesgo_predominante
    FROM clientes c
      JOIN tickets t ON t.id_cliente = c.id_cliente
      JOIN analisis_ticket a ON a.id_ticket = t.id_ticket
    GROUP BY c.id_cliente, c.nombre
    HAVING COUNT(t.id_ticket) > 0
    ORDER BY promedio_score_churn DESC
    LIMIT 5;
  `;
    const topClientesResult = await pool.query(topClientesQuery);
    const top_clientes = topClientesResult.rows.map((row: any) => ({
        id_cliente: row.id_cliente,
        nombre_cliente: row.nombre_cliente,
        total_tickets: Number(row.total_tickets),
        promedio_score_churn: Number(row.promedio_score_churn ?? 0),
        riesgo_predominante: row.riesgo_predominante
    }));

    const totalClientesConTicketsResult = await pool.query(`
    SELECT COUNT(DISTINCT c.id_cliente) AS total_clientes
    FROM clientes c
    JOIN tickets t ON t.id_cliente = c.id_cliente;
  `);
    const total_clientes_con_tickets = Number(totalClientesConTicketsResult.rows[0].total_clientes || 0);

    const negocioResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM clientes) AS total_clientes,
      (SELECT COUNT(*) FROM clientes WHERE estado = 'ACTIVO') AS clientes_activos,
      (SELECT COUNT(*) FROM contratos WHERE estado = 'VIGENTE') AS contratos_activos,
      (SELECT COALESCE(SUM(valor_mensual), 0) FROM contratos WHERE estado = 'VIGENTE') AS mrr_total,
      (SELECT COUNT(*) FROM contratos
         WHERE estado = 'VIGENTE' AND fecha_fin IS NOT NULL AND fecha_fin <= NOW() + INTERVAL '30 days'
      ) AS contratos_por_vencer;
  `);
    const negocioRow = negocioResult.rows[0] || {};
    const negocio = {
        total_clientes: Number(negocioRow.total_clientes || 0),
        clientes_activos: Number(negocioRow.clientes_activos || 0),
        contratos_activos: Number(negocioRow.contratos_activos || 0),
        mrr_total: Number(negocioRow.mrr_total || 0),
        contratos_por_vencer: Number(negocioRow.contratos_por_vencer || 0)
    };

    return {
        contexto: 'ADMIN',
        top_clientes,
        total_clientes_con_tickets,
        negocio,
        ...metrics
    };
}

/**
 * Dashboard de cliente: mismas métricas de tickets/riesgo/satisfacción,
 * acotadas a los contratos del propio id_cliente. Sin ranking de otros
 * clientes ni métricas de negocio (no aplican a una sola cuenta).
 */
export async function getDashboardResumenCliente(idCliente: number): Promise<DashboardResumen> {
    const metrics = await getTicketMetrics(idCliente);

    return {
        contexto: 'CLIENTE',
        top_clientes: [],
        total_clientes_con_tickets: 0,
        negocio: undefined,
        ...metrics
    };
}
