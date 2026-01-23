// src/routes/tickets.routes.ts
import { Router } from 'express';
import { crearTicketHandler, getDetalleTicketHandler, listadoTicketsHandler } from '../controllers/ticket.controller';
import { requirePermission } from '../middlewares/requirePermission';
import { requireModule } from '../middlewares/requireModule';
import { authJwt } from '../middlewares/authJwt';

const router = Router();

router.use(authJwt);
router.use(requireModule('TICKETS'));

// Listar tickets
router.get('/listadoTicket', requirePermission('TICKETS_VER'), listadoTicketsHandler);
router.post('/listadoTicketAnalisis', requirePermission('TICKETS_CREAR'), crearTicketHandler);
router.get('/:id/detalleTicket', requirePermission('TICKETS_VER'), getDetalleTicketHandler);

export default router;
