import { supabase } from './supabase'

export const storageClient = supabase

const BUCKET_NAME = 'user-files'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export const supabaseStorage = {
  async uploadFile(
    userId: string, 
    file: File | Blob, 
    fileName: string
  ): Promise<{ url: string; path: string; size: number }> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`)
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = `${userId}/${safeName}`
    
    // Just upload with upsert - don't check if file exists
    // This prevents the re-upload bug
    const { error } = await storageClient
      .storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      })

    if (error) {
      console.error('[Storage] Upload error:', error)
      throw new Error(`Upload failed: ${error.message}`)
    }

    const { data: urlData } = storageClient
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    console.log('[Storage] Upload success:', path)
    
    return {
      url: urlData.publicUrl,
      path: path,
      size: file.size,
    }
  },

  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await storageClient
      .storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (error) {
      console.error('[Storage] Delete error:', error)
      throw new Error(`Delete failed: ${error.message}`)
    }

    console.log('[Storage] Deleted:', storagePath)
  },

  async getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    // Bucket is public, use getPublicUrl for direct access
    const { data } = await storageClient
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    return data.publicUrl
  },

  async listFiles(userId: string): Promise<{ name: string; size: number }[]> {
    const { data, error } = await storageClient
      .storage
      .from(BUCKET_NAME)
      .list(userId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      })

    if (error) {
      console.error('[Storage] List error:', error)
      throw new Error(`List failed: ${error.message}`)
    }

    return data.map(f => ({ name: f.name, size: f.metadata?.size || 0 }))
  },

  async fileExists(userId: string, fileName: string): Promise<boolean> {
    try {
      const fullPath = fileName.includes('/') ? fileName : `${userId}/${fileName}`;
      // Use getPublicUrl since bucket is public
      const { data } = await storageClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(fullPath);
      
      // If publicUrl is returned, file exists
      return !!data.publicUrl;
    } catch (err) {
      console.error('[Storage] fileExists failed:', err);
      return false;
    }
  },

  async checkFileAccessible(storagePath: string): Promise<boolean> {
    try {
      // Use getPublicUrl since bucket is public
      const { data } = await storageClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(storagePath);
      
      return !!data.publicUrl;
    } catch (err) {
      console.error('[Storage] checkFileAccessible failed:', err);
      return false;
    }
  },

  async getStorageUsage(userId: string): Promise<number> {
    const files = await supabaseStorage.listFiles(userId)
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    return totalBytes
  },

  checkFileSize(file: File | Blob): { valid: boolean; message?: string } {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        message: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      }
    }
    return { valid: true }
  },

  async cleanupOrphanedFiles(userId: string, validPaths: Set<string>): Promise<number> {
    console.log('[Storage] Starting orphan cleanup for user:', userId);
    
    try {
      let allFiles: { name: string }[] = [];
      let offset = 0;
      const limit = 100;
      
      while (true) {
        const { data, error } = await storageClient
          .storage
          .from(BUCKET_NAME)
          .list(userId, { limit, offset });

        if (error) {
          console.error('[Storage] List error during cleanup:', error);
          break;
        }

        if (!data || data.length === 0) break;
        
        allFiles = allFiles.concat(data);
        offset += limit;
        
        if (data.length < limit) break;
      }

      console.log(`[Storage] Found ${allFiles.length} files in bucket`);

      const orphans = allFiles.filter(f => {
        const fullPath = `${userId}/${f.name}`;
        return !validPaths.has(fullPath);
      });

      console.log(`[Storage] Found ${orphans.length} orphaned files`);

      if (orphans.length === 0) {
        return 0;
      }

      const pathsToDelete = orphans.map(f => `${userId}/${f.name}`);
      const batchSize = 10;
      
      for (let i = 0; i < pathsToDelete.length; i += batchSize) {
        const batch = pathsToDelete.slice(i, i + batchSize);
        const { error } = await storageClient
          .storage
          .from(BUCKET_NAME)
          .remove(batch);

        if (error) {
          console.error('[Storage] Failed to delete orphan batch:', error);
        }
      }

      console.log(`[Storage] Cleaned up ${orphans.length} orphaned files`);
      return orphans.length;
    } catch (err) {
      console.error('[Storage] Orphan cleanup failed:', err);
      return 0;
    }
  },
}
