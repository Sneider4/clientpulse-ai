// src/services/servicio.service.ts
// Catálogo propio del cliente ("¿sobre qué producto/área es tu ticket?").
// Deliberadamente separado de `contratos` (relación comercial ClientPulse↔Cliente,
// con precio y nivel de servicio) — servicios solo tiene nombre y nunca se
// expone junto a datos comerciales.
import { pool } from '../db/pool';

export async function listarServiciosPorCliente(idCliente: number) {
    const { rows } = await pool.query(`
        SELECT id_servicio, nombre, estado
        FROM servicios
        WHERE id_cliente = $1
        ORDER BY nombre
    `, [idCliente]);
    return rows;
}

export async function crearServicio(idCliente: number, nombre: string) {
    const { rows } = await pool.query(`
        INSERT INTO servicios (id_cliente, nombre, estado)
        VALUES ($1, $2, 'ACTIVO')
        RETURNING id_servicio, nombre, estado
    `, [idCliente, nombre]);
    return rows[0];
}

export async function toggleServicioActivo(idServicio: number, idCliente: number) {
    const { rows } = await pool.query(`
        UPDATE servicios
        SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
        WHERE id_servicio = $1 AND id_cliente = $2
        RETURNING id_servicio, nombre, estado
    `, [idServicio, idCliente]);
    if (rows.length === 0) throw new Error('Servicio no encontrado');
    return rows[0];
}
