/**
 * Strips the file extension from a filename.
 * Handles common cases including:
 * - Simple extensions: "image.png" → "image"
 * - Multiple dots: "my.file.name.txt" → "my.file.name"
 * - No extension: "README" → "README"
 * - Dotfiles: ".gitignore" → ".gitignore"
 * 
 * @param filename - The full filename with extension
 * @returns The filename without extension
 */
export function stripFileExtension(filename: string): string {
  // Handle dotfiles (hidden files) - keep as is
  if (filename.startsWith('.') && filename.lastIndexOf('.') === 0) {
    return filename;
  }
  
  const lastDotIndex = filename.lastIndexOf('.');
  
  // No extension found
  if (lastDotIndex === -1) {
    return filename;
  }
  
  return filename.substring(0, lastDotIndex);
}