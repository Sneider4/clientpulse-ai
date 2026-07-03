// src/services/mensaje.service.ts
// Hilo de conversación de un ticket: RESPUESTA (visible para el cliente que
// presentó el ticket) y NOTA_INTERNA (visible solo para el staff de la
// empresa con TICKETS_GESTIONAR). El filtrado de qué se devuelve ocurre
// aquí, en el servidor — nunca se envían notas internas al cliente para que
// no dependa de que el frontend las oculte correctamente.
import { pool } from '../db/pool';

export type TipoMensajeTicket = 'RESPUESTA' | 'NOTA_INTERNA';

export async function listarMensajesTicket(idTicket: number, incluirNotasInternas: boolean) {
    const condicionTipo = incluirNotasInternas ? '' : `AND m.tipo = 'RESPUESTA'`;
    const { rows } = await pool.query(`
        SELECT m.id_mensaje, m.id_ticket, m.id_usuario_autor, u.nombre AS nombre_autor,
               m.mensaje, m.tipo, m.fecha_creacion
        FROM ticket_mensajes m
        JOIN usuarios u ON u.id_usuario = m.id_usuario_autor
        WHERE m.id_ticket = $1
        ${condicionTipo}
        ORDER BY m.fecha_creacion ASC
    `, [idTicket]);
    return rows;
}

export async function crearMensaje(
    idTicket: number,
    idUsuarioAutor: number,
    tipo: TipoMensajeTicket,
    mensaje: string
) {
    const { rows } = await pool.query(`
        INSERT INTO ticket_mensajes (id_ticket, id_usuario_autor, tipo, mensaje)
        VALUES ($1, $2, $3, $4)
        RETURNING id_mensaje, id_ticket, id_usuario_autor, tipo, mensaje, fecha_creacion
    `, [idTicket, idUsuarioAutor, tipo, mensaje]);
    return rows[0];
}
