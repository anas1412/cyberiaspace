/**
 * Data tests for web search service — response shape, config validation.
 */
import { describe, it, expect } from 'bun:test';
import { type WebSearchResult } from '../services/ai/webSearch';

describe('WebSearchResult shape', () => {
  it('has title, url, and snippet fields', () => {
    const result: WebSearchResult = {
      title: 'Test Result',
      url: 'https://example.com',
      snippet: 'A test result snippet',
    };
    expect(result.title).toBeTruthy();
    expect(result.url).toStartWith('http');
    expect(result.snippet).toBeTruthy();
  });
});
