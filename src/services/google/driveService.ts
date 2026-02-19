/**
 * Google Drive Service
 * 
 * Handles client-side interaction with Google Drive API.
 */

const DRIVE_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_METADATA_URL = 'https://www.googleapis.com/drive/v3/files';

export const driveService = {
  /**
   * Upload a file to Google Drive
   */
  uploadFile: async (token: string, file: File | Blob, name: string, folderId?: string) => {
    const metadata = {
      name,
      parents: folderId ? [folderId] : undefined,
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const response = await fetch(`${DRIVE_API_URL}?uploadType=multipart&fields=id,name,webContentLink,size,mimeType`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Drive Upload Failed');
    }

    return await response.json();
  },

  /**
   * Update an existing file's content
   */
  updateFileContent: async (token: string, fileId: string, content: string | Blob) => {
    const response = await fetch(`${DRIVE_API_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: content,
    });

    if (!response.ok) throw new Error('Drive Update Failed');
    return await response.json();
  },

  /**
   * Delete a file
   */
  deleteFile: async (token: string, fileId: string) => {
    const response = await fetch(`${DRIVE_METADATA_URL}/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Drive Delete Failed');
    return true;
  },

  /**
   * Create a subfolder inside a parent if it doesn't exist
   */
  ensureSubFolder: async (token: string, parentId: string, name: string) => {
    const query = encodeURIComponent(`name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const res = await fetch(`${DRIVE_METADATA_URL}?q=${query}&fields=files(id, name)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    const createRes = await fetch(DRIVE_METADATA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parents: [parentId],
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const folder = await createRes.json();
    return folder.id;
  },

  /**
   * Create the Cyberia root folder if it doesn't exist
   */
  ensureRootFolder: async (token: string) => {
    // Check if "Cyberia" folder exists
    const query = encodeURIComponent("name = 'Cyberia' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const res = await fetch(`${DRIVE_METADATA_URL}?q=${query}&fields=files(id, name)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create it
    const createRes = await fetch(DRIVE_METADATA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Cyberia',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const folder = await createRes.json();
    return folder.id;
  },

  /**
   * Download a file's binary content
   */
  downloadFile: async (token: string, fileId: string) => {
    const response = await fetch(`${DRIVE_METADATA_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Drive Download Failed');
    return await response.blob();
  }
};
