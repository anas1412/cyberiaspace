import { supabase } from './supabase'
import { MAX_UPLOAD_SIZE } from '../constants'

export const storageClient = supabase

const BUCKET_NAME = 'user-files'

// ==========================================
// Signed URL Cache
// ==========================================
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const getCachedSignedUrl = (path: string): string | null => {
  const cached = signedUrlCache.get(path);
  // Refresh 60s before expiry to avoid edge cases
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.url;
  }
  return null;
};

const setCachedSignedUrl = (path: string, url: string, expiresIn: number) => {
  signedUrlCache.set(path, {
    url,
    expiresAt: Date.now() + (expiresIn * 1000)
  });
};

export const isStorageUrl = (value: string): boolean =>
  value.startsWith('https://') || value.startsWith('http://');

export const supabaseStorage = {
  // ==========================================
  // Signed URL Generation (via API endpoint)
  // ==========================================
  async getSignedUrl(storagePath: string, expiresIn: number = 3600): Promise<string> {
    // Check cache first
    const cached = getCachedSignedUrl(storagePath);
    if (cached) return cached;

    // Get auth token for API call
    const { useAuthStore } = await import('../store/useAuthStore');
    const token = await useAuthStore.getState().getSessionToken();
    if (!token) {
      throw new Error('Not authenticated — cannot get signed URL');
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'getSignedUrl',
        path: storagePath,
        expiresIn,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to get signed URL: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Failed to get signed URL: ${data.error}`);
    }

    // Cache the result
    setCachedSignedUrl(storagePath, data.url, data.expiresIn || expiresIn);

    return data.url;
  },

  // ==========================================
  // File Upload (still uses client SDK with RLS)
  // ==========================================
  async uploadFile(
    userId: string, 
    file: File | Blob, 
    fileName: string,
    thoughtId?: number | string
  ): Promise<{ url: string; path: string; size: number }> {
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024} MB`)
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const path = thoughtId ? `${userId}/${thoughtId}/${safeName}` : `${userId}/${safeName}`;
    
    // Upload with upsert - RLS handles auth
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

    // Get signed URL instead of public URL (bucket is now private)
    const signedUrl = await this.getSignedUrl(path);

    console.log('[Storage] Upload success:', path)
    
    return {
      url: signedUrl,
      path: path,
      size: file.size,
    }
  },

  // ==========================================
  // File Deletion
  // ==========================================
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await storageClient
      .storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    if (error) {
      console.error('[Storage] Delete error:', error)
      throw new Error(`Delete failed: ${error.message}`)
    }

    // Invalidate cache for this path
    signedUrlCache.delete(storagePath);

    console.log('[Storage] Deleted:', storagePath)
  },

  // ==========================================
  // File Listing (uses client SDK with RLS)
  // ==========================================
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

  // ==========================================
  // File Existence Check (uses signed URL attempt)
  // ==========================================
  async fileExists(userId: string, fileName: string): Promise<boolean> {
    try {
      const fullPath = fileName.includes('/') ? fileName : `${userId}/${fileName}`;
      // Try to get a signed URL — if it fails, file doesn't exist
      await this.getSignedUrl(fullPath);
      return true;
    } catch (err) {
      console.warn('[Storage] fileExists check failed:', err);
      return false;
    }
  },

  async checkFileAccessible(storagePath: string): Promise<boolean> {
    try {
      await this.getSignedUrl(storagePath);
      return true;
    } catch (err) {
      console.error('[Storage] checkFileAccessible failed:', err);
      return false;
    }
  },

  // ==========================================
  // Storage Usage (RPC)
  // ==========================================
  async getStorageUsage(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_user_storage_size', {
        user_id: userId
      });
      if (error) {
        console.warn('[Storage] get_user_storage_size RPC failed:', error.message);
        return 0;
      }
      return (data as number) || 0;
    } catch (err) {
      console.error('[Storage] getStorageUsage failed:', err);
      return 0;
    }
  },

  // ==========================================
  // Bulk File Deletion (user wipe)
  // ==========================================
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

      // Invalidate cache for all deleted paths
      itemsToDelete.forEach(p => signedUrlCache.delete(p));

      return itemsToDelete.length;
    } catch (err) {
      console.error('[Storage] Full wipe failed:', err);
      return 0;
    }
  },

  checkFileSize(file: File | Blob): { valid: boolean; message?: string } {
    if (file.size > MAX_UPLOAD_SIZE) {
      return {
        valid: false,
        message: `File too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is ${MAX_UPLOAD_SIZE / 1024 / 1024} MB.`,
      }
    }
    return { valid: true }
  },

  // ==========================================
  // Orphaned File Cleanup
  // ==========================================
  async cleanupOrphanedFiles(userId: string, validPaths: Set<string>): Promise<number> {
    console.log('[Storage] Starting structural orphan cleanup for user:', userId);
    console.log(`[Storage] Index of valid paths: ${validPaths.size} items`);
    
    try {
      const itemsToDelete: string[] = [];
      
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
        const isFolder = !item.id;
        const itemName = item.name;

        if (isFolder) {
          const folderPathPrefix = `${userId}/${itemName}/`;
          const isFolderValid = Array.from(validPaths).some(p => p.startsWith(folderPathPrefix));

          const { data: folderFiles, error: folderError } = await storageClient
            .storage
            .from(BUCKET_NAME)
            .list(`${userId}/${itemName}`, { limit: 1000 });

          if (folderError) {
            console.warn(`[Storage] Error listing folder ${itemName}:`, folderError);
            continue;
          }

          if (!isFolderValid) {
            console.log(`[Storage] Orphaned folder detected: ${itemName} (not in valid index)`);
            if (folderFiles && folderFiles.length > 0) {
              folderFiles.forEach(f => {
                itemsToDelete.push(`${userId}/${itemName}/${f.name}`);
              });
            }
          } else {
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

  // ==========================================
  // Background Methods (kept for interface compat, but no-ops)
  // Backgrounds are local-only now — no cloud upload
  // ==========================================
  async uploadSpaceBackground(
    _userId: string,
    _spaceId: string,
    _file: File | Blob,
    _mimeType: string
  ): Promise<{ url: string; path: string }> {
    // No-op: backgrounds are local-only
    console.warn('[Storage] uploadSpaceBackground called but backgrounds are local-only');
    return { url: '', path: '' };
  },

  async deleteSpaceBackground(_userId: string, _spaceId: string): Promise<void> {
    // No-op: backgrounds are local-only, nothing to delete from cloud
    console.warn('[Storage] deleteSpaceBackground called but backgrounds are local-only');
  },
}