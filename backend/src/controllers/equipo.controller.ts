// src/controllers/equipo.controller.ts
import { Request, Response } from 'express';
import { crearUsuarioFinal, listarUsuariosFinalesPorCliente } from '../services/admin.service';

export async function getUsuariosFinalesHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user || user.id_cliente === null) {
            return res.status(403).json({ message: 'Solo aplica a usuarios de una empresa cliente' });
        }

        const items = await listarUsuariosFinalesPorCliente(user.id_cliente);
        return res.json({ items });
    } catch (error) {
        console.error('Error listando usuarios finales:', error);
        return res.status(500).json({ message: 'Error interno al listar usuarios finales' });
    }
}

export async function postUsuarioFinalHandler(req: Request, res: Response) {
    try {
        const user = req.user;
        if (!user || user.id_cliente === null) {
            return res.status(403).json({
                message: 'Solo el Supervisor de una empresa cliente puede invitar usuarios finales'
            });
        }

        const { nombre, correo, password } = req.body;
        if (!nombre || !correo || !password) {
            return res.status(400).json({ message: 'nombre, correo y password son obligatorios' });
        }

        const nuevo = await crearUsuarioFinal(user.id_cliente, { nombre, correo, password });
        return res.status(201).json(nuevo);
    } catch (error: any) {
        console.error('Error creando usuario final:', error);
        return res.status(500).json({ message: error.message || 'Error interno al crear el usuario final' });
    }
}
