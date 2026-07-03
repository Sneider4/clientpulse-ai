// src/routes/tickets.routes.ts
import { Router } from 'express';
import {
    crearTicketHandler,
    getContextoCreacionTicketHandler,
    getDetalleTicketHandler,
    listadoTicketsHandler,
    getAgentesDisponiblesHandler,
    patchAsignarTicketHandler,
    patchEstadoTicketHandler
} from '../controllers/ticket.controller';
import { getMensajesHandler, postMensajeHandler } from '../controllers/mensaje.controller';
import { requirePermission } from '../middlewares/requirePermission';
import { requireModule } from '../middlewares/requireModule';
import { authJwt } from '../middlewares/authJwt';

const router = Router();

router.use(authJwt);
router.use(requireModule('TICKETS'));

// Contexto de creación de ticket (propia empresa, o ?id_cliente= si es admin)
router.get('/contexto-creacion', requirePermission('TICKETS_CREAR'), getContextoCreacionTicketHandler);

// Listar tickets
router.get('/listadoTicket', requirePermission('TICKETS_VER'), listadoTicketsHandler);
router.post('/listadoTicketAnalisis', requirePermission('TICKETS_CREAR'), crearTicketHandler);
router.get('/:id/detalleTicket', requirePermission('TICKETS_VER'), getDetalleTicketHandler);

// Gestión (asignar / cerrar) — Supervisor, Agente, Admin global
router.get('/agentes-disponibles', requirePermission('TICKETS_GESTIONAR'), getAgentesDisponiblesHandler);
router.patch('/:id/asignar', requirePermission('TICKETS_GESTIONAR'), patchAsignarTicketHandler);
router.patch('/:id/estado', requirePermission('TICKETS_GESTIONAR'), patchEstadoTicketHandler);

// Conversación del ticket (respuestas + notas internas — el filtrado fino de
// qué se ve ocurre dentro del handler, no aquí, porque depende del tipo de mensaje)
router.get('/:id/mensajes', requirePermission('TICKETS_VER'), getMensajesHandler);
router.post('/:id/mensajes', requirePermission('TICKETS_VER'), postMensajeHandler);

export default router;