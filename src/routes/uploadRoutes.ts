import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { protect, admin } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { server, storage as storageCfg } from '../config/config.js';
import UploadedImage from '../models/UploadedImage.js';

const router = express.Router();

// Configure Cloudinary if using cloud storage
if (storageCfg.provider === 'cloudinary') {
  cloudinary.config({
    cloud_name: storageCfg.cloudinaryCloudName,
    api_key: storageCfg.cloudinaryApiKey,
    api_secret: storageCfg.cloudinaryApiSecret,
  });
}

// Setup storage based on provider
const uploadsRoot = storageCfg.localDir || 'uploads';
const imagesDir = path.join(uploadsRoot, 'images');

let uploadStorage: any;

if (storageCfg.provider === 'cloudinary') {
  // Cloudinary storage
  uploadStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (_req: any, file: any) => {
      const publicId = `products/${uuidv4()}`;
      return {
        folder: 'ecommerce',
        public_id: publicId,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'],
        transformation: [{ width: 1600, crop: 'limit' }],
      };
    },
  });
} else {
  // Local disk storage
  fs.mkdirSync(imagesDir, { recursive: true });

  uploadStorage = multer.diskStorage({
    destination: (_req: any, _file: any, cb: (err: any, dest: string) => void) => {
      cb(null, imagesDir);
    },
    filename: (_req: any, file: any, cb: (err: any, filename: string) => void) => {
      const ext = path.extname(file.originalname) || '.png';
      const name = uuidv4();
      cb(null, `${name}${ext}`);
    },
  });
}

const allowedMime = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: any, file: any, cb: (err: any, acceptFile: boolean) => void) => {
    if (allowedMime.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'), false);
  },
});

// Helper to optimize and generate responsive variants (local storage only)
async function optimizeImage(inputPath: string, baseName: string): Promise<{ url: string; absoluteUrl: string; variants: Record<string, string>; thumbnail: string; }> {
  const sizes = [400, 800, 1200];
  const rel = (filename: string) => `/uploads/images/${filename}`;
  const abs = (rp: string) => `${server.baseUrl.replace(/\/$/, '')}${rp}`;

  const mainWebpName = `${baseName}.webp`;
  const mainWebpPath = path.join(imagesDir, mainWebpName);

  await sharp(inputPath)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(mainWebpPath);

  const variants: Record<string, string> = {};
  for (const w of sizes) {
    const name = `${baseName}-${w}w.webp`;
    const out = path.join(imagesDir, name);
    await sharp(inputPath)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(out);
    variants[`${w}w`] = rel(name);
  }

  const thumbName = `${baseName}-thumb.webp`;
  const thumbPath = path.join(imagesDir, thumbName);
  await sharp(inputPath)
    .rotate()
    .resize(300, 300, { fit: 'cover', position: 'attention' as any })
    .webp({ quality: 70 })
    .toFile(thumbPath);

  return {
    url: rel(mainWebpName),
    absoluteUrl: abs(rel(mainWebpName)),
    variants,
    thumbnail: rel(thumbName),
  };
}

// POST /api/uploads/images
router.post(
  '/images',
  uploadLimiter,
  protect,
  admin,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req as any, res as any, async (err: any) => {
      if (err) return next(err);
      const anyReq = req as any;
      if (!anyReq.file) return res.status(400).json({ message: 'No file uploaded' });

      try {
        let responseData: any;
        let cloudinaryPublicId: string | undefined;

        if (storageCfg.provider === 'cloudinary') {
          const url = anyReq.file.path;
          cloudinaryPublicId = anyReq.file.filename;
          responseData = {
            url,
            absoluteUrl: url,
            thumbnail: url,
            provider: 'cloudinary'
          };
        } else {
          const originalPath = (anyReq.file as any).path || path.join(imagesDir, anyReq.file.filename);
          const baseName = path.parse(anyReq.file.filename).name;
          const optimized = await optimizeImage(originalPath, baseName);
          responseData = { ...optimized, provider: 'local' };
        }

        // Create UploadedImage tracking record
        try {
          await UploadedImage.create({
            url: responseData.absoluteUrl || responseData.url,
            filename: anyReq.file.originalname,
            provider: storageCfg.provider,
            uploadedBy: (req as any).user._id,
            size: anyReq.file.size,
            mimeType: anyReq.file.mimetype,
            cloudinaryId: cloudinaryPublicId,
            isUsed: false,
            usedIn: [],
            markedForDeletion: false,
            deletionScheduledAt: null,
          });
        } catch (trackingError) {
          console.error('Failed to create upload tracking record:', trackingError);
        }

        return res.status(201).json(responseData);
      } catch (e: any) {
        if (storageCfg.provider === 'cloudinary') {
          return res.status(201).json({
            url: anyReq.file.path,
            absoluteUrl: anyReq.file.path,
            provider: 'cloudinary'
          });
        } else {
          const relPath = `/uploads/images/${anyReq.file.filename}`;
          const absolute = `${server.baseUrl.replace(/\/$/, '')}${relPath}`;
          return res.status(201).json({ url: relPath, absoluteUrl: absolute, provider: 'local' });
        }
      }
    });
  }
);

router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err && (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE')) {
    return res.status(400).json({ message: err.message || 'Upload error' });
  }
  if (err instanceof Error) {
    return res.status(400).json({ message: err.message });
  }
  return res.status(500).json({ message: 'Upload failed' });
});

export default router;