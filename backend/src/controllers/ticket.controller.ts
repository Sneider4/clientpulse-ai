// src/controllers/ticket.controller.ts
import { Request, Response } from 'express';
import {
    createTicketWithAnalysis,
    listTicketsWithAnalysis,
    obtenerDetalleTicket,
    obtenerContextoCreacionTicketPorCliente,
    obtenerContextoCreacionTicketPorNit,
    validarContratoPerteneceACliente
} from '../services/ticket.service';

export async function getContextoCreacionTicketHandler(req: Request, res: Response) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        // Solo aplica para usuarios asociados a un cliente
        if (user.id_cliente === null) {
            return res.status(400).json({
                message: 'Este endpoint es solo para usuarios asociados a un cliente'
            });
        }

        const data = await obtenerContextoCreacionTicketPorCliente(user.id_cliente);

        if (!data) {
            return res.status(404).json({
                message: 'No se encontró el cliente asociado al usuario'
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

export async function getContextoCreacionTicketByNitHandler(req: Request, res: Response) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        // Solo admin global puede buscar por NIT libremente
        if (user.id_cliente !== null) {
            return res.status(403).json({
                message: 'No tienes permisos para buscar clientes por NIT'
            });
        }

        const nit = req.params.nit;

        if (!nit) {
            return res.status(400).json({ message: 'NIT es requerido' });
        }

        const data = await obtenerContextoCreacionTicketPorNit(nit);

        if (!data) {
            return res.status(404).json({
                message: 'Cliente no encontrado para ese NIT'
            });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error obteniendo contexto de ticket por NIT:', error);
        return res.status(500).json({
            message: 'Error interno al buscar cliente por NIT'
        });
    }
}

export async function getDetalleTicketHandler(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: 'id de ticket inválido' });
        }

        const data = await obtenerDetalleTicket(id);

        if (!data) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
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

        const {
            id_contrato,
            titulo,
            descripcion
        } = req.body;

        if (!id_contrato || !titulo || !descripcion) {
            return res.status(400).json({
                message: 'id_contrato, titulo y descripcion son obligatorios'
            });
        }

        const idContratoNum = Number(id_contrato);

        if (Number.isNaN(idContratoNum)) {
            return res.status(400).json({
                message: 'id_contrato inválido'
            });
        }

        // Si el usuario está asociado a un cliente, el contrato debe pertenecer a ese cliente
        if (user.id_cliente !== null) {
            const contratoValido = await validarContratoPerteneceACliente(
                idContratoNum,
                user.id_cliente
            );

            if (!contratoValido) {
                return res.status(403).json({
                    message: 'No tienes permisos para crear tickets sobre ese contrato'
                });
            }
        }

        const result = await createTicketWithAnalysis({
            id_contrato: idContratoNum,
            titulo,
            descripcion
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('Error creando ticket:', error);
        return res.status(500).json({
            message: 'Error interno al crear el ticket'
        });
    }
}

export async function listadoTicketsHandler(_req: Request, res: Response) {
    try {
        const items = await listTicketsWithAnalysis();
        return res.json({ items });
    } catch (error) {
        console.error('Error listando tickets:', error);
        return res.status(500).json({
            message: 'Error interno al listar los tickets'
        });
    }
}
