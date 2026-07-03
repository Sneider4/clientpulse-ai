// src/controllers/cliente.controller.ts
import { Request, Response } from 'express';
import { getClienteResumen, crearCliente, crearContrato, listarContratos, listarClientes } from '../services/cliente.service';

export async function crearClienteHandler(req: Request, res: Response) {
    try {
        const { nombre, nit, sector, fecha_inicio_relacion, estado } = req.body;

        if (!nombre || !nit || !fecha_inicio_relacion || !estado) {
            return res.status(400).json({
                message: "nombre, nit, fecha_inicio_relacion y estado son obligatorios"
            });
        }

        const nuevoCliente = await crearCliente({
            nombre,
            nit,
            sector,
            fecha_inicio_relacion,
            estado
        });

        return res.status(201).json(nuevoCliente);
    } catch (error) {
        console.error("Error creando cliente:", error);
        return res.status(500).json({
            message: "Error al crear el cliente"
        });
    }
}

export async function crearContratoHandler(req: Request, res: Response) {
    try {
        const {
            id_cliente,
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            valor_mensual,
            estado,
            nivel_servicio
        } = req.body;

        if (!id_cliente || !nombre_proyecto || !fecha_inicio || !valor_mensual || !estado) {
            return res.status(400).json({
                message:
                    "id_cliente, nombre_proyecto, fecha_inicio, valor_mensual y estado son obligatorios"
            });
        }

        const nuevoContrato = await crearContrato({
            id_cliente: Number(id_cliente),
            nombre_proyecto,
            fecha_inicio,
            fecha_fin,
            valor_mensual: Number(valor_mensual),
            estado,
            nivel_servicio
        });

        return res.status(201).json(nuevoContrato);
    } catch (error) {
        console.error("Error creando contrato:", error);
        return res.status(500).json({
            message: "Error al crear el contrato"
        });
    }
}

export async function getContratosHandler(req: Request, res: Response) {
    try {
        const contratos = await listarContratos();
        return res.json(contratos);
    } catch (error) {
        console.error("Error obteniendo contratos:", error);
        return res.status(500).json({ message: "Error obteniendo contratos" });
    }
}

export async function getClientesHandler(req: Request, res: Response) {
    try {
        const clientes = await listarClientes();
        return res.json(clientes);
    } catch (error) {
        console.error("Error obteniendo clientes:", error);
        return res.status(500).json({ message: "Error obteniendo clientes" });
    }
}

export async function getClienteResumenHandler(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: 'id de cliente inválido' });
        }

        const data = await getClienteResumen(id);

        if (!data) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }

        return res.json(data);
    } catch (error) {
        console.error('Error obteniendo resumen de cliente:', error);
        return res.status(500).json({
            message: 'Error interno al obtener el resumen del cliente'
        });
    }
}
