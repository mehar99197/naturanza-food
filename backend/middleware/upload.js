const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { optimizeProductImage } = require('../utils/imageOptimizer');

// Ensure upload directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

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
                // Ensure upload directory exists
                const uploadDir = path.join(__dirname, '..', '..', 'public', 'images', folder);
                ensureDir(uploadDir);

                // Generate unique filename (use WebP extension)
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(2, 8);
                const filename = `${timestamp}-${randomString}.webp`;
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

                console.log(`✅ Image compressed and saved: ${filename} (${(compressedBuffer.length / 1024).toFixed(2)}KB)`);

                next();
            } catch (error) {
                console.error('Image compression error:', error);
                res.status(500).json({ 
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

module.exports = {
    upload,
    compressImage,
    uploadAndCompress,
    uploadProfileImage,
    uploadProductImage,
    uploadCategoryImage
};
