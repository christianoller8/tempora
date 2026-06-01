import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { LoginRequestSchema } from '@tempora/shared';
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from './iam.controller.js';

export const iamRouter = Router();

// POST /auth/login — public
iamRouter.post('/login', validate(LoginRequestSchema), loginHandler);

// POST /auth/refresh — public (cookie-based)
iamRouter.post('/refresh', refreshHandler);

// POST /auth/logout — requires valid access token
iamRouter.post('/logout', authenticate, logoutHandler);

// GET /auth/me — requires valid access token
iamRouter.get('/me', authenticate, meHandler);
