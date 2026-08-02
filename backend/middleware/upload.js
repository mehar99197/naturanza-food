const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
const UPLOADS_IMAGES_DIR =
    process.env.UPLOADS_DIR ||
    path.join(__dirname, '..', '..', '..', 'persistent-uploads', 'images');

// Configure multer for memory storage (we'll process before saving)
const storage = multer.memoryStorage();

// File filter - only accept images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
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
        // fileFilter only checks the attacker-controlled extension + mimetype;
        // sharp auto-detects the true format from the bytes. Cap the decode and
        // reject non-raster/oversized inputs BEFORE resizing so a vector (SVG) or a
        // tiny, highly-compressed pixel-flood PNG can't drive huge allocations
        // (CWE-434 / decompression DoS). The allocation happens at decode, before
        // the resize, so `withoutEnlargement` does not help on its own.
        const MAX_INPUT_PIXELS = 24_000_000; // ~24 MP
        const RASTER_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif']);

        const metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
        if (!RASTER_FORMATS.has(metadata.format)) {
            throw new Error('Unsupported image format');
        }
        if (metadata.width && metadata.height && metadata.width * metadata.height > MAX_INPUT_PIXELS) {
            throw new Error('Image dimensions exceed the allowed limit');
        }

        let sharpInstance = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
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
            // field arriving alongside an upload used to skip it entirely while
            // the rest of the codebase assumed all input had been scrubbed.
            // Apply the same pass here, now that multer has populated req.body.
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

                // Unguessable filename. `Date.now()` + `Math.random()` was both
                // predictable and only ~36 bits of entropy — for the
                // payment-verification folder (bank screenshots with account
                // numbers and amounts) the filename is part of the access
                // control, so it must be cryptographically random.
                const filename = `${crypto.randomBytes(24).toString('hex')}.webp`;
                const filepath = path.join(uploadDir, filename);

                // Compress the image (default to WebP)
                const compressedBuffer = await compressImage(req.file.buffer, {
                    ...options,
                    format: 'webp'
                });

                // Save compressed image
                fs.writeFileSync(filepath, compressedBuffer);

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
};
