import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
        return res.status(401).json({ ok: false, message: 'No autenticado' });
    }
    if (req.user.id_cliente !== null) {
        return res.status(403).json({ ok: false, message: 'Acción exclusiva de administradores globales' });
    }
    next();
}
