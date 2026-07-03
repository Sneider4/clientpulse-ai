// Migración puntual: agrega el rol USUARIO_FINAL, el módulo EQUIPO, los permisos
// TICKETS_VER_TODOS / USUARIOS_FINALES_GESTIONAR, y un usuario demo — sin tocar
// tickets existentes (a diferencia de seed.js, es 100% idempotente e incremental).
// Ejecutar desde la raíz del proyecto: node database/migrate_usuario_final.js
const path = require('path');
const backendModules = path.join(__dirname, '../backend/node_modules');
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require(path.join(backendModules, 'pg'));
const bcrypt = require(path.join(backendModules, 'bcrypt'));

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            host:     process.env.PGHOST     || 'localhost',
            port:     Number(process.env.PGPORT) || 5432,
            database: process.env.PGDATABASE || 'vortex',
            user:     process.env.PGUSER     || 'postgres',
            password: process.env.PGPASSWORD || '1234',
          }
);

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Módulo EQUIPO
        await client.query(
            `INSERT INTO modulos (codigo, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`,
            ['EQUIPO', 'Gestión de equipo', 'Invitar y administrar usuarios finales de la empresa']
        );
        const { rows: modRows } = await client.query('SELECT id_modulo, codigo FROM modulos');
        const modId = Object.fromEntries(modRows.map((m) => [m.codigo, m.id_modulo]));

        // Permisos nuevos
        const permisosNuevos = [
            ['TICKETS_VER_TODOS', 'Ver todos los tickets', 'Ver todos los tickets de la empresa, no solo los propios', 'TICKETS'],
            ['USUARIOS_FINALES_GESTIONAR', 'Gestionar usuarios finales', 'Invitar y administrar los usuarios finales de la propia empresa', 'EQUIPO'],
        ];
        for (const [codigo, nombre, descripcion, modCodigo] of permisosNuevos) {
            await client.query(
                `INSERT INTO permisos (codigo, nombre, descripcion, id_modulo) VALUES ($1,$2,$3,$4) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, nombre, descripcion, modId[modCodigo]]
            );
        }
        const { rows: permRows } = await client.query('SELECT id_permiso, codigo FROM permisos');
        const permId = Object.fromEntries(permRows.map((p) => [p.codigo, p.id_permiso]));

        // Rol USUARIO_FINAL
        await client.query(
            `INSERT INTO roles (codigo, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`,
            ['USUARIO_FINAL', 'Usuario final', 'Presenta y consulta únicamente sus propios tickets']
        );
        const { rows: rolRows } = await client.query('SELECT id_rol, codigo FROM roles');
        const rolId = Object.fromEntries(rolRows.map((r) => [r.codigo, r.id_rol]));

        // roles_permisos: agregar TICKETS_VER_TODOS a SUPERVISOR/AGENTE/VISUALIZADOR/ADMIN_GLOBAL,
        // USUARIOS_FINALES_GESTIONAR a SUPERVISOR/ADMIN_GLOBAL, y los permisos de USUARIO_FINAL.
        const rolPermisosNuevos = {
            'ADMIN_GLOBAL':  ['TICKETS_VER_TODOS', 'USUARIOS_FINALES_GESTIONAR'],
            'SUPERVISOR':    ['TICKETS_VER_TODOS', 'USUARIOS_FINALES_GESTIONAR'],
            'AGENTE':        ['TICKETS_VER_TODOS'],
            'VISUALIZADOR':  ['TICKETS_VER_TODOS'],
            'USUARIO_FINAL': ['TICKETS_VER', 'TICKETS_CREAR'],
        };
        for (const [rolCodigo, perms] of Object.entries(rolPermisosNuevos)) {
            if (!rolId[rolCodigo]) continue;
            for (const permCodigo of perms) {
                if (!permId[permCodigo]) continue;
                await client.query(
                    `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                    [rolId[rolCodigo], permId[permCodigo]]
                );
            }
        }

        // clientes_modulos: habilitar EQUIPO para TechCorp y Bancol (clientes con "todos los módulos")
        const { rows: cliRows } = await client.query(
            `SELECT id_cliente, nit FROM clientes WHERE nit IN ('900111222-3', '800333444-5')`
        );
        for (const c of cliRows) {
            await client.query(
                `INSERT INTO clientes_modulos (id_cliente, id_modulo, habilitado) VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`,
                [c.id_cliente, modId['EQUIPO']]
            );
        }

        // Usuario demo USUARIO_FINAL en TechCorp
        const { rows: techcorp } = await client.query(`SELECT id_cliente FROM clientes WHERE nit = '900111222-3' LIMIT 1`);
        if (techcorp.length > 0) {
            const hash = await bcrypt.hash('1234', 10);
            await client.query(
                `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol, activo)
                 VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (correo) DO NOTHING`,
                ['Pedro Gómez', 'cliente1@techcorp.com', hash, rolId['USUARIO_FINAL'], techcorp[0].id_cliente, 'USUARIO_FINAL']
            );
        }

        await client.query('COMMIT');
        console.log('✅ Migración USUARIO_FINAL completada');
        console.log('   Módulos:', Object.keys(modId).join(', '));
        console.log('   Permisos nuevos:', permisosNuevos.map((p) => p[0]).join(', '));
        console.log('   Rol nuevo: USUARIO_FINAL (id_rol =', rolId['USUARIO_FINAL'], ')');
        console.log('   Usuario demo: cliente1@techcorp.com / 1234');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error en la migración:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
