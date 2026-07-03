import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { JwtUser } from './authJwt';

/**
 * Reutilizable fuera del middleware: permite chequear un permiso puntual
 * dentro de un controller (p. ej. para decidir el alcance de una consulta),
 * sin duplicar la query de roles_permisos.
 */
export async function userHasPermission(user: JwtUser, permisoCodigo: string): Promise<boolean> {
    if (user.id_cliente === null) return true; // admin global bypasea todo

    const q = `
        SELECT 1
        FROM roles_permisos rp
        JOIN permisos p ON p.id_permiso = rp.id_permiso
        WHERE rp.id_rol = $1
        AND p.codigo = $2
        LIMIT 1
    `;
    const { rows } = await pool.query(q, [user.id_rol, permisoCodigo]);
    return rows.length > 0;
}

export function requirePermission(permisoCodigo: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ ok: false, message: 'No autenticado' });

            const tienePermiso = await userHasPermission(user, permisoCodigo);
            if (!tienePermiso) {
                return res.status(403).json({ ok: false, message: 'Sin permisos' });
            }

            return next();
        } catch {
            return res.status(500).json({ ok: false, message: 'Error validando permisos' });
        }
    };
}
