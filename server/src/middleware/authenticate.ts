import type { NextFunction, Request, Response } from 'express';

import { auth } from '../services/firebaseAdmin';
import { HttpError } from '../types';

declare global {
  namespace Express {
    interface Request {
      /** uid do usuário autenticado, preenchido por `authenticate`. */
      uid: string;
    }
  }
}

/** Exige `Authorization: Bearer <Firebase ID token>` e valida o token com o Admin SDK. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Token de autenticação ausente.');

  const decoded = await auth.verifyIdToken(token).catch(() => {
    throw new HttpError(401, 'Token de autenticação inválido ou expirado.');
  });
  if (decoded.firebase.sign_in_provider !== 'password') {
    throw new HttpError(403, 'Somente contas autenticadas por e-mail e senha são aceitas.');
  }
  req.uid = decoded.uid;
  next();
}
