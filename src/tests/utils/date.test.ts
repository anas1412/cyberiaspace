import { describe, it, expect } from 'vitest';
import { formatRelativeDate } from '../../utils/date';

describe('formatRelativeDate', () => {
  it('returns "Today" for current date', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(formatRelativeDate(today)).toBe('Today');
  });

  it('returns "Tomorrow" for next day', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    expect(formatRelativeDate(dateStr)).toBe('Tomorrow');
  });

  it('returns "Yesterday" for previous day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    expect(formatRelativeDate(dateStr)).toBe('Yesterday');
  });

  it('returns empty string for invalid input', () => {
    expect(formatRelativeDate('')).toBe('');
  });
});
