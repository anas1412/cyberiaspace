/**
 * File Resolver for AI
 *
 * Reads files from IndexedDB and converts them into OpenRouter-compatible content blocks.
 * - Images: base64 data URL, resized to max 1024px if larger
 * - PDFs: text extraction via pdfjs (first 20 pages, max 50KB)
 * - Text: content returned as-is
 */

import type { Thought } from '../../db';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

const MAX_IMAGE_DIMENSION = 1024;
const MAX_PDF_PAGES = 20;
const MAX_PDF_TEXT_LENGTH = 50 * 1024; // 50KB
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB — skip PDFs larger than this

/**
 * Read a thought's blob from IndexedDB by thoughtId
 */
async function getThoughtBlob(thoughtId: string): Promise<Blob | null> {
  try {
    const { db } = await import('../../db');
    const entry = await db.blobs
      .where('thoughtId')
      .equals(thoughtId)
      .first();
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if a thought is an image type by its meta or text extension
 */
function isImageThought(thought: Thought): boolean {
  const fileMeta = thought.meta?.file;
  if (fileMeta?.isImage) return true;
  if (fileMeta?.type?.startsWith('image/')) return true;
  if (thought.data?.type === 'file' && thought.data.meta?.isImage) return true;
  if (thought.text?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return true;
  return false;
}

/**
 * Check if a thought is a PDF by its meta or text extension
 */
function isPdfThought(thought: Thought): boolean {
  const fileMeta = thought.meta?.file;
  if (fileMeta?.isPdf) return true;
  if (fileMeta?.type?.includes('pdf')) return true;
  if (thought.text?.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

/**
 * Decode an image Blob to an HTMLImageElement
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
 * Resize image to fit within MAX_IMAGE_DIMENSION on the longest edge,
 * then convert to JPEG base64 at 80% quality.
 * If image is within limits, return original dimensions.
 */
async function imageToBase64(blob: Blob): Promise<string> {
  const img = await blobToImage(blob);

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // Only downscale if the longest edge exceeds the limit
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
      height = MAX_IMAGE_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Extract text from a PDF blob using pdfjs-dist
 */
async function extractPdfText(blob: Blob): Promise<string> {
  // Dynamically set up pdfjs worker (needed for Vite bundling)
  const pdfjs = await import('pdfjs-dist');

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    // Use ?url import for Vite to copy worker to dist
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;

  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const textParts: string[] = [];
  let totalLength = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');

    if (totalLength + pageText.length > MAX_PDF_TEXT_LENGTH) {
      const remaining = MAX_PDF_TEXT_LENGTH - totalLength;
      textParts.push(pageText.slice(0, remaining) + '…');
      break;
    }

    textParts.push(pageText);
    totalLength += pageText.length;
  }

  await loadingTask.destroy();
  return textParts.join('\n\n').trim();
}

/**
 * Resolve a thought's file content into OpenRouter-compatible content blocks.
 *
 * Usage in @reference flow (referenceParser.ts):
 *   const blocks = await resolveFileForAI(thought);
 *
 * Usage in read_file_content tool (executor.ts):
 *   const blocks = await resolveFileForAI(thought);
 *   return { success: true, blocks, name: thought.text };
 */
export async function resolveFileForAI(thought: Thought): Promise<ContentBlock[]> {
  // 1. Text thought — return text content directly
  if (thought.data?.type === 'text') {
    return [{ type: 'text', text: thought.data.content || '' }];
  }

  // 2. Tasks thought — render task list
  if (thought.data?.type === 'tasks') {
    const tasks = (thought.data.tasks || [])
      .map((t: any) => `${t.done ? '[x]' : '[ ]'} ${t.text}`)
      .join('\n');
    return [{ type: 'text', text: `${thought.text}\n${tasks}` }];
  }

  // 3. File thought — read from IndexedDB blob
  if (thought.type === 'file' || thought.data?.type === 'file') {
    const blob = await getThoughtBlob(thought.id);
    if (!blob) {
      return [{ type: 'text', text: `[File: ${thought.text}]` }];
    }

    // Image → resize + base64
    if (isImageThought(thought)) {
      try {
        const dataUrl = await imageToBase64(blob);
        return [{ type: 'image_url', image_url: { url: dataUrl } }];
      } catch {
        return [{ type: 'text', text: `[Image: ${thought.text}]` }];
      }
    }

    // PDF → extract text
    if (isPdfThought(thought)) {
      if (blob.size > MAX_PDF_SIZE) {
        return [{ type: 'text', text: `[PDF too large to extract: ${thought.text}]` }];
      }
      try {
        const text = await extractPdfText(blob);
        if (!text) {
          return [{ type: 'text', text: `[PDF: ${thought.text} — no extractable text]` }];
        }
        return [{ type: 'text', text: `PDF "${thought.text}" content:\n\n${text}` }];
      } catch (err) {
        console.error('[FileResolver] PDF extraction failed:', err);
        return [{ type: 'text', text: `[PDF: ${thought.text}]` }];
      }
    }

    // Other file type → just name
    return [{ type: 'text', text: `[File: ${thought.text}]` }];
  }

  // 4. Default — return thought text
  return [{ type: 'text', text: thought.text || 'Untitled' }];
}
