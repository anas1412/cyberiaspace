/**
 * Sanitizes a date string to ensure it is in YYYY-MM-DD format.
 * Handles inputs like ISO strings, date-time strings, or malformed text.
 * Always preserves LOCAL date to avoid timezone issues.
 */
export const sanitizeDate = (dateStr: string | number | null | undefined): string => {
  if (!dateStr) return '';
  
  try {
    // Handle numeric timestamps - preserve LOCAL date
    if (typeof dateStr === 'number') {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // If already a string in YYYY-MM-DD format, return as-is
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      const match = String(dateStr).match(/(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : '';
    }
    
    // Preserve LOCAL date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
};

/**
 * Formats a date value as a relative string (Today, Tomorrow, Yesterday, or formatted date).
 * Works directly with timestamps to avoid timezone conversion issues.
 */
export const formatRelativeDate = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const today = new Date();
    
    // Get LOCAL year, month, day for comparison
    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();
    
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    // Check if it's today
    if (dateYear === todayYear && dateMonth === todayMonth && dateDay === todayDay) {
      return 'Today';
    }
    
    // Check if it's tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateYear === tomorrow.getFullYear() && dateMonth === tomorrow.getMonth() && dateDay === tomorrow.getDate()) {
      return 'Tomorrow';
    }
    
    // Check if it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateYear === yesterday.getFullYear() && dateMonth === yesterday.getMonth() && dateDay === yesterday.getDate()) {
      return 'Yesterday';
    }
    
    // Format based on year
    if (dateYear === todayYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return '';
  }
};
