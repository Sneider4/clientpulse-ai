// src/routes/clientes.routes.ts
import { Router } from 'express';
import { crearClienteHandler, crearContratoHandler, getClienteResumenHandler, getClientesHandler, getContratosHandler } from '../controllers/cliente.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireModule } from '../middlewares/requireModule';
import { requirePermission } from '../middlewares/requirePermission';

const router = Router();

router.use(authJwt);
router.use(requireModule('CLIENTES'));

router.get('/:id/resumen-cliente', getClienteResumenHandler);
router.post('/insertar-cliente', requirePermission('CLIENTES_CREAR'), crearClienteHandler);
router.get('/consultar-clientes', requirePermission('CLIENTES_VER'), getClientesHandler);

export default router;
