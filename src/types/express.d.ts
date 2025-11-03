import 'express';
import type { Multer } from 'multer';

declare global {
  namespace Express {
    interface Request {
      user?: import('../middlewares/auth').JWTPayload;
      file?: Multer.File;
      files?: Multer.File[];
    }
  }
}
