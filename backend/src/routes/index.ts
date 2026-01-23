// src/routes/index.ts
import { Router } from 'express';
import ticketsRouter from './tickets.routes';
import dashboardRouter from './dashboard.routes';
import clientesRouter from './clientes.routes';
import contratosRouter from './contratros.routes';
import authRoutes from './auth.routes';


const router = Router();

// Ruta de salud
router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'API ClientPulse AI funcionando'
    });
});

// Rutas de autenticacion
router.use('/auth', authRoutes);

// Rutas de tickets
router.use('/tickets', ticketsRouter);

// Rutas de Dashboard
router.use('/dashboard', dashboardRouter);

// Rutas de clientes
router.use('/clientes', clientesRouter);

// Rutas de contratos
router.use('/contratos', contratosRouter);

export default router;
