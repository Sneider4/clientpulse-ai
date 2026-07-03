// src/controllers/servicio.controller.ts
import { Request, Response } from 'express';
import { crearServicio, listarServiciosPorCliente, toggleServicioActivo } from '../services/servicio.service';

export async function getServiciosHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user || user.id_cliente === null) {
            return res.status(403).json({ message: 'Solo aplica a usuarios de una empresa cliente' });
        }

        const items = await listarServiciosPorCliente(user.id_cliente);
        return res.json({ items });
    } catch (error) {
        console.error('Error listando servicios:', error);
        return res.status(500).json({ message: 'Error interno al listar servicios' });
    }
}

export async function postServicioHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user || user.id_cliente === null) {
            return res.status(403).json({
                message: 'Solo el Supervisor de una empresa cliente puede crear servicios'
            });
        }

        const { nombre } = req.body;
        if (!nombre) {
            return res.status(400).json({ message: 'nombre es obligatorio' });
        }

        const nuevo = await crearServicio(user.id_cliente, nombre);
        return res.status(201).json(nuevo);
    } catch (error: any) {
        console.error('Error creando servicio:', error);
        return res.status(500).json({ message: error.message || 'Error interno al crear el servicio' });
    }
}

export async function patchToggleServicioHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user || user.id_cliente === null) {
            return res.status(403).json({ message: 'Solo aplica a usuarios de una empresa cliente' });
        }

        const id = Number(req.params.id);
        if (Number.isNaN(id)) {
            return res.status(400).json({ message: 'id de servicio inválido' });
        }

        const actualizado = await toggleServicioActivo(id, user.id_cliente);
        return res.json(actualizado);
    } catch (error: any) {
        console.error('Error actualizando servicio:', error);
        return res.status(500).json({ message: error.message || 'Error interno al actualizar el servicio' });
    }
}
