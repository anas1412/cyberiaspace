/**
 * Tool Parser Tests
 *
 * Covers all three AI output formats: XML, simple tag, JS function call.
 * Additionally tests deduplication and edge cases.
 */
import { describe, it, expect } from 'bun:test';
import { parseToolCalls } from '../../services/ai/toolParser';

// ============================================
// XML Format
// ============================================
describe('parseToolCalls — XML format', () => {
  it('parses single create_thought with string arg', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=create_thought>
        <parameter=text> Hello World
      </tool_call>
    `);
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('create_thought');
    expect(result[0].args.text).toBe('Hello World');
  });

  it('parses create_stack with array arg', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=create_stack>
        <parameter=ids> ["a","b"]
        <parameter=name> My Stack
      </tool_call>
    `);
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('create_stack');
    expect(result[0].args.ids).toEqual(['a', 'b']);
    expect(result[0].args.name).toBe('My Stack');
  });

  it('parses multiple XML tool calls', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=create_thought>
        <parameter=text> First
      </tool_call>
      <tool_call>
        <function=create_thought>
        <parameter=text> Second
      </tool_call>
    `);
    expect(result).toHaveLength(2);
    expect(result[0].args.text).toBe('First');
    expect(result[1].args.text).toBe('Second');
  });

  it('parses update_thought with status and kanbanCol', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=update_thought>
        <parameter=id> abc123
        <parameter=status> doing
        <parameter=kanbanCol> 2
      </tool_call>
    `);
    expect(result).toHaveLength(1);
    expect(result[0].args.id).toBe('abc123');
    expect(result[0].args.status).toBe('doing');
    expect(result[0].args.kanbanCol).toBe(2);
  });

  it('handles boolean args', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=update_thought>
        <parameter=isAllDay> true
      </tool_call>
    `);
    expect(result[0].args.isAllDay).toBe(true);
  });

  it('handles numeric args', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=create_thought>
        <parameter=x> 400
        <parameter=y> 300
      </tool_call>
    `);
    expect(result[0].args.x).toBe(400);
    expect(result[0].args.y).toBe(300);
  });
});

// ============================================
// Simple Tag Format
// ============================================
describe('parseToolCalls — simple tag format', () => {
  it('parses <web_search> with text content', () => {
    const result = parseToolCalls('<web_search>latest AI news 2026</web_search>');
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('web_search');
    expect(result[0].args.query).toBe('latest AI news 2026');
  });

  it('ignores empty <web_search> tags', () => {
    const result = parseToolCalls('<web_search>  </web_search>');
    expect(result).toHaveLength(0);
  });
});

// ============================================
// JS Function Call Format
// ============================================
describe('parseToolCalls — JS function call format', () => {
  it('parses create_thought with string arg', () => {
    const result = parseToolCalls('create_thought({ text: "Hello World" })');
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('create_thought');
    expect(result[0].args.text).toBe('Hello World');
  });

  it('parses create_thought with single-quoted string', () => {
    const result = parseToolCalls("create_thought({ text: 'Hello World' })");
    expect(result).toHaveLength(1);
    expect(result[0].args.text).toBe('Hello World');
  });

  it('parses create_stack with array and string args', () => {
    const result = parseToolCalls('create_stack({ ids: ["a","b"], name: "My Stack" })');
    expect(result).toHaveLength(1);
    expect(result[0].args.ids).toEqual(['a', 'b']);
    expect(result[0].args.name).toBe('My Stack');
  });

  it('parses multiple JS function calls', () => {
    const result = parseToolCalls(`
      create_thought({ text: "First", status: "todo" })
      create_thought({ text: "Second", status: "doing" })
    `);
    expect(result).toHaveLength(2);
    expect(result[0].args.text).toBe('First');
    expect(result[1].args.text).toBe('Second');
  });

  it('parses mixed XML and JS formats', () => {
    const result = parseToolCalls(`
      <tool_call>
        <function=create_thought>
        <parameter=text> XML thought
      </tool_call>
      create_thought({ text: "JS thought" })
    `);
    expect(result).toHaveLength(2);
  });

  it('parses flat arrays (ids)', () => {
    const result = parseToolCalls('create_thoughts({ text: "Test", tasks: ["step1","step2"] })');
    expect(result).toHaveLength(1);
    expect(result[0].args.tasks).toEqual(['step1', 'step2']);
  });

  it('parses update_thoughts with ids array', () => {
    const result = parseToolCalls('update_thoughts({ ids: ["a","b","c"], status: "done" })');
    expect(result).toHaveLength(1);
    expect(result[0].args.ids).toEqual(['a', 'b', 'c']);
    expect(result[0].args.status).toBe('done');
  });
});

// ============================================
// Deduplication
// ============================================
describe('parseToolCalls — deduplication', () => {
  it('deduplicates identical calls', () => {
    const result = parseToolCalls(`
      create_thought({ text: "Hello" })
      create_thought({ text: "Hello" })
    `);
    expect(result).toHaveLength(1);
  });

  it('keeps different calls separate', () => {
    const result = parseToolCalls(`
      create_thought({ text: "Hello" })
      create_thought({ text: "World" })
    `);
    expect(result).toHaveLength(2);
  });
});

// ============================================
// Edge Cases
// ============================================
describe('parseToolCalls — edge cases', () => {
  it('returns empty for plain text with no calls', () => {
    expect(parseToolCalls('Hello world')).toEqual([]);
  });

  it('returns empty for empty string', () => {
    expect(parseToolCalls('')).toEqual([]);
  });

  it('returns empty for whitespace only', () => {
    expect(parseToolCalls('   \n  ')).toEqual([]);
  });

  it('returns empty for malformed XML (no function name)', () => {
    expect(parseToolCalls('<tool_call>broken</tool_call>')).toEqual([]);
  });

  it('handles text mixed with tool calls gracefully', () => {
    const result = parseToolCalls(
      'I will create a thought.\n\ncreate_thought({ text: "Meeting Notes" })\n\nDone!'
    );
    expect(result).toHaveLength(1);
    expect(result[0].args.text).toBe('Meeting Notes');
  });

  it('handles tool calls with many whitespace/newlines', () => {
    const result = parseToolCalls(
      'create_thought({\n  text: "Hello",\n  status: "doing"\n})'
    );
    expect(result).toHaveLength(1);
    expect(result[0].args.text).toBe('Hello');
    expect(result[0].args.status).toBe('doing');
  });
});
