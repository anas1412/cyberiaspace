/**
 * Data tests for application constants.
 * Validates that all constant values, limits, and configurations are correct.
 */
import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_THEME,
  DEFAULT_PHYSICS,
  STACK_COLORS,
  MAX_UPLOAD_SIZE,
  MAX_UPLOAD_SIZE_MB,
  MAX_THOUGHTS_PER_STACK,
  ORACLE_CONFIG,
  APP_VERSION,
  SHOW_QUOTA_TAB,
  DEFAULT_MODEL,
  VERIFICATION_MODEL,
  TAVILY_CONFIG,
  GITHUB_URL,
  DISCORD_INVITE_URL,
} from '../constants';

describe('Theme defaults', () => {
  it('DEFAULT_THEME is "light"', () => {
    expect(DEFAULT_THEME).toBe('light');
  });

  it('DEFAULT_PHYSICS is true', () => {
    expect(DEFAULT_PHYSICS).toBeTrue();
  });
});

describe('STACK_COLORS', () => {
  it('has exactly 12 colors', () => {
    expect(STACK_COLORS).toHaveLength(12);
  });

  it('all colors are valid hex strings', () => {
    for (const color of STACK_COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('all colors are unique', () => {
    expect(new Set(STACK_COLORS).size).toBe(STACK_COLORS.length);
  });
});

describe('Upload limits', () => {
  it('MAX_UPLOAD_SIZE is 100 MB in bytes', () => {
    expect(MAX_UPLOAD_SIZE).toBe(100 * 1024 * 1024);
  });

  it('MAX_UPLOAD_SIZE_MB is 100', () => {
    expect(MAX_UPLOAD_SIZE_MB).toBe(100);
  });

  it('MAX_UPLOAD_SIZE and MAX_UPLOAD_SIZE_MB are consistent', () => {
    expect(MAX_UPLOAD_SIZE).toBe(MAX_UPLOAD_SIZE_MB * 1024 * 1024);
  });
});

describe('Stack limits', () => {
  it('MAX_THOUGHTS_PER_STACK is 20', () => {
    expect(MAX_THOUGHTS_PER_STACK).toBe(20);
  });
});

describe('ORACLE_CONFIG', () => {
  it('HISTORY_WINDOW_SIZE is 12', () => {
    expect(ORACLE_CONFIG.HISTORY_WINDOW_SIZE).toBe(12);
  });
});

describe('APP_VERSION', () => {
  it('is a semantic version string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('Feature flags', () => {
  it('SHOW_QUOTA_TAB is false', () => {
    expect(SHOW_QUOTA_TAB).toBeFalse();
  });
});

describe('Model configuration', () => {
  it('DEFAULT_MODEL falls back to "openrouter/free"', () => {
    expect(DEFAULT_MODEL).toBe('openrouter/free');
  });

  it('VERIFICATION_MODEL contains exactly one model', () => {
    expect(VERIFICATION_MODEL).toHaveLength(1);
    expect(VERIFICATION_MODEL[0]).toBe('gemma-3-12b-it');
  });
});

describe('TAVILY_CONFIG', () => {
  it('has correct API URL', () => {
    expect(TAVILY_CONFIG.API_URL).toBe('https://api.tavily.com/search');
  });

  it('has SEARCH_DEPTH of "basic"', () => {
    expect(TAVILY_CONFIG.SEARCH_DEPTH).toBe('basic');
  });

  it('has MAX_RESULTS of 5', () => {
    expect(TAVILY_CONFIG.MAX_RESULTS).toBe(5);
  });

  it('has INCLUDE_ANSWER of false', () => {
    expect(TAVILY_CONFIG.INCLUDE_ANSWER).toBeFalse();
  });
});

describe('External URLs', () => {
  it('GITHUB_URL points to the right repo', () => {
    expect(GITHUB_URL).toBe('https://github.com/anas1412/cyberia');
  });

  it('DISCORD_INVITE_URL is a valid discord.gg URL', () => {
    expect(DISCORD_INVITE_URL).toMatch(/^https:\/\/discord\.gg\//);
  });
});
