import { describe, it, expect } from 'vitest';
import { formatRelativeDate } from '../../utils/date';

describe('formatRelativeDate', () => {
  it('returns "Today" for current date', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(formatRelativeDate(today.getTime())).toBe('Today');
  });

  it('returns "Tomorrow" for next day', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    expect(formatRelativeDate(tomorrow.getTime())).toBe('Tomorrow');
  });

  it('returns "Yesterday" for previous day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    expect(formatRelativeDate(yesterday.getTime())).toBe('Yesterday');
  });

  it('returns empty string for invalid input', () => {
    expect(formatRelativeDate(0)).toBe('');
    expect(formatRelativeDate(null)).toBe('');
    expect(formatRelativeDate(undefined)).toBe('');
  });
});
