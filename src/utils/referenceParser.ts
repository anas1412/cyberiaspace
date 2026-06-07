/**
 * Reference Parser - Parses @thought and #stack references in chat input
 * handles multi-word names, spaces, periods, hyphens, and special characters
 * by matching against the existing knowledge base.
 */

import type { Thought, Stack } from '../db';

// ============================================
// Types
// ============================================

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image_url';
  image_url: { url: string };
}

export interface FileContentBlock {
  type: 'file';
  source: { url: string; media_type: string };
  title?: string;
}

export type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

export interface ReferenceMatch {
  type: 'thought' | 'stack';
  name: string; // The exact title from the DB
  startIndex: number;
  endIndex: number;
}

export interface ResolvedReference {
  type: 'thought' | 'stack';
  name: string;
  data: ContentBlock[];
}

export interface ParseResult {
  references: ResolvedReference[];
  userMessage: string;
}

// ============================================
// Parsing Functions
// ============================================

/**
 * Professional Knowledge-Based Parser
 * Instead of guessing with regex, we find @ or # and check if the following 
 * text matches a known title in the user's workspace.
 */
export function parseReferences(
  input: string, 
  thoughts: Thought[], 
  stacks: Stack[]
): ReferenceMatch[] {
  const matches: ReferenceMatch[] = [];
  
  // 1. Sort titles by length (Descending)
  // This is CRITICAL. If we have "@Project" and "@Project Alpha", 
  // we must try to match the longest one first.
  const thoughtTitles = thoughts.map(t => t.text).sort((a, b) => b.length - a.length);
  const stackTitles = stacks.map(s => s.name).sort((a, b) => b.length - a.length);

  // 2. Identify all potential trigger points
  const triggerRegex = /[@#]/g;
  let triggerMatch;

  while ((triggerMatch = triggerRegex.exec(input)) !== null) {
    const startIndex = triggerMatch.index;
    const trigger = triggerMatch[0];
    const remainingText = input.slice(startIndex + 1);
    
    const candidates = trigger === '@' ? thoughtTitles : stackTitles;
    const type = trigger === '@' ? 'thought' : 'stack';

    // 3. Look ahead to see if the text following the trigger matches a known title
    for (const title of candidates) {
      // Check for case-insensitive match at the start of remaining text
      if (remainingText.toLowerCase().startsWith(title.toLowerCase())) {
        matches.push({
          type,
          name: title, // Use the actual DB title
          startIndex,
          endIndex: startIndex + 1 + title.length
        });
        
        // Advance the regex pointer past this match to avoid nested triggers
        triggerRegex.lastIndex = startIndex + 1 + title.length;
        break;
      }
    }
    
    // If no match was found in the DB, we treat the symbol as plain text and continue
  }

  return matches;
}

// ============================================
// Resolution Functions
// ============================================

/**
 * Resolves media URLs for thoughts (Blobs or Cloud)
 */
async function getThoughtMediaUrl(thought: Thought): Promise<string | null> {
  if (thought.data?.type === 'file' && thought.data.url) return thought.data.url;
  if (thought.image) return thought.image;

  // Local IndexedDB Blob Fallback
  const { db } = await import('../db');
  const userId = 'guest';

  const blobEntry = await db.blobs
    .where('thoughtId').equals(thought.id)
    .filter(b => b.userId === userId)
    .first();

  return blobEntry ? URL.createObjectURL(blobEntry.blob) : null;
}

/**
 * Converts a database Thought into OpenRouter-compatible multimodal blocks
 */
export async function resolveThoughtToContent(thought: Thought): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const mediaUrl = await getThoughtMediaUrl(thought);
  const fileMeta = thought.meta?.file;

  const isImage = fileMeta?.isImage || (thought.text?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) != null);
  const isPdf = fileMeta?.isPdf || thought.text?.toLowerCase().endsWith('.pdf');

  switch (thought.data?.type) {
    case 'text':
      blocks.push({ type: 'text', text: `Thought: "${thought.text}"\nContent: ${thought.data.content || ''}` });
      break;
    case 'tasks':
      const tasks = (thought.data.tasks || []).map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n');
      blocks.push({ type: 'text', text: `Thought: "${thought.text}"\nTasks:\n${tasks}` });
      break;
    case 'file':
      if (isImage && mediaUrl) {
        blocks.push({ type: 'image_url', image_url: { url: mediaUrl } });
      } else if (isPdf && mediaUrl) {
        blocks.push({ type: 'file', source: { url: mediaUrl, media_type: 'application/pdf' }, title: thought.text });
      }
      blocks.push({ type: 'text', text: `Reference to File: ${thought.text}` });
      break;
    default:
      blocks.push({ type: 'text', text: `Thought Title: ${thought.text}` });
  }
  return blocks;
}

