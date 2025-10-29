declare module 'multer' {
  import type { Request } from 'express';
  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination?: string;
    filename?: string;
    path?: string;
    buffer?: Buffer;
  }
  const multer: any;
  export default multer;
}
