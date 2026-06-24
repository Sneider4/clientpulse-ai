// src/services/dashboard.service.ts
import { pool } from '../db/pool';
import { DashboardResumen, RiesgoResumenRow, TopClienteRow } from '../models/dashboard.modal';


export async function getDashboardResumen(): Promise<DashboardResumen> {
    // Top clientes por score promedio de churn (últimos 30 días)
    const topClientesQuery = `
    SELECT
        c.id_cliente,
        c.nombre AS nombre_cliente,
        COUNT(t.id_ticket) AS total_tickets,
        AVG(a.score_churn) AS promedio_score_churn,
        MODE() WITHIN GROUP (ORDER BY a.riesgo_churn) AS riesgo_predominante
    FROM clientes c
      JOIN contratos ct ON ct.id_cliente = c.id_cliente
      JOIN tickets t ON t.id_contrato = ct.id_contrato
      JOIN analisis_ticket a ON a.id_ticket = t.id_ticket
    GROUP BY c.id_cliente, c.nombre
    HAVING COUNT(t.id_ticket) > 0
    ORDER BY promedio_score_churn DESC
    LIMIT 5;
  `;
  
  // tener en cuenta esta linea del where a que solo se coloca cuando este en funcionamiento, solo coge los de los ultimos 30 dias
  // WHERE t.fecha_creacion >= NOW() - INTERVAL '30 days'

    const topClientesResult = await pool.query(topClientesQuery);

    const top_clientes: any[] = topClientesResult.rows.map((row: any) => ({
        id_cliente: row.id_cliente,
        nombre_cliente: row.nombre_cliente,
        total_tickets: Number(row.total_tickets),
        promedio_score_churn: Number(row.promedio_score_churn ?? 0),
        riesgo_predominante: row.riesgo_predominante
    }));

    // Resumen por riesgo de churn (todos los tickets analizados)
    const resumenRiesgoQuery = `
    SELECT
      a.riesgo_churn,
      COUNT(*) AS cantidad
    FROM analisis_ticket a
    GROUP BY a.riesgo_churn;
  `;
    const resumenRiesgoResult = await pool.query(resumenRiesgoQuery);

    const resumen_riesgo: any[] = resumenRiesgoResult.rows.map((row: any) => ({
        riesgo_churn: row.riesgo_churn,
        cantidad: Number(row.cantidad)
    }));

    // Score global de churn (promedio de todos los tickets analizados)
    const churnScoreQuery = `
    SELECT AVG(a.score_churn) AS churn_score_global
    FROM analisis_ticket a;
  `;
    const churnScoreResult = await pool.query(churnScoreQuery);
    const churn_score_global = Number(churnScoreResult.rows[0]?.churn_score_global ?? 0);

    // Resumen de sentimiento (POSITIVO / NEUTRO / NEGATIVO)
    const resumenSentimientoQuery = `
    SELECT
      a.sentimiento,
      COUNT(*) AS cantidad
    FROM analisis_ticket a
    GROUP BY a.sentimiento;
  `;
    const resumenSentimientoResult = await pool.query(resumenSentimientoQuery);

    const resumen_sentimiento: any[] = resumenSentimientoResult.rows.map((row: any) => ({
        sentimiento: row.sentimiento,
        cantidad: Number(row.cantidad)
    }));

    // Totales globales
    const totalTicketsQuery = `
    SELECT COUNT(*) AS total_tickets FROM tickets;
  `;
    const totalTicketsResult = await pool.query(totalTicketsQuery);
    const total_tickets = Number(totalTicketsResult.rows[0].total_tickets || 0);

    const totalClientesConTicketsQuery = `
    SELECT COUNT(DISTINCT c.id_cliente) AS total_clientes
    FROM clientes c
    JOIN contratos ct ON ct.id_cliente = c.id_cliente
    JOIN tickets t ON t.id_contrato = ct.id_contrato;
  `;
    const totalClientesResult = await pool.query(totalClientesConTicketsQuery);
    const total_clientes_con_tickets = Number(totalClientesResult.rows[0].total_clientes || 0);

    return {
        top_clientes,
        resumen_riesgo,
        total_tickets,
        total_clientes_con_tickets,
        churn_score_global,
        resumen_sentimiento
    };
}
