// Migración: separa "servicio del cliente" (lo que el usuario final elige al
// crear un ticket) del "contrato comercial" (ClientPulse↔Cliente, solo admin).
// Crea la tabla servicios, la puebla desde los contratos existentes (solo el
// nombre, sin precio/nivel de servicio), agrega tickets.id_cliente/id_servicio,
// hace backfill desde el id_contrato histórico, y agrega el permiso
// SERVICIOS_GESTIONAR. Idempotente — se puede correr más de una vez.
// Ejecutar desde la raíz del proyecto: node database/migrate_servicios.js
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

        // 1. Esquema (mismo contenido que schema.sql, por si no se reaplicó)
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.servicios (
                id_servicio SERIAL PRIMARY KEY,
                id_cliente  INTEGER      NOT NULL REFERENCES public.clientes(id_cliente),
                nombre      VARCHAR(150) NOT NULL,
                estado      VARCHAR(20)  DEFAULT 'ACTIVO'
            );
        `);
        await client.query(`ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS id_cliente INTEGER REFERENCES public.clientes(id_cliente);`);
        await client.query(`ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS id_servicio INTEGER REFERENCES public.servicios(id_servicio);`);
        await client.query(`ALTER TABLE public.tickets ALTER COLUMN id_contrato DROP NOT NULL;`);

        // 2. Poblar servicios desde los contratos existentes (solo nombre, sin precio/tier)
        await client.query(`
            INSERT INTO servicios (id_cliente, nombre)
            SELECT DISTINCT ct.id_cliente, ct.nombre_proyecto
            FROM contratos ct
            WHERE NOT EXISTS (
                SELECT 1 FROM servicios s
                WHERE s.id_cliente = ct.id_cliente AND s.nombre = ct.nombre_proyecto
            );
        `);
        const { rows: servRows } = await client.query('SELECT COUNT(*) AS n FROM servicios');

        // 3. Backfill tickets.id_cliente desde el id_contrato histórico
        const backfillCliente = await client.query(`
            UPDATE tickets t
            SET id_cliente = ct.id_cliente
            FROM contratos ct
            WHERE t.id_contrato = ct.id_contrato AND t.id_cliente IS NULL;
        `);

        // 4. Backfill tickets.id_servicio emparejando por nombre del contrato original
        const backfillServicio = await client.query(`
            UPDATE tickets t
            SET id_servicio = s.id_servicio
            FROM contratos ct
            JOIN servicios s ON s.id_cliente = ct.id_cliente AND s.nombre = ct.nombre_proyecto
            WHERE t.id_contrato = ct.id_contrato AND t.id_servicio IS NULL;
        `);

        // 5. Permiso SERVICIOS_GESTIONAR (módulo EQUIPO, ya debe existir de la migración anterior)
        const { rows: modRows } = await client.query(`SELECT id_modulo FROM modulos WHERE codigo = 'EQUIPO' LIMIT 1`);
        if (modRows.length === 0) {
            throw new Error('Módulo EQUIPO no existe — corre primero database/migrate_usuario_final.js');
        }
        await client.query(
            `INSERT INTO permisos (codigo, nombre, descripcion, id_modulo) VALUES ($1,$2,$3,$4) ON CONFLICT (codigo) DO NOTHING`,
            ['SERVICIOS_GESTIONAR', 'Gestionar servicios', 'Crear y administrar el catálogo de servicios de la propia empresa', modRows[0].id_modulo]
        );
        const { rows: permRows } = await client.query(`SELECT id_permiso FROM permisos WHERE codigo = 'SERVICIOS_GESTIONAR' LIMIT 1`);
        const { rows: rolRows } = await client.query(`SELECT id_rol, codigo FROM roles WHERE codigo IN ('ADMIN_GLOBAL','SUPERVISOR')`);
        for (const r of rolRows) {
            await client.query(
                `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [r.id_rol, permRows[0].id_permiso]
            );
        }

        await client.query('COMMIT');
        console.log('✅ Migración de servicios completada');
        console.log('   Servicios en catálogo:', servRows[0].n);
        console.log('   Tickets con id_cliente actualizado:', backfillCliente.rowCount);
        console.log('   Tickets con id_servicio actualizado:', backfillServicio.rowCount);
        console.log('   Permiso SERVICIOS_GESTIONAR asignado a:', rolRows.map((r) => r.codigo).join(', '));
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
