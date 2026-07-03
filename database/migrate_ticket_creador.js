// Migración puntual: agrega tickets.id_usuario_creador (idempotente).
// Ejecutar desde la raíz del proyecto: node database/migrate_ticket_creador.js
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

pool.query(
    'ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS id_usuario_creador INTEGER REFERENCES public.usuarios(id_usuario);'
)
    .then(() => {
        console.log('✅ Columna id_usuario_creador lista en tickets');
        return pool.end();
    })
    .catch((e) => {
        console.error('❌ Error:', e.message);
        process.exit(1);
    });
