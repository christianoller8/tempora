import type { AuthUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

// export {} makes this a module so declare global works correctly in all TS versions.
export {};
