import type { UserRole } from '../../src/types';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        department: string;
        avatar: string | null;
      };
      sessionTokenHash?: string;
    }
  }
}

export {};

