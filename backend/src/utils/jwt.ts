// backend/src/utils/jwt.ts
import * as jwt from 'jsonwebtoken';

export function signToken(payload: object) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET no está definido en el .env');
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'];

    return jwt.sign(payload, secret, { expiresIn });
}
