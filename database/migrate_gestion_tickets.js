// Migración: permite asignar tickets a un agente/supervisor de la misma
// empresa y cerrarlos. Agrega tickets.id_agente_asignado y el permiso
// TICKETS_GESTIONAR (SUPERVISOR/AGENTE/ADMIN_GLOBAL — no VISUALIZADOR ni
// USUARIO_FINAL). Idempotente.
// Ejecutar desde la raíz del proyecto: node database/migrate_gestion_tickets.js
const path = require('path');
const backendModules = path.join(__dirname, '../backend/node_modules');
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require(path.join(backendModules, 'pg'));

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

        await client.query(`ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS id_agente_asignado INTEGER REFERENCES public.usuarios(id_usuario);`);

        const { rows: modRows } = await client.query(`SELECT id_modulo FROM modulos WHERE codigo = 'TICKETS' LIMIT 1`);
        if (modRows.length === 0) {
            throw new Error('Módulo TICKETS no existe');
        }
        await client.query(
            `INSERT INTO permisos (codigo, nombre, descripcion, id_modulo) VALUES ($1,$2,$3,$4) ON CONFLICT (codigo) DO NOTHING`,
            ['TICKETS_GESTIONAR', 'Gestionar tickets', 'Asignar y cerrar tickets de la propia empresa', modRows[0].id_modulo]
        );
        const { rows: permRows } = await client.query(`SELECT id_permiso FROM permisos WHERE codigo = 'TICKETS_GESTIONAR' LIMIT 1`);

        const { rows: rolRows } = await client.query(`SELECT id_rol, codigo FROM roles WHERE codigo IN ('ADMIN_GLOBAL','SUPERVISOR','AGENTE')`);
        for (const r of rolRows) {
            await client.query(
                `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [r.id_rol, permRows[0].id_permiso]
            );
        }

        await client.query('COMMIT');
        console.log('✅ Migración de gestión de tickets completada');
        console.log('   Permiso TICKETS_GESTIONAR asignado a:', rolRows.map((r) => r.codigo).join(', '));
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
