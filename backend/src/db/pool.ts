// src/db/pool.ts
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            host: process.env.PGHOST,
            port: Number(process.env.PGPORT || 5432),
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
        }
);

export async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL. NOW():', result.rows[0].now);
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error);
    }
}