/**
 * Resolves a stack (collection of thoughts)
 */
export async function resolveStackToContent(stack: Stack, thoughts: Thought[]): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const stackThoughts = thoughts.filter(t => t.stackId === stack.id);

  blocks.push({ type: 'text', text: `--- BEGIN STACK: ${stack.name} ---` });
  for (const t of stackThoughts) {
    const tBlocks = await resolveThoughtToContent(t);
    blocks.push(...tBlocks);
  }
  blocks.push({ type: 'text', text: `--- END STACK: ${stack.name} ---` });
  return blocks;
}

// ============================================
// Main Public API
// ============================================

/**
 * The primary entry point for the Chat UI.
 * Parses the input, resolves content, and cleans the message for the AI.
 */
export async function resolveAllReferences(
  input: string,
  thoughts: Thought[],
  stacks: Stack[]
): Promise<ParseResult> {
  const matches = parseReferences(input, thoughts, stacks);
  const resolvedReferences: ResolvedReference[] = [];

  // Sort matches backwards so we can slice the string without breaking indexes
  const sortedMatches = [...matches].sort((a, b) => b.startIndex - a.startIndex);
  let cleanedMessage = input;

  for (const match of matches) {
    if (match.type === 'thought') {
      const thought = thoughts.find(t => t.text === match.name);
      if (thought) {
        resolvedReferences.push({
          type: 'thought',
          name: thought.text,
          data: await resolveThoughtToContent(thought)
        });
      }
    } else {
      const stack = stacks.find(s => s.name === match.name);
      if (stack) {
        resolvedReferences.push({
          type: 'stack',
          name: stack.name,
          data: await resolveStackToContent(stack, thoughts)
        });
      }
    }
  }

  // Remove the tags from the message sent to AI to prevent "double context"
  for (const match of sortedMatches) {
    cleanedMessage = cleanedMessage.slice(0, match.startIndex) + cleanedMessage.slice(match.endIndex);
  }

  return {
    references: resolvedReferences,
    userMessage: cleanedMessage.replace(/\s+/g, ' ').trim() || input
  };
}

/**
 * Utility for highlighting/displaying what was tagged in the UI
 */
export function getReferenceDisplayText(references: ResolvedReference[]): string {
  if (references.length === 0) return '';
  const thoughts = references.filter(r => r.type === 'thought').map(r => `@${r.name}`);
  const stacks = references.filter(r => r.type === 'stack').map(r => `#${r.name}`);
  return [...thoughts, ...stacks].join(' + ');
}

// ============================================
// UI Helper Functions (Filtering suggestions)
// ============================================

export interface SuggestionItem {
  id: string;
  name: string;
  type: 'thought' | 'stack';
  preview?: string;
  color?: string;
}

export function filterThoughts(thoughts: Thought[], query: string, limit = 5): SuggestionItem[] {
  return thoughts
    .filter(t => t.text.toLowerCase().includes(query.toLowerCase()))
    .slice(0, limit)
    .map(t => ({ id: t.id, name: t.text, type: 'thought', preview: t.text.substring(0, 30) }));
}

export function filterStacks(stacks: Stack[], query: string, limit = 5): SuggestionItem[] {
  return stacks
    .filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, limit)
    .map(s => ({ id: s.id, name: s.name, type: 'stack', color: s.color }));
}