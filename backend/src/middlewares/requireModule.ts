import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

export function requireModule(moduloCodigo: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            console.log('>>>>>>>>>>>>>>>>>', user)
            if (!user) return res.status(401).json({ ok: false, message: 'No autenticado' });

            // ADMIN global: opcionalmente bypass a módulos por cliente
            if (user.id_cliente === null) return next();

            const q = `
                SELECT 1
                FROM clientes_modulos cm
                JOIN modulos m ON m.id_modulo = cm.id_modulo
                WHERE cm.id_cliente = $1
                AND m.codigo = $2
                AND cm.habilitado = TRUE
                LIMIT 1
            `;
            const { rows } = await pool.query(q, [user.id_cliente, moduloCodigo]);

            if (rows.length === 0) {
                return res.status(403).json({
                    ok: false,
                    message: `Módulo no habilitado para el cliente (${moduloCodigo})`,
                });
            }

            return next();
        } catch (e) {
            return res.status(500).json({ ok: false, message: 'Error validando módulo' });
        }
    };
}
