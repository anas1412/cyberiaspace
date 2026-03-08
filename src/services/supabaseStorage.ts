import { supabase } from './supabase'

export const storageClient = supabase

const BUCKET_NAME = 'user-files'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

export const supabaseStorage = {
  async uploadFile(
    userId: string, 
    file: File | Blob, 
    fileName: string,
    thoughtId?: number | string
  ): Promise<{ url: string; path: string; size: number }> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`)
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = thoughtId ? `${userId}/${thoughtId}/${safeName}` : `${userId}/${safeName}`;
    
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

  async getSignedUrl(storagePath: string, _expiresIn = 3600): Promise<string> {
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


  async deleteAllUserFiles(userId: string): Promise<number> {
    console.log('[Storage] Starting full user directory wipe for:', userId);
    try {
      const { data: rootItems, error: rootError } = await storageClient
        .storage
        .from(BUCKET_NAME)
        .list(userId, { limit: 1000 });

      if (rootError) throw rootError;
      if (!rootItems || rootItems.length === 0) return 0;

      const itemsToDelete = [];
      for (const item of rootItems) {
        if (!item.id) { // Folder
          const { data: folderFiles } = await storageClient
            .storage
            .from(BUCKET_NAME)
            .list(`${userId}/${item.name}`, { limit: 1000 });
          
          if (folderFiles && folderFiles.length > 0) {
            folderFiles.forEach(f => itemsToDelete.push(`${userId}/${item.name}/${f.name}`));
          }
        } else { // File
          itemsToDelete.push(`${userId}/${item.name}`);
        }
      }

      if (itemsToDelete.length === 0) return 0;
      const batchSize = 10;
      for (let i = 0; i < itemsToDelete.length; i += batchSize) {
        await storageClient.storage.from(BUCKET_NAME).remove(itemsToDelete.slice(i, i + batchSize));
      }
      return itemsToDelete.length;
    } catch (err) {
      console.error('[Storage] Full wipe failed:', err);
      return 0;
    }
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
    console.log('[Storage] Starting structural orphan cleanup for user:', userId);
    console.log(`[Storage] Index of valid paths: ${validPaths.size} items`);
    
    try {
      const itemsToDelete: string[] = [];
      
      // 1. List all items in userId/
      const { data: rootItems, error: rootError } = await storageClient
        .storage
        .from(BUCKET_NAME)
        .list(userId, { limit: 1000 });

      if (rootError) {
        console.error('[Storage] List root items error:', rootError);
        return 0;
      }

      if (!rootItems || rootItems.length === 0) {
        console.log('[Storage] No items found in user directory');
        return 0;
      }

      console.log(`[Storage] Analyzing ${rootItems.length} root items...`);

      for (const item of rootItems) {
        // id is null for folders
        const isFolder = !item.id;
        const itemName = item.name;

        if (isFolder) {
          // New style: numeric folder name (thoughtId)
          const folderPathPrefix = `${userId}/${itemName}/`;
          const isFolderValid = Array.from(validPaths).some(p => p.startsWith(folderPathPrefix));

          // List files inside that folder
          const { data: folderFiles, error: folderError } = await storageClient
            .storage
            .from(BUCKET_NAME)
            .list(`${userId}/${itemName}`, { limit: 1000 });

          if (folderError) {
            console.warn(`[Storage] Error listing folder ${itemName}:`, folderError);
            continue;
          }

          if (!isFolderValid) {
            // Orphaned thought folder - delete all files inside it
            console.log(`[Storage] Orphaned folder detected: ${itemName} (not in valid index)`);
            if (folderFiles && folderFiles.length > 0) {
              folderFiles.forEach(f => {
                itemsToDelete.push(`${userId}/${itemName}/${f.name}`);
              });
            } else {
              // Empty folders technically don't exist in Supabase storage, 
              // but if we encounter one we should try to clear it
              // (actually just skipping it is fine as it's virtual)
            }
          } else {
            // Folder is valid, but check if individual files inside are valid
            if (folderFiles && folderFiles.length > 0) {
              for (const f of folderFiles) {
                const fullPath = `${userId}/${itemName}/${f.name}`;
                if (!validPaths.has(fullPath)) {
                  console.log(`[Storage] Orphaned file in valid folder detected: ${fullPath}`);
                  itemsToDelete.push(fullPath);
                }
              }
            }
          }
        } else {
          // Legacy style: file directly in userId/
          const fullPath = `${userId}/${itemName}`;
          if (!validPaths.has(fullPath)) {
            console.log(`[Storage] Orphaned legacy file detected: ${fullPath}`);
            itemsToDelete.push(fullPath);
          }
        }
      }

      console.log(`[Storage] Total items to delete: ${itemsToDelete.length}`);

      if (itemsToDelete.length === 0) {
        return 0;
      }

      // Batch delete items
      const batchSize = 10;
      for (let i = 0; i < itemsToDelete.length; i += batchSize) {
        const batch = itemsToDelete.slice(i, i + batchSize);
        console.log(`[Storage] Deleting batch ${i / batchSize + 1}...`);
        const { error } = await storageClient
          .storage
          .from(BUCKET_NAME)
          .remove(batch);

        if (error) {
          console.error('[Storage] Failed to delete batch:', error);
        }
      }

      console.log(`[Storage] Successfully cleaned up ${itemsToDelete.length} orphaned items`);
      return itemsToDelete.length;
    } catch (err) {
      console.error('[Storage] Orphan structural cleanup failed:', err);
      return 0;
    }
  },
}
