/**
 * AI Tool Call Parser
 *
 * Extracts tool call invocations from AI assistant response text.
 * Supports both XML-style and JS function call formats.
 */

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  toolCall: ToolCall;
  result: { success: boolean; error?: string; [key: string]: unknown };
}

/**
 * Extract tool calls from AI response text.
 *
 * Supports two formats the AI may output:
 *
 * XML style:
 *   <tool_call> <function=create_stack> <parameter=ids> ["..."] <parameter=name> Notes </tool_call>
 *
 * JS function call style:
 *   create_stack({ ids: ["..."], name: "Notes" })
 */
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const seen = new Set<string>();

  // ── 1. XML format ──────────────────────────────────────────
  const xmlBlockRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let match: RegExpExecArray | null;

  while ((match = xmlBlockRegex.exec(text)) !== null) {
    const body = match[1].trim();
    const funcMatch = body.match(/<function=(\w+)>/);
    if (!funcMatch) continue;

    const toolName = funcMatch[1];
    const args: Record<string, unknown> = {};

    // Extract each <parameter=key> value
    const paramRegex = /<parameter=(\w+)>\s*([\s\S]*?)\s*(?=<(?:parameter=|\/tool_call|function=))/g;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = paramRegex.exec(body)) !== null) {
      const key = paramMatch[1];
      const raw = paramMatch[2].trim();
      args[key] = coerceValue(raw);
    }

    const key = `${toolName}::${JSON.stringify(args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      calls.push({ toolName, args });
    }
  }

  // ── 2. Simple XML tag format ────────────────────────────────
  // Handles: <web_search>query text</web_search>
  // Only matches tools that take a single string parameter.
  const simpleTagNames = [
    'web_search',
  ].join('|');

  const simpleTagRegex = new RegExp(
    `<(${simpleTagNames})>([\\s\\S]*?)<\\/\\1>`,
    'gi'
  );

  while ((match = simpleTagRegex.exec(text)) !== null) {
    const toolName = match[1];
    const value = match[2].trim();
    if (!value) continue;

    const args: Record<string, unknown> = { query: value };
    const key = `${toolName}::${JSON.stringify(args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      calls.push({ toolName, args });
    }
  }

  // ── 3. JS function call format ─────────────────────────────
  const toolNames = [
    'create_thought', 'create_thoughts', 'create_stack', 'link_thoughts',
    'unlink_thoughts', 'update_thought', 'update_thoughts', 'delete_thoughts',
    'delete_stack', 'delete_stacks', 'get_thought_details', 'read_file_content',
    'read_files_content', 'update_stack', 'update_stacks', 'web_search',
  ].join('|');

  const jsRegex = new RegExp(
    `(?:${toolNames})\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)\\s*;?`,
    'g'
  );

  while ((match = jsRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const toolName = fullMatch.match(/^(\w+)/)?.[1];
    if (!toolName) continue;

    const argsBody = match[1];
    const args = parseJsObjectArgs(argsBody);

    const key = `${toolName}::${JSON.stringify(args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      calls.push({ toolName, args });
    }
  }

  return calls;
}

/**
 * Parse a JS-object-like argument string into a key-value map.
 * Handles: `ids: ["a","b"]`, `name: "Notes"`, `color: "#333"`, bare keys.
 */
function parseJsObjectArgs(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  // Match key: value pairs handling strings, arrays, numbers, booleans
  const pairRegex = /(\w+)\s*:\s*((?:"[^"]*"|'[^']*'|\[[\s\S]*?\]|\{[\s\S]*?\}|true|false|null|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?))\s*(?:,|$)/g;
  let pairMatch: RegExpExecArray | null;

  while ((pairMatch = pairRegex.exec(body)) !== null) {
    const key = pairMatch[1];
    const raw = pairMatch[2].trim();
    args[key] = coerceValue(raw);
  }

  return args;
}

/**
 * Coerce a raw string value to its likely type.
 * Tries JSON parse first, then number, then keeps as string.
 */
function coerceValue(raw: string): unknown {
  // Strip surrounding quotes if it's a quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // Try JSON for arrays, objects, booleans, null, numbers
  if (
    raw.startsWith('[') ||
    raw.startsWith('{') ||
    raw === 'true' ||
    raw === 'false' ||
    raw === 'null' ||
    /^-?\d+(\.\d+)?(e[+-]?\d+)?$/.test(raw)
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through
    }
  }

  return raw;
}
