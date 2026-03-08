import re

path = 'src/services/supabaseStorage.ts'
with open(path, 'r') as f:
    content = f.read()

new_method = """
  async deleteAllUserFiles(userId: string): Promise<number> {
    console.log('[Storage] Starting full user directory wipe for:', userId);
    try {
      const itemsToDelete: string[] = [];
      const { data: rootItems, error: rootError } = await storageClient
        .storage
        .from(BUCKET_NAME)
        .list(userId, { limit: 1000 });

      if (rootError) throw rootError;
      if (!rootItems || rootItems.length === 0) return 0;

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
"""

# Insert before checkFileSize
content = content.replace('  checkFileSize(file: File | Blob):', new_method + '\n  checkFileSize(file: File | Blob):')

with open(path, 'w') as f:
    f.write(content)
