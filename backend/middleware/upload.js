const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { optimizeProductImage } = require('../utils/imageOptimizer');
const { sanitizeObject } = require('./security');

// Ensure upload directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Base directory for user uploads. MUST live OUTSIDE the git-deployed app tree
// so customer uploads (payment screenshots, product/category/avatar images)
// survive a redeploy (which clears the repo working tree). Defaults to a
// sibling `persistent-uploads/images` of the app root; override via UPLOADS_DIR.
const hostingerPersistentDir = process.env.HOME
    ? path.join(process.env.HOME, 'domains', 'naturanzafood.com', 'persistent-uploads', 'images')
    : null;
const UPLOADS_IMAGES_DIR =
    process.env.UPLOADS_DIR ||
    (hostingerPersistentDir && fs.existsSync(hostingerPersistentDir)
        ? hostingerPersistentDir
        : path.join(__dirname, '..', '..', '..', 'persistent-uploads', 'images'));

// Upload folders that may be served as public static assets, and those that must
// never be. Payment screenshots carry customer bank details, phone numbers and
// transaction IDs; they are reachable only through the authenticated admin
// endpoint in routes/adminPayments.js. index.js mounts the public folders one by
// one from these lists so a private folder never sits inside a static root.
const PUBLIC_UPLOAD_FOLDERS = ['products', 'categories', 'avatars', 'blog'];
const PRIVATE_UPLOAD_FOLDERS = new Set(['payment-verifications']);

// Configure multer for memory storage (we'll process before saving)
const storage = multer.memoryStorage();

// File filter - validate extension + declared type. Content is verified later by
// sharp in compressImage(), which re-encodes everything to WebP.
//
// Exact matches, not a bare /jpeg|jpg|png|gif|webp/ test: that pattern was
// unanchored, so it accepted any type merely CONTAINING one of those words
// (e.g. "application/x-jpeg-thing") and any filename containing "png".
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp']);
const ALLOWED_IMAGE_MIMETYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
]);

const fileFilter = (req, file, cb) => {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    const mimetype = String(file.mimetype || '').trim().toLowerCase().split(';')[0];

    if (ALLOWED_IMAGE_EXTENSIONS.has(extension) && ALLOWED_IMAGE_MIMETYPES.has(mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'), false);
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});

// Image compression function with WebP support
const compressImage = async (buffer, options = {}) => {
    const {
        width = 800,
        height = 800,
        quality = 80,
        fit = 'inside',
        format = 'webp' // Default to WebP for better compression
    } = options;

    try {
        let sharpInstance = sharp(buffer)
            .resize(width, height, {
                fit: fit,
                withoutEnlargement: true // Don't enlarge smaller images
            });

        // Apply format-specific compression
        if (format === 'webp') {
            sharpInstance = sharpInstance.webp({ quality: quality });
        } else if (format === 'jpeg' || format === 'jpg') {
            sharpInstance = sharpInstance.jpeg({ quality: quality, progressive: true });
        } else if (format === 'png') {
            sharpInstance = sharpInstance.png({ quality: quality, compressionLevel: 9 });
        }

        const compressed = await sharpInstance.toBuffer();
        return compressed;
    } catch (error) {
        throw new Error(`Image compression failed: ${error.message}`);
    }
};

// Middleware to handle image upload and compression
const uploadAndCompress = (fieldName, folder = 'products', options = {}) => {
    return async (req, res, next) => {
        // Use multer to handle the upload
        upload.single(fieldName)(req, res, async (err) => {
            // Clean up: remove the file field from req.body to avoid clashes with restrictBody
            if (req.body && req.body[fieldName] !== undefined) {
                delete req.body[fieldName];
            }

            // The app-wide sanitizeRequestBody in index.js runs BEFORE routing,
            // when a multipart body has not been parsed yet — so every text
            // field arriving alongside an upload skipped it entirely while the
            // rest of the codebase assumed all input had been scrubbed.
            if (req.body && typeof req.body === 'object') {
                req.body = sanitizeObject(req.body);
            }

            if (err) {
                if (err instanceof multer.MulterError) {
                    return res.status(400).json({ 
                        error: `Upload error: ${err.message}` 
                    });
                }
                return res.status(400).json({ 
                    error: err.message 
                });
            }

            // If no file uploaded, continue
            if (!req.file) {
                return next();
            }

            try {
                // Ensure upload directory exists (persistent, outside the repo tree)
                const uploadDir = path.join(UPLOADS_IMAGES_DIR, folder);
                ensureDir(uploadDir);

                // crypto.randomUUID, not Date.now + 6 chars of Math.random:
                // two uploads landing in the same millisecond had a real chance
                // of colliding, and the loser silently overwrote another
                // customer's file — including payment screenshots.
                const filename = `${crypto.randomUUID()}.webp`;
                const filepath = path.join(uploadDir, filename);

                // Compress the image (default to WebP)
                const compressedBuffer = await compressImage(req.file.buffer, {
                    ...options,
                    format: 'webp'
                });

                // Async write: writeFileSync blocked the event loop for the whole
                // write, stalling every other in-flight request behind an upload.
                await fs.promises.writeFile(filepath, compressedBuffer);

                // Add file info to request
                req.file.compressedPath = filepath;
                req.file.compressedFilename = filename;
                req.file.url = `/images/${folder}/${filename}`;


                next();
            } catch (error) {
                return res.status(500).json({ 
                    error: `Failed to process image: ${error.message}` 
                });
            }
        });
    };
};

// Profile image upload (smaller size, optimized for avatars)
const uploadProfileImage = uploadAndCompress('profile_image', 'avatars', {
    width: 400,
    height: 400,
    quality: 85,
    fit: 'cover' // Crop to square
});

// Product image upload
const uploadProductImage = uploadAndCompress('product_image', 'products', {
    width: 800,
    height: 800,
    quality: 80,
    fit: 'inside'
});

// Category image upload
const uploadCategoryImage = uploadAndCompress('category_image', 'categories', {
    width: 600,
    height: 400,
    quality: 80,
    fit: 'cover'
});

// Blog cover image upload (1200x630 = social/OG card ratio)
const uploadBlogImage = uploadAndCompress('blog_image', 'blog', {
    width: 1200,
    height: 630,
    quality: 80,
    fit: 'cover'
});

module.exports = {
    upload,
    compressImage,
    uploadAndCompress,
    uploadProfileImage,
    uploadProductImage,
    uploadCategoryImage,
    uploadBlogImage,
    UPLOADS_IMAGES_DIR,
    PUBLIC_UPLOAD_FOLDERS,
    PRIVATE_UPLOAD_FOLDERS,
};
