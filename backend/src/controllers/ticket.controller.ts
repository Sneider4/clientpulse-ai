// src/controllers/ticket.controller.ts
import { Request, Response } from 'express';
import {
    createTicketWithAnalysis,
    listTicketsWithAnalysis,
    obtenerDetalleTicket,
    obtenerContextoCreacionTicketPorCliente,
    validarServicioPerteneceACliente,
    listarAgentesPorCliente,
    asignarTicket,
    actualizarEstadoTicket,
    puedeVerTicket
} from '../services/ticket.service';
import { userHasPermission } from '../middlewares/requirePermission';
import { ESTADOS_TICKET_ASIGNABLES, EstadoTicketAsignable } from '../models/ticket.model';

/**
 * Resuelve para qué id_cliente actúa quien gestiona el ticket: el suyo propio
 * si tiene id_cliente fijo, o el del ticket mismo si es admin global.
 */
async function resolverIdClienteContexto(user: { id_cliente: number | null }, idTicket: number): Promise<number | null> {
    if (user.id_cliente !== null) return user.id_cliente;
    const ticket = await obtenerDetalleTicket(idTicket);
    return ticket?.id_cliente ?? null;
}

export async function getContextoCreacionTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        // Usuarios asociados a un cliente siempre ven su propia empresa. El admin
        // global no tiene id_cliente fijo, así que debe indicar cuál via query
        // (?id_cliente=) — ya tiene la lista completa de clientes vía CLIENTES_VER,
        // no necesita buscar por NIT.
        let idCliente: number | null = user.id_cliente;
        if (idCliente === null) {
            const idClienteQuery = Number(req.query.id_cliente);
            if (!idClienteQuery || Number.isNaN(idClienteQuery)) {
                return res.status(400).json({
                    message: 'Como admin, debes indicar ?id_cliente= para obtener el contexto de creación'
                });
            }
            idCliente = idClienteQuery;
        }

        const data = await obtenerContextoCreacionTicketPorCliente(idCliente);

        if (!data) {
            return res.status(404).json({
                message: 'No se encontró el cliente indicado'
            });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error obteniendo contexto de creación del ticket:', error);
        return res.status(500).json({
            message: 'Error interno al obtener el contexto de creación del ticket'
        });
    }
}

export async function getDetalleTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: 'id de ticket inválido' });
        }

        const data = await obtenerDetalleTicket(id);

        if (!data) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
        }

        if (!(await puedeVerTicket(user, data))) {
            return res.status(403).json({ message: 'No tienes acceso a este ticket' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error obteniendo detalle del ticket:', error);
        return res.status(500).json({
            message: 'Error interno al obtener detalle del ticket'
        });
    }
}

export async function crearTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const { id_cliente, id_servicio, titulo, descripcion } = req.body;

        if (!titulo || !descripcion) {
            return res.status(400).json({
                message: 'titulo y descripcion son obligatorios'
            });
        }

        // Un usuario asociado a un cliente siempre crea sobre su propia empresa,
        // sin importar lo que mande el body — evita que alguien fuerce otro id_cliente.
        // El admin sí debe indicar explícitamente para cuál cliente es el ticket.
        let idClienteNum: number;
        if (user.id_cliente !== null) {
            idClienteNum = user.id_cliente;
        } else {
            idClienteNum = Number(id_cliente);
            if (!idClienteNum || Number.isNaN(idClienteNum)) {
                return res.status(400).json({ message: 'id_cliente es obligatorio' });
            }
        }

        let idServicioNum: number | null = null;
        if (id_servicio !== undefined && id_servicio !== null && id_servicio !== '') {
            idServicioNum = Number(id_servicio);
            if (Number.isNaN(idServicioNum)) {
                return res.status(400).json({ message: 'id_servicio inválido' });
            }
            const servicioValido = await validarServicioPerteneceACliente(idServicioNum, idClienteNum);
            if (!servicioValido) {
                return res.status(403).json({
                    message: 'Ese servicio no pertenece al cliente indicado'
                });
            }
        }

        const result = await createTicketWithAnalysis({
            id_cliente: idClienteNum,
            id_servicio: idServicioNum,
            titulo,
            descripcion,
            id_usuario_creador: user.id_usuario
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('Error creando ticket:', error);
        return res.status(500).json({
            message: 'Error interno al crear el ticket'
        });
    }
}

export async function listadoTicketsHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        // Admin (id_cliente null) ve todo. Un usuario de empresa ve solo su empresa,
        // y si no tiene TICKETS_VER_TODOS, únicamente los tickets que él mismo creó.
        let idUsuarioCreador: number | null = null;
        if (user.id_cliente !== null) {
            const puedeVerTodos = await userHasPermission(user, 'TICKETS_VER_TODOS');
            if (!puedeVerTodos) {
                idUsuarioCreador = user.id_usuario;
            }
        }

        const items = await listTicketsWithAnalysis({
            idCliente: user.id_cliente,
            idUsuarioCreador
        });
        return res.json({ items });
    } catch (error) {
        console.error('Error listando tickets:', error);
        return res.status(500).json({
            message: 'Error interno al listar los tickets'
        });
    }
}

export async function getAgentesDisponiblesHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }
        if (user.id_cliente === null) {
            return res.status(400).json({ message: 'Este endpoint es solo para usuarios asociados a un cliente' });
        }

        const items = await listarAgentesPorCliente(user.id_cliente);
        return res.json({ items });
    } catch (error) {
        console.error('Error listando agentes disponibles:', error);
        return res.status(500).json({ message: 'Error interno al listar agentes' });
    }
}

export async function patchAsignarTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const idTicket = Number(req.params.id);
        const idAgente = Number(req.body.id_agente);
        if (Number.isNaN(idTicket) || Number.isNaN(idAgente)) {
            return res.status(400).json({ message: 'id de ticket o id_agente inválido' });
        }

        const idClienteContexto = await resolverIdClienteContexto(user, idTicket);
        if (idClienteContexto === null) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
        }

        const ticket = await asignarTicket(idTicket, idAgente, idClienteContexto);
        return res.json(ticket);
    } catch (error: any) {
        console.error('Error asignando ticket:', error);
        const status = /no pertenece/.test(error.message || '') ? 403 : 400;
        return res.status(status).json({ message: error.message || 'Error interno al asignar el ticket' });
    }
}

export async function patchEstadoTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const idTicket = Number(req.params.id);
        const estado = req.body.estado as EstadoTicketAsignable;
        if (Number.isNaN(idTicket) || !ESTADOS_TICKET_ASIGNABLES.includes(estado)) {
            return res.status(400).json({ message: 'id de ticket o estado inválido' });
        }

        const idClienteContexto = await resolverIdClienteContexto(user, idTicket);
        if (idClienteContexto === null) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
        }

        const ticket = await actualizarEstadoTicket(idTicket, estado, idClienteContexto);
        return res.json(ticket);
    } catch (error: any) {
        console.error('Error actualizando estado del ticket:', error);
        const status = /no pertenece/.test(error.message || '') ? 403 : 400;
        return res.status(status).json({ message: error.message || 'Error interno al actualizar el estado' });
    }
}
