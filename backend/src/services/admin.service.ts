import bcrypt from 'bcrypt';
import { pool } from '../db/pool';

// ── USUARIOS ─────────────────────────────────────────────────────────────────

export async function listarUsuarios() {
    const { rows } = await pool.query(`
        SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.id_rol,
               u.id_cliente, u.activo,
               c.nombre AS nombre_cliente,
               r.nombre AS nombre_rol
        FROM usuarios u
        LEFT JOIN clientes c ON c.id_cliente = u.id_cliente
        LEFT JOIN roles    r ON r.id_rol     = u.id_rol
        ORDER BY u.id_usuario
    `);
    return rows;
}

export async function crearUsuario(data: {
    nombre: string; correo: string; password: string;
    id_rol: number; id_cliente: number | null; rol: string;
}) {
    const hash = await bcrypt.hash(data.password, 10);
    const { rows } = await pool.query(`
        INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol, activo)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id_usuario, nombre, correo, rol, id_rol, id_cliente, activo
    `, [data.nombre, data.correo, hash, data.id_rol, data.id_cliente ?? null, data.rol]);
    return rows[0];
}

export async function actualizarUsuario(id: number, data: {
    nombre: string; correo: string; id_rol: number;
    id_cliente: number | null; rol: string; password?: string;
}) {
    if (data.password) {
        const hash = await bcrypt.hash(data.password, 10);
        const { rows } = await pool.query(`
            UPDATE usuarios
            SET nombre=$1, correo=$2, id_rol=$3, id_cliente=$4, rol=$5, password_hash=$6
            WHERE id_usuario=$7
            RETURNING id_usuario, nombre, correo, rol, id_rol, id_cliente, activo
        `, [data.nombre, data.correo, data.id_rol, data.id_cliente ?? null, data.rol, hash, id]);
        return rows[0];
    }
    const { rows } = await pool.query(`
        UPDATE usuarios
        SET nombre=$1, correo=$2, id_rol=$3, id_cliente=$4, rol=$5
        WHERE id_usuario=$6
        RETURNING id_usuario, nombre, correo, rol, id_rol, id_cliente, activo
    `, [data.nombre, data.correo, data.id_rol, data.id_cliente ?? null, data.rol, id]);
    return rows[0];
}

// ── EQUIPO (usuarios finales por empresa cliente) ──────────────────────────────
// A diferencia de crearUsuario/listarUsuarios (solo admin global), estas dos
// funciones las usa un SUPERVISOR sobre su propia empresa — por eso reciben
// idCliente explícito en vez de dejarlo elegir en el body.

export async function crearUsuarioFinal(
    idCliente: number,
    data: { nombre: string; correo: string; password: string }
) {
    const { rows: rolRows } = await pool.query(
        `SELECT id_rol FROM roles WHERE codigo = 'USUARIO_FINAL' LIMIT 1`
    );
    if (rolRows.length === 0) {
        throw new Error('El rol USUARIO_FINAL no está configurado');
    }
    return crearUsuario({
        nombre: data.nombre,
        correo: data.correo,
        password: data.password,
        id_rol: rolRows[0].id_rol,
        id_cliente: idCliente,
        rol: 'USUARIO_FINAL'
    });
}

export async function listarUsuariosFinalesPorCliente(idCliente: number) {
    const { rows } = await pool.query(`
        SELECT u.id_usuario, u.nombre, u.correo, u.activo
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        WHERE u.id_cliente = $1 AND r.codigo = 'USUARIO_FINAL'
        ORDER BY u.nombre
    `, [idCliente]);
    return rows;
}

export async function toggleUsuarioActivo(id: number) {
    const { rows } = await pool.query(`
        UPDATE usuarios SET activo = NOT activo
        WHERE id_usuario = $1
        RETURNING id_usuario, activo
    `, [id]);
    return rows[0];
}

// ── ROLES Y PERMISOS ──────────────────────────────────────────────────────────

