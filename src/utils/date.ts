/**
 * Sanitizes a date string to ensure it is in YYYY-MM-DD format.
 * Handles inputs like ISO strings, date-time strings, or malformed text.
 */
export const sanitizeDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  
  try {
    // Try to parse the date. AI often returns ISO strings or "YYYY-MM-DD HH:mm:ss"
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      // Fallback: If it contains a dash, try to extract YYYY-MM-DD via regex
      const match = dateStr.match(/(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : '';
    }
    
    // Return only the date part in YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

/**
 * Formats a date string into a relative human-readable string (Today, Tomorrow, etc.)
 */
export const formatRelativeDate = (dateStr: string | null | undefined): string => {
  const sanitized = sanitizeDate(dateStr);
  if (!sanitized) return '';
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [year, month, day] = sanitized.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    if (isNaN(date.getTime())) return '';
    
    date.setHours(0, 0, 0, 0);
    
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    
    if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return '';
  }
};
