// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { getDashboardResumenAdmin, getDashboardResumenCliente } from '../services/dashboard.service';

export async function getDashboardResumenHandler(req: Request, res: Response) {
    try {
        const idCliente = req.user?.id_cliente ?? null;
        const data = idCliente === null
            ? await getDashboardResumenAdmin()
            : await getDashboardResumenCliente(idCliente);
        return res.json(data);
    } catch (error) {
        console.error('Error obteniendo resumen de dashboard:', error);
        return res.status(500).json({
            message: 'Error interno al obtener el dashboard'
        });
    }
}