export async function listarRolesConPermisos() {
    const { rows } = await pool.query(`
        SELECT r.id_rol, r.codigo, r.nombre, r.descripcion,
               COALESCE(
                   array_agg(rp.id_permiso) FILTER (WHERE rp.id_permiso IS NOT NULL),
                   '{}'
               ) AS permisos
        FROM roles r
        LEFT JOIN roles_permisos rp ON rp.id_rol = r.id_rol
        GROUP BY r.id_rol
        ORDER BY r.id_rol
    `);
    return rows;
}

export async function crearRol(data: { codigo: string; nombre: string; descripcion?: string }) {
    const { rows } = await pool.query(`
        INSERT INTO roles (codigo, nombre, descripcion)
        VALUES ($1, $2, $3)
        RETURNING *
    `, [data.codigo.toUpperCase(), data.nombre, data.descripcion ?? null]);
    return rows[0];
}

export async function actualizarRol(id: number, data: { nombre: string; descripcion?: string }) {
    const { rows } = await pool.query(`
        UPDATE roles SET nombre=$1, descripcion=$2 WHERE id_rol=$3 RETURNING *
    `, [data.nombre, data.descripcion ?? null, id]);
    return rows[0];
}

export async function actualizarPermisosRol(idRol: number, permisoIds: number[]) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM roles_permisos WHERE id_rol = $1', [idRol]);
        for (const idPermiso of permisoIds) {
            await client.query(
                'INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1, $2)',
                [idRol, idPermiso]
            );
        }
        await client.query('COMMIT');
        return { id_rol: idRol, permisos: permisoIds };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function eliminarRol(id: number) {
    const { rows: usrs } = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_rol = $1 LIMIT 1', [id]
    );
    if (usrs.length > 0) {
        throw new Error('No se puede eliminar: el rol tiene usuarios asignados');
    }
    await pool.query('DELETE FROM roles WHERE id_rol = $1', [id]);
    return { eliminado: true };
}

// ── PERMISOS ──────────────────────────────────────────────────────────────────

export async function listarPermisos() {
    const { rows } = await pool.query(`
        SELECT p.id_permiso, p.codigo, p.nombre, p.descripcion, p.id_modulo,
               m.codigo AS modulo_codigo, m.nombre AS modulo_nombre
        FROM permisos p
        JOIN modulos m ON m.id_modulo = p.id_modulo
        ORDER BY m.codigo, p.codigo
    `);
    return rows;
}

// ── MÓDULOS POR CLIENTE ───────────────────────────────────────────────────────

export async function getModulosCliente(idCliente: number) {
    const { rows } = await pool.query(`
        SELECT m.id_modulo, m.codigo, m.nombre,
               COALESCE(cm.habilitado, false) AS habilitado
        FROM modulos m
        LEFT JOIN clientes_modulos cm
               ON cm.id_modulo = m.id_modulo AND cm.id_cliente = $1
        ORDER BY m.codigo
    `, [idCliente]);
    return rows;
}

export async function actualizarModulosCliente(idCliente: number, moduloIds: number[]) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM clientes_modulos WHERE id_cliente = $1', [idCliente]);
        for (const idModulo of moduloIds) {
            await client.query(
                'INSERT INTO clientes_modulos (id_cliente, id_modulo, habilitado) VALUES ($1, $2, true)',
                [idCliente, idModulo]
            );
        }
        await client.query('COMMIT');
        return { id_cliente: idCliente, modulos: moduloIds };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────

export async function listarClientesBasico() {
    const { rows } = await pool.query(`
        SELECT id_cliente, nombre, nit, estado FROM clientes ORDER BY nombre
    `);
    return rows;
}

export async function toggleClienteEstado(id: number) {
    const { rows } = await pool.query(`
        UPDATE clientes
        SET estado = CASE WHEN estado = 'ACTIVO' THEN 'INACTIVO' ELSE 'ACTIVO' END
        WHERE id_cliente = $1
        RETURNING id_cliente, nombre, estado
    `, [id]);
    if (rows.length === 0) throw new Error('Cliente no encontrado');
    return rows[0];
}
