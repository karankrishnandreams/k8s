// types/express/index.d.ts
import { UserPayload } from "@types/common";
import "express";
import { File as MulterFile } from "multer";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserPayload;
    companyObjId?: string;

    files?:
    | {
      [fieldname: string]: MulterFile[];
    }
    | MulterFile[]; // for .array()
    file?: MulterFile; // for .single()
  }
}
