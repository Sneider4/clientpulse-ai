import { Router } from 'express';
import { crearContratoHandler, getContratosHandler } from '../controllers/cliente.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireModule } from '../middlewares/requireModule';
import { requirePermission } from '../middlewares/requirePermission';

const router = Router();

router.use(authJwt);
router.use(requireModule('CONTRATOS'));

router.get('/consultar-contratos', requirePermission('CONTRATOS_VER'), getContratosHandler);
router.post('/insertar-contrato', requirePermission('CONTRATOS_CREAR'), crearContratoHandler);

export default router;