/**
 * Detects the image type from magic bytes.
 */
export const detectImageType = async (blob: Blob): Promise<string> => {
  const buffer = await blob.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // GIF: GIF8 (47 49 46 38)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  
  return blob.type || 'application/octet-stream';
};

/**
 * Generates a compressed static thumbnail for an image or GIF.
 * This is used for the spatial map preview to keep metadata small and fast.
 */
export const generateThumbnail = async (file: File | Blob, maxWidth = 400, maxHeight = 400, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        // ALWAYS export as JPEG for the map thumbnail.
        // This keeps the spatial metadata extremely small and ensures the map stays fast.
        // High-res and animations are handled via the original blob in Focus Mode.
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file for thumbnail'));
    reader.readAsDataURL(file);
  });
};

/**
 * Generates a compressed static thumbnail for a video file by capturing a frame.
 */
export const generateVideoThumbnail = async (file: File | Blob, seekSeconds = 1, maxWidth = 400, maxHeight = 400, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Seek to the requested time (or the start if the video is short)
      video.currentTime = Math.min(seekSeconds, video.duration);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        cleanup();
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      cleanup();
      resolve(dataUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video for thumbnail'));
    };
    
    // Timeout if video fails to seek/load in 5 seconds
    setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail generation timed out'));
    }, 5000);
  });
};
