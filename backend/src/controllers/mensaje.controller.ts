// src/controllers/mensaje.controller.ts
import { Request, Response } from 'express';
import { obtenerDetalleTicket, puedeVerTicket } from '../services/ticket.service';
import { listarMensajesTicket, crearMensaje, TipoMensajeTicket } from '../services/mensaje.service';
import { userHasPermission } from '../middlewares/requirePermission';

export async function getMensajesHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const idTicket = Number(req.params.id);
        if (Number.isNaN(idTicket)) {
            return res.status(400).json({ message: 'id de ticket inválido' });
        }

        const ticket = await obtenerDetalleTicket(idTicket);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
        }
        if (!(await puedeVerTicket(user, ticket))) {
            return res.status(403).json({ message: 'No tienes acceso a este ticket' });
        }

        const puedeGestionar = await userHasPermission(user, 'TICKETS_GESTIONAR');
        const puedeVerTodos = puedeGestionar || (await userHasPermission(user, 'TICKETS_VER_TODOS'));

        const items = await listarMensajesTicket(idTicket, puedeVerTodos);
        return res.json({ items });
    } catch (error) {
        console.error('Error listando mensajes del ticket:', error);
        return res.status(500).json({ message: 'Error interno al listar los mensajes' });
    }
}

export async function postMensajeHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const idTicket = Number(req.params.id);
        const mensaje = (req.body.mensaje || '').trim();
        if (Number.isNaN(idTicket) || !mensaje) {
            return res.status(400).json({ message: 'id de ticket o mensaje inválido' });
        }

        const ticket = await obtenerDetalleTicket(idTicket);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket no encontrado' });
        }
        if (!(await puedeVerTicket(user, ticket))) {
            return res.status(403).json({ message: 'No tienes acceso a este ticket' });
        }

        const puedeGestionar = await userHasPermission(user, 'TICKETS_GESTIONAR');

        // Publicar (RESPUESTA o NOTA_INTERNA) exige capacidad de escritura: quien
        // gestiona tickets, quien puede crearlos, o el propio autor original del
        // ticket. Un rol de solo lectura (Visualizador) puede ver el hilo pero no
        // publicar nada en él.
        const puedeCrear = await userHasPermission(user, 'TICKETS_CREAR');
        const esAutorOriginal = ticket.id_usuario_creador === user.id_usuario;
        if (!puedeGestionar && !puedeCrear && !esAutorOriginal) {
            return res.status(403).json({ message: 'No tienes permisos para escribir en este ticket' });
        }

        // El tipo solo lo elige quien gestiona tickets del staff; cualquier otro
        // (usuario final incluido) siempre publica una RESPUESTA visible, sin
        // importar lo que mande el body — evita que alguien fuerce una nota interna.
        let tipo: TipoMensajeTicket = 'RESPUESTA';
        if (req.body.tipo === 'NOTA_INTERNA') {
            if (!puedeGestionar) {
                return res.status(403).json({ message: 'No tienes permisos para dejar notas internas' });
            }
            tipo = 'NOTA_INTERNA';
        }

        const nuevo = await crearMensaje(idTicket, user.id_usuario, tipo, mensaje);
        return res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error creando mensaje del ticket:', error);
        return res.status(500).json({ message: 'Error interno al crear el mensaje' });
    }
}
