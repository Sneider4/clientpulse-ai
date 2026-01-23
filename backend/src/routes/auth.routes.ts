// backend/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authJwt } from '../middlewares/authJwt';

const router = Router();

// POST /auth/login
router.post('/login', AuthController.login);
router.get('/accesos', authJwt, AuthController.Accesos);

export default router;
