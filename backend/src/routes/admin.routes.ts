import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt';
import { requireAdmin } from '../middlewares/requireAdmin';
import {
    getUsuarios, postUsuario, putUsuario, patchToggleUsuario,
    getRoles, postRol, putRol, putPermisosRol, deleteRol,
    getPermisos,
    getModulosCliente, putModulosCliente,
    getClientesBasico,
} from '../controllers/admin.controller';

const router = Router();

router.use(authJwt);
router.use(requireAdmin);

// Usuarios
router.get   ('/usuarios',            getUsuarios);
router.post  ('/usuarios',            postUsuario);
router.put   ('/usuarios/:id',        putUsuario);
router.patch ('/usuarios/:id/toggle', patchToggleUsuario);

// Roles
router.get   ('/roles',                   getRoles);
router.post  ('/roles',                   postRol);
router.put   ('/roles/:id',               putRol);
router.put   ('/roles/:id/permisos',      putPermisosRol);
router.delete('/roles/:id',               deleteRol);

// Permisos (solo lectura, se gestionan desde el seed/DB)
router.get('/permisos', getPermisos);

// Módulos por cliente
router.get('/clientes/:id/modulos', getModulosCliente);
router.put ('/clientes/:id/modulos', putModulosCliente);

// Clientes básico para selects
router.get('/clientes', getClientesBasico);

export default router;
