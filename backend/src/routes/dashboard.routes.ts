// src/routes/dashboard.routes.ts
import { Router } from 'express';
import { getDashboardResumenHandler } from '../controllers/dashboard.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireModule } from '../middlewares/requireModule';
import { requirePermission } from '../middlewares/requirePermission';

const router = Router();

router.use(authJwt);
router.use(requireModule('DASHBOARD'));

router.get('/resumen',requirePermission('DASHBOARD_VER'), getDashboardResumenHandler);

export default router;
