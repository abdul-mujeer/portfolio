import { Router } from 'express';
import { authenticate, endSession } from '../lib/authenticate.js';
import { toPublicActor } from '../lib/scope.js';
import { loginSchema } from '../validation.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export function authRouter({ db, config }) {
  const router = Router();

  router.post('/auth/login', validateBody(loginSchema), (req, res, next) => {
    try {
      const { email, password } = req.validatedBody;
      const { employee, token, issuedAt, expiresAt } = authenticate(db, config, { email, password });
      setSessionCookie(res, config, token, expiresAt);
      res.status(200).json({
        data: { token, issuedAt, expiresAt, user: toPublicActor(employee) },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', (req, res, next) => {
    try {
      endSession(db, req.actor?.sessionToken);
      clearSessionCookie(res, config);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get('/auth/session', requireAuth, (req, res) => {
    res.json({
      data: {
        user: toPublicActor(req.actor),
        expiresAt: req.actor.sessionExpiresAt,
        sessionTtlHours: config.sessionTtlHours,
      },
    });
  });

  return router;
}
