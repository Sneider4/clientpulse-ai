// src/routes/equipo.routes.ts
import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt';
import { requireModule } from '../middlewares/requireModule';
import { requirePermission } from '../middlewares/requirePermission';
import { getUsuariosFinalesHandler, postUsuarioFinalHandler } from '../controllers/equipo.controller';
import { getServiciosHandler, postServicioHandler, patchToggleServicioHandler } from '../controllers/servicio.controller';

const router = Router();

router.use(authJwt);
router.use(requireModule('EQUIPO'));

router.get('/usuarios-finales', requirePermission('USUARIOS_FINALES_GESTIONAR'), getUsuariosFinalesHandler);
router.post('/usuarios-finales', requirePermission('USUARIOS_FINALES_GESTIONAR'), postUsuarioFinalHandler);

router.get('/servicios', requirePermission('SERVICIOS_GESTIONAR'), getServiciosHandler);
router.post('/servicios', requirePermission('SERVICIOS_GESTIONAR'), postServicioHandler);
router.patch('/servicios/:id/toggle', requirePermission('SERVICIOS_GESTIONAR'), patchToggleServicioHandler);

export default router;
