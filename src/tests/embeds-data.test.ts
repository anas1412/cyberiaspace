/**
 * Data tests for embed utility — provider constants and response shapes only.
 */
import { describe, it, expect } from 'bun:test';
import { type EmbedInfo, type EmbedMeta, type EmbedProvider } from '../utils/embeds';

describe('EmbedProvider values', () => {
  const validProviders: EmbedProvider[] = ['youtube', 'spotify', 'twitter', 'reddit', 'facebook', 'instagram', 'tiktok', 'unknown'];

  it('all provider strings are non-empty', () => {
    for (const p of validProviders) {
      expect(typeof p).toBe('string');
      expect(p.length).toBeGreaterThan(0);
    }
  });
});

describe('EmbedInfo shape', () => {
  it('has provider, id, and url fields', () => {
    const result: EmbedInfo = { provider: 'unknown', id: null, url: '' };
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('url');
  });

  it('provider is one of known values', () => {
    const validProviders: EmbedProvider[] = ['youtube', 'spotify', 'twitter', 'reddit', 'facebook', 'instagram', 'tiktok', 'unknown'];
    const result: EmbedInfo = { provider: 'unknown', id: null, url: 'https://example.com' };
    expect(validProviders).toContain(result.provider);
  });

  it('id is string or null', () => {
    const result: EmbedInfo = { provider: 'unknown', id: null, url: '' };
    expect(result.id === null || typeof result.id === 'string').toBeTrue();
  });
});

describe('EmbedMeta shape', () => {
  it('all fields are optional strings', () => {
    const meta: EmbedMeta = {};
    expect(meta.title).toBeUndefined();
    expect(meta.author_name).toBeUndefined();
    expect(meta.thumbnail_url).toBeUndefined();
    expect(meta.description).toBeUndefined();
  });

  it('accepts all fields', () => {
    const meta: EmbedMeta = {
      title: 'Title',
      author_name: 'Author',
      author_url: 'https://a.com',
      thumbnail_url: 'https://a.com/img.png',
      video_url: 'https://a.com/video.mp4',
      provider_name: 'YouTube',
      description: 'Desc',
      html: '<iframe>',
    };
    expect(meta.title).toBe('Title');
    expect(meta.html).toInclude('<iframe');
  });
});
