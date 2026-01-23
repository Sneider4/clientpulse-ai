import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export type JwtUser = {
    id_usuario: number;
    id_rol: number;
    id_cliente: number | null;
    correo: string;
};

declare global {
    namespace Express {
        interface Request {
            user?: JwtUser;
        }
    }
}

export function authJwt(req: Request, res: Response, next: NextFunction) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;

        if (!token) {
            return res.status(401).json({ ok: false, message: 'Token requerido' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET no definido');

        const decoded = jwt.verify(token, secret) as JwtUser;
        req.user = decoded;

        return next();
    } catch {
        return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
    }
}
