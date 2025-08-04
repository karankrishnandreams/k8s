// types/express/index.d.ts
import { UserPayload } from '@types/common';
import 'express';

declare module 'express' {
  export interface Request {
    user?: UserPayload;
  }
}
