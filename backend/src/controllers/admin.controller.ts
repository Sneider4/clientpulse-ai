import { Request, Response } from 'express';
import * as adminService from '../services/admin.service';

const handle = (res: Response, fn: () => Promise<any>) =>
    fn().then(data => res.json({ ok: true, data }))
       .catch(e  => res.status(400).json({ ok: false, message: e.message }));

// ── USUARIOS ──────────────────────────────────────────────────────────────────

export const getUsuarios     = (req: Request, res: Response) => handle(res, adminService.listarUsuarios);

export const postUsuario     = (req: Request, res: Response) => {
    const { nombre, correo, password, id_rol, id_cliente, rol } = req.body;
    if (!nombre || !correo || !password || !id_rol || !rol)
        return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    return handle(res, () => adminService.crearUsuario({ nombre, correo, password, id_rol, id_cliente, rol }));
};

export const putUsuario      = (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { nombre, correo, id_rol, id_cliente, rol, password } = req.body;
    if (!nombre || !correo || !id_rol || !rol)
        return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios' });
    return handle(res, () => adminService.actualizarUsuario(id, { nombre, correo, id_rol, id_cliente, rol, password }));
};

export const patchToggleUsuario = (req: Request, res: Response) =>
    handle(res, () => adminService.toggleUsuarioActivo(Number(req.params.id)));

// ── ROLES Y PERMISOS ──────────────────────────────────────────────────────────

export const getRoles        = (req: Request, res: Response) => handle(res, adminService.listarRolesConPermisos);

export const postRol         = (req: Request, res: Response) => {
    const { codigo, nombre, descripcion } = req.body;
    if (!codigo || !nombre)
        return res.status(400).json({ ok: false, message: 'codigo y nombre son obligatorios' });
    return handle(res, () => adminService.crearRol({ codigo, nombre, descripcion }));
};

export const putRol          = (req: Request, res: Response) => {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ ok: false, message: 'nombre es obligatorio' });
    return handle(res, () => adminService.actualizarRol(Number(req.params.id), { nombre, descripcion }));
};

export const putPermisosRol  = (req: Request, res: Response) => {
    const { permisos } = req.body;
    if (!Array.isArray(permisos))
        return res.status(400).json({ ok: false, message: 'permisos debe ser un array' });
    return handle(res, () => adminService.actualizarPermisosRol(Number(req.params.id), permisos));
};

export const deleteRol       = (req: Request, res: Response) =>
    handle(res, () => adminService.eliminarRol(Number(req.params.id)));

// ── PERMISOS ──────────────────────────────────────────────────────────────────

export const getPermisos     = (req: Request, res: Response) => handle(res, adminService.listarPermisos);

// ── MÓDULOS POR CLIENTE ───────────────────────────────────────────────────────

export const getModulosCliente     = (req: Request, res: Response) =>
    handle(res, () => adminService.getModulosCliente(Number(req.params.id)));

export const putModulosCliente     = (req: Request, res: Response) => {
    const { modulos } = req.body;
    if (!Array.isArray(modulos))
        return res.status(400).json({ ok: false, message: 'modulos debe ser un array' });
    return handle(res, () => adminService.actualizarModulosCliente(Number(req.params.id), modulos));
};

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export const getClientesBasico    = (req: Request, res: Response) => handle(res, adminService.listarClientesBasico);

export const patchToggleCliente   = (req: Request, res: Response) =>
    handle(res, () => adminService.toggleClienteEstado(Number(req.params.id)));
