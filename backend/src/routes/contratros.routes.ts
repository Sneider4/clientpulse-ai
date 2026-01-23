import { Router } from 'express';
import { crearClienteHandler, crearContratoHandler, getClientePorNitHandler, getClienteResumenHandler, getClientesHandler, getContratosHandler } from '../controllers/cliente.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireModule } from '../middlewares/requireModule';
import { requirePermission } from '../middlewares/requirePermission';

const router = Router();

router.use(authJwt);
router.use(requireModule('CONTRATOS'));

router.get('/consultar-contratos', requirePermission('CONTRATO_VER'), getContratosHandler);
router.post('/insertar-contrato', requirePermission('CONTRATO_CREAR'), crearContratoHandler);

export default router;