const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];
const MAX_SIZE = 50 * 1024 * 1024;

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

async function processImage(req, res, next) {
  if (!req.file || !req.file.mimetype.startsWith("image/")) return next();

  const filePath = req.file.path;
  const tmpPath = filePath + ".tmp.jpg";

  try {
    await sharp(filePath)
      .resize(1200, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(tmpPath);

    fs.unlinkSync(filePath);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error("Image processing failed:", err);
  }
  next();
}

const bannerUpload = createUploader("banners");
const postImgUpload = createUploader("posts");

module.exports = { bannerUpload, postImgUpload, createUploader, processImage };
