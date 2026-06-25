// backend/services/auth.service.ts
import bcrypt from 'bcrypt';
import { pool } from '../db/pool';
import { signToken } from '../utils/jwt';

type LoginResult = {
    token: string;
    user: {
        id_usuario: number;
        nombre: string;
        correo: string;
        rol: string;
    };
};

export class AuthService {

    static async login(correo: string, password: string): Promise<LoginResult> {
        const where = `
            SELECT u.id_usuario, u.nombre, u.correo, u.id_cliente, u.id_rol, u.rol, u.password_hash, u.activo,
                   c.estado AS cliente_estado
            FROM usuarios u
            LEFT JOIN clientes c ON c.id_cliente = u.id_cliente
            WHERE u.correo = $1
            LIMIT 1
        `;
        const { rows } = await pool.query(where, [correo]);

        if (rows.length === 0) {
            throw new Error('Credenciales inválidas');
        }

        const user = rows[0];

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            throw new Error('Credenciales inválidas');
        }

        if (!user.activo) {
            throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
        }

        if (user.id_cliente !== null && user.cliente_estado === 'INACTIVO') {
            throw new Error('El acceso de tu empresa está desactivado. Contacta al administrador.');
        }

        const token = signToken({
            id_usuario: user.id_usuario,
            id_rol: user.id_rol,
            id_cliente: user.id_cliente, // null para ADMIN global
            correo: user.correo,
        });

        return {
            token,
            user: {
                id_usuario: user.id_usuario,
                nombre: user.nombre,
                correo: user.correo,
                rol: user.rol,
            },
        };
    }

    static async getAccess(id_usuario: number) {
        // 1) user + rol + cliente
        const qUser = `
            SELECT u.id_usuario, u.nombre, u.correo, u.id_cliente, u.id_rol, r.codigo AS rol_codigo
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.id_rol
            WHERE u.id_usuario = $1
            LIMIT 1
        `;
        const { rows: urows } = await pool.query(qUser, [id_usuario]);
        if (urows.length === 0) throw new Error('Usuario no encontrado');
        const user = urows[0];

        // 2) modules habilitados por cliente (si ADMIN global id_cliente null -> todos)
        let modules: string[] = [];
        if (user.id_cliente === null) {
            const { rows } = await pool.query(`SELECT codigo FROM modulos ORDER BY codigo`);
            modules = rows.map(r => r.codigo);
        } else {
            const qMods = `
                SELECT m.codigo
                FROM clientes_modulos cm
                JOIN modulos m ON m.id_modulo = cm.id_modulo
                WHERE cm.id_cliente = $1 AND cm.habilitado = TRUE
                ORDER BY m.codigo
            `;
            const { rows } = await pool.query(qMods, [user.id_cliente]);
            modules = rows.map(r => r.codigo);
        }

        // 3) permisos por rol
        const qPerms = `
            SELECT p.codigo
            FROM roles_permisos rp
            JOIN permisos p ON p.id_permiso = rp.id_permiso
            WHERE rp.id_rol = $1
            ORDER BY p.codigo
        `;
        const { rows: prows } = await pool.query(qPerms, [user.id_rol]);
        const permissions = prows.map(r => r.codigo);

        return {
            user: {
                id_usuario: user.id_usuario,
                nombre: user.nombre,
                correo: user.correo,
                id_cliente: user.id_cliente,
                rol: user.rol_codigo,
            },
            modules,
            permissions,
        };
    }
}
