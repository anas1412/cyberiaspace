/**
 * Image Processor
 *
 * Compresses images for storage: resizes to fit within a max dimension,
 * then converts to JPEG. Used by the background wallpaper flow.
 */

const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.8;

/**
 * Decode a Blob into an HTMLImageElement.
 */
function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

/**
 * Compress an image Blob/File:
 *  - Resizes so the longest edge ≤ maxDimension (default 1920px)
 *  - Converts to JPEG at the given quality (default 80%)
 *  - Returns a compressed Blob
 *
 * If the image is already within limits, it still re-encodes as JPEG
 * (which typically shrinks PNGs significantly).
 *
 * Falls back to the original blob if anything fails (invalid image,
 * canvas unavailable, etc.).
 */
export async function compressImage(
  blob: Blob,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
): Promise<Blob> {
  let img: HTMLImageElement;
  try {
    img = await blobToImage(blob);
  } catch {
    return blob;
  }

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Only downscale if the longest edge exceeds the limit
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round(height * (maxDimension / width));
      width = maxDimension;
    } else {
      width = Math.round(width * (maxDimension / height));
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (result) => {
        resolve(result ?? blob);
      },
      'image/jpeg',
      quality,
    );
  });
}
