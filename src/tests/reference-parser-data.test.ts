/**
 * Data tests for referenceParser — interface shapes and format contracts only.
 */
import { describe, it, expect } from 'bun:test';
import {
  type TextContentBlock,
  type ImageContentBlock,
  type ReferenceMatch,
  type ResolvedReference,
  type ParseResult,
  type SuggestionItem,
  getReferenceDisplayText,
} from '../utils/referenceParser';

describe('ContentBlock discriminated union', () => {
  it('TextContentBlock has correct shape', () => {
    const block: TextContentBlock = { type: 'text', text: 'Hello' };
    expect(block.type).toBe('text');
    expect(block.text).toBe('Hello');
  });

  it('ImageContentBlock has correct shape', () => {
    const block: ImageContentBlock = { type: 'image_url', image_url: { url: 'https://example.com/img.png' } };
    expect(block.type).toBe('image_url');
    expect(block.image_url.url).toStartWith('http');
  });
});

describe('ReferenceMatch shape', () => {
  it('thought match has correct fields', () => {
    const match: ReferenceMatch = {
      type: 'thought', name: 'Meeting Notes',
      startIndex: 6, endIndex: 21,
    };
    expect(match.type).toBe('thought');
    expect(match.endIndex).toBeGreaterThan(match.startIndex);
  });

  it('stack match has correct fields', () => {
    const match: ReferenceMatch = {
      type: 'stack', name: 'Projects',
      startIndex: 5, endIndex: 15,
    };
    expect(match.type).toBe('stack');
    expect(match.name).toBe('Projects');
  });
});

describe('ResolvedReference shape', () => {
  it('has correct structure', () => {
    const ref: ResolvedReference = {
      type: 'thought',
      name: 'Notes',
      data: [{ type: 'text', text: 'Content' }],
    };
    expect(ref.type).toBe('thought');
    expect(ref.data).toHaveLength(1);
    expect(ref.data[0].type).toBe('text');
  });
});

describe('ParseResult shape', () => {
  it('has references array and userMessage', () => {
    const result: ParseResult = {
      references: [],
      userMessage: 'hello',
    };
    expect(Array.isArray(result.references)).toBeTrue();
    expect(typeof result.userMessage).toBe('string');
  });
});

describe('SuggestionItem shape', () => {
  it('thought suggestion has correct fields', () => {
    const item: SuggestionItem = {
      id: 't1', name: 'Test', type: 'thought', preview: 'Test...',
    };
    expect(item.type).toBe('thought');
    expect(item.preview).toBeDefined();
  });

  it('stack suggestion has correct fields', () => {
    const item: SuggestionItem = {
      id: 's1', name: 'Stack', type: 'stack', color: '#6366f1',
    };
    expect(item.type).toBe('stack');
    expect(item.color).toMatch(/^#/);
  });
});

describe('getReferenceDisplayText format contract', () => {
  it('formats single thought with @ prefix', () => {
    expect(getReferenceDisplayText([{ type: 'thought', name: 'Notes', data: [] }])).toBe('@Notes');
  });

  it('formats single stack with # prefix', () => {
    expect(getReferenceDisplayText([{ type: 'stack', name: 'Active', data: [] }])).toBe('#Active');
  });

  it('joins multiple references with " + "', () => {
    const refs: ResolvedReference[] = [
      { type: 'thought', name: 'A', data: [] },
      { type: 'stack', name: 'B', data: [] },
    ];
    expect(getReferenceDisplayText(refs)).toBe('@A + #B');
  });

  it('returns empty string for empty array', () => {
    expect(getReferenceDisplayText([])).toBe('');
  });
});
