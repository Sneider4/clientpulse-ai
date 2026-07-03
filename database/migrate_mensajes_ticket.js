// Migración: agrega el hilo de conversación de un ticket (respuestas visibles
// para el cliente + notas internas visibles solo para el staff). No requiere
// permisos nuevos: RESPUESTA usa TICKETS_CREAR/TICKETS_VER ya existentes,
// NOTA_INTERNA usa TICKETS_GESTIONAR ya existente. Idempotente.
// Ejecutar desde la raíz del proyecto: node database/migrate_mensajes_ticket.js
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

        await client.query(`
            CREATE TABLE IF NOT EXISTS public.ticket_mensajes (
                id_mensaje        SERIAL PRIMARY KEY,
                id_ticket         INTEGER      NOT NULL REFERENCES public.tickets(id_ticket),
                id_usuario_autor  INTEGER      NOT NULL REFERENCES public.usuarios(id_usuario),
                mensaje           TEXT         NOT NULL,
                tipo              VARCHAR(20)  NOT NULL DEFAULT 'RESPUESTA',
                fecha_creacion    TIMESTAMP    NOT NULL DEFAULT NOW()
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Migración de mensajes de ticket completada (tabla ticket_mensajes lista)');
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
