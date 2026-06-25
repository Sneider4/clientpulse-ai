// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';
import { testConnection } from './db/pool';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
}));
app.use(express.json());

// Prefijo API
app.use('/api', router);

app.listen(port, async () => {
    console.log(`🚀 API Vortex escuchando en http://localhost:${port}`);
    await testConnection();
});
