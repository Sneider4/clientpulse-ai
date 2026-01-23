// backend/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
    static async login(req: Request, res: Response) {
        try {
            const { correo, password } = req.body;

            if (!correo || !password) {
                return res.status(400).json({
                    ok: false,
                    message: 'correo y password son obligatorios',
                });
            }

            const result = await AuthService.login(String(correo).trim(), String(password));
            return res.status(200).json({ ok: true, ...result });
        } catch (e: any) {
            return res.status(401).json({
                ok: false,
                message: e?.message || 'Credenciales inválidas',
            });
        }
    }

    static async Accesos(req: Request, res: Response) {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ ok: false, message: 'No autenticado' });
        }

        const data = await AuthService.getAccess(user.id_usuario);
        return res.json({ ok: true, ...data });
    }
}

