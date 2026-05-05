// src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

function createUploader(folder) {
  const dest = path.join(process.cwd(), "uploads", folder);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new Error(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`),
        false,
      );
  };

  return multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });
}

const bannerUpload = createUploader("banners");
const postImgUpload = createUploader("posts");

module.exports = { bannerUpload, postImgUpload };
