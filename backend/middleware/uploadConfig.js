const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const hostingerPersistentDir = process.env.HOME
  ? path.join(process.env.HOME, 'domains', 'naturanzafood.com', 'persistent-uploads', 'images')
  : null;
const uploadsBaseDir =
  process.env.UPLOADS_DIR ||
  (hostingerPersistentDir && fs.existsSync(hostingerPersistentDir)
    ? hostingerPersistentDir
    : path.join(__dirname, '..', '..', '..', 'persistent-uploads', 'images'));
const uploadsDir = path.join(uploadsBaseDir, 'admins');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'admin-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (!mimetype || !extname) {
    return cb(new Error('Only image files are allowed!'));
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

const validateUploadedImage = async (filePath) => {
  try {
    await sharp(filePath).metadata();
    return true;
  } catch {
    try { fs.unlinkSync(filePath); } catch (_) {}
    return false;
  }
};

module.exports = upload;
module.exports.validateUploadedImage = validateUploadedImage;
