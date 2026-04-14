const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Optimize a single image
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save optimized image
 * @param {object} options - Optimization options
 * @returns {Promise<string>} - Path to optimized image
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  const {
    width = 800,
    height = 800,
    quality = 80,
    format = 'webp'
  } = options;

  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(format, { quality })
      .toFile(outputPath);

    console.log(`✅ Image optimized: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Image optimization error:', error);
    throw error;
  }
}

/**
 * Create multiple size variants of an image
 * @param {string} inputPath - Path to original image
 * @param {string} baseName - Base name for output files (without extension)
 * @param {string} outputDir - Directory to save variants
 * @returns {Promise<object>} - Object with paths to all variants
 */
async function createImageVariants(inputPath, baseName, outputDir = 'public/uploads/products') {
  const variants = {
    thumbnail: { width: 200, height: 200 },
    small: { width: 400, height: 400 },
    medium: { width: 800, height: 800 },
    large: { width: 1200, height: 1200 }
  };

  const results = {};

  try {
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Create each variant
    for (const [size, dimensions] of Object.entries(variants)) {
      const outputPath = path.join(outputDir, `${baseName}-${size}.webp`);
      await optimizeImage(inputPath, outputPath, dimensions);
      results[size] = outputPath.replace('public/', '/'); // Return web-accessible path
    }

    console.log(`✅ Created ${Object.keys(variants).length} variants for ${baseName}`);
    return results;
  } catch (error) {
    console.error('❌ Error creating image variants:', error);
    throw error;
  }
}

/**
 * Convert image to WebP format
 * @param {string} inputPath - Path to input image
 * @param {number} quality - Quality (1-100)
 * @returns {Promise<string>} - Path to WebP image
 */
async function convertToWebP(inputPath, quality = 80) {
  const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  try {
    await sharp(inputPath)
      .webp({ quality })
      .toFile(outputPath);

    console.log(`✅ Converted to WebP: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ WebP conversion error:', error);
    throw error;
  }
}

/**
 * Optimize and resize product image
 * @param {object} file - Multer file object
 * @param {string} outputDir - Output directory
 * @returns {Promise<object>} - Object with original and optimized paths
 */
async function optimizeProductImage(file, outputDir = 'public/uploads/products') {
  try {
    const timestamp = Date.now();
    const baseName = `product-${timestamp}`;
    const originalPath = file.path;

    // Create variants
    const variants = await createImageVariants(originalPath, baseName, outputDir);

    // Delete original uploaded file if it's not already WebP
    if (!originalPath.endsWith('.webp')) {
      await fs.unlink(originalPath).catch(() => {});
    }

    return {
      original: originalPath,
      variants,
      primary: variants.medium // Use medium as primary display image
    };
  } catch (error) {
    console.error('❌ Error optimizing product image:', error);
    throw error;
  }
}

/**
 * Batch optimize images in a directory
 * @param {string} inputDir - Input directory
 * @param {string} outputDir - Output directory
 * @returns {Promise<number>} - Number of images optimized
 */
async function batchOptimizeImages(inputDir, outputDir) {
  try {
    const files = await fs.readdir(inputDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );

    let count = 0;
    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file);
      const baseName = path.basename(file, path.extname(file));
      await createImageVariants(inputPath, baseName, outputDir);
      count++;
    }

    console.log(`✅ Batch optimized ${count} images`);
    return count;
  } catch (error) {
    console.error('❌ Batch optimization error:', error);
    throw error;
  }
}

module.exports = {
  optimizeImage,
  createImageVariants,
  convertToWebP,
  optimizeProductImage,
  batchOptimizeImages
};
