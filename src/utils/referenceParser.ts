/**
 * Reference Parser - Parses @thought and #stack references in chat input
 * and resolves them to full multimodal content for the AI.
 */

import type { Thought, Stack } from '../db';

// ============================================
// Types
// ============================================

// OpenRouter unified schema content block types
export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'url';
    url: string;
  };
}

export interface FileContentBlock {
  type: 'file';
  source: {
    type: 'url';
    url: string;
    media_type: string;
  };
  title?: string;
}

export type ContentBlock = TextContentBlock | ImageContentBlock | FileContentBlock;

export interface ReferenceMatch {
  type: 'thought' | 'stack';
  name: string;
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
 * Parse input string for @ and # references
 */
export function parseReferences(input: string): ReferenceMatch[] {
  const references: ReferenceMatch[] = [];
  
  // Match @thoughtname or #stackname (handles multi-word names with spaces)
  const regex = /(@[\w\u00C0-\uFFFF][\w\u00C0-\uFFFF\s]*)|(#[^\n]+)/g;
  
  let match;
  while ((match = regex.exec(input)) !== null) {
    const fullMatch = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;
    
    if (fullMatch.startsWith('@')) {
      references.push({
        type: 'thought',
        name: fullMatch.slice(1).trim(), // Remove @ and trim
        startIndex,
        endIndex
      });
    } else if (fullMatch.startsWith('#')) {
      references.push({
        type: 'stack',
        name: fullMatch.slice(1).trim(), // Remove # and trim
        startIndex,
        endIndex
      });
    }
  }
  
  return references;
}

// ============================================
// Resolution Functions
// ============================================

/**
 * Get the best URL for a thought (local blob first, then cloud URL)
 */
async function getThoughtMediaUrl(thought: Thought): Promise<string | null> {
  // Check for file-type thought with URL in data
  if (thought.data?.type === 'file') {
    const url = thought.data.url;
    if (url) return url;
  }
  
  // Check legacy image field
  if (thought.image) {
    return thought.image;
  }
  
  // Check storage URL (cloud)
  if (thought.storageUrl) {
    return thought.storageUrl;
  }
  
  // Check for local blob in IndexedDB
  const { db } = await import('../db');
  const { useAuthStore } = await import('../store/useAuthStore');
  const userId = useAuthStore.getState().user?.id ?? 'guest';
  
  const blobEntry = await db.blobs
    .where('thoughtId')
    .equals(thought.id)
    .filter(b => b.userId === userId)
    .first();
  
  if (blobEntry) {
    return URL.createObjectURL(blobEntry.blob);
  }
  
  return null;
}

/**
 * Resolve a single thought to content blocks (multimodal)
 */
export async function resolveThoughtToContent(thought: Thought): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  
  // Get media URL if exists
  const mediaUrl = await getThoughtMediaUrl(thought);
  const fileMeta = thought.meta?.file;
  
  // Determine file type from metadata
  const isImage = fileMeta?.isImage || 
    thought.data?.type === 'file' && fileMeta?.type?.startsWith('image/') ||
    (thought.text?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/) != null);
  
  const isPdf = fileMeta?.isPdf || 
    thought.data?.type === 'file' && fileMeta?.type === 'application/pdf' ||
    thought.text?.toLowerCase().endsWith('.pdf');
  
  // Handle different thought types
  switch (thought.data?.type) {
    case 'text': {
      const content = thought.data.content?.trim() || thought.text || '';
      if (content) {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}"\n${content}`
        });
      } else {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}"`
        });
      }
      break;
    }
    
    case 'tasks': {
      const tasks = thought.data.tasks || [];
      const tasksText = tasks.length > 0
        ? tasks.map((t) => `${t.done ? '✓' : '○'} ${t.text}`).join('\n')
        : '(no tasks)';
      blocks.push({
        type: 'text',
        text: `Thought: "${thought.text}"\nTasks:\n${tasksText}`
      });
      break;
    }
    
    case 'table': {
      const rows = thought.data.rows || [];
      const tableText = rows.length > 0
        ? rows.map(row => row.join(' | ')).join('\n')
        : '(empty table)';
      blocks.push({
        type: 'text',
        text: `Thought: "${thought.text}"\nTable:\n${tableText}`
      });
      break;
    }
    
    case 'paint': {
      const drawing = thought.data.drawing;
      if (drawing && (drawing.startsWith('data:') || drawing.startsWith('<svg'))) {
        // Convert SVG to data URL
        let svgDataUrl = drawing;
        if (drawing.startsWith('<svg')) {
          const encoded = encodeURIComponent(drawing)
            .replace(/'/g, '%27')
            .replace(/"/g, '%22');
          svgDataUrl = `data:image/svg+xml;utf8,${encoded}`;
        }
        blocks.push({
          type: 'image',
          source: { type: 'url', url: svgDataUrl }
        });
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}" (Drawing/Sketch)`
        });
      } else {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}" (Drawing)`
        });
      }
      break;
    }
    
    case 'embed': {
      blocks.push({
        type: 'text',
        text: `Thought: "${thought.text}" (Embed: ${thought.data.url})`
      });
      break;
    }
    
    case 'file': {
      const fileName = thought.data.name || thought.text;
      
      // Handle image files
      if (isImage && mediaUrl) {
        blocks.push({
          type: 'image',
          source: { type: 'url', url: mediaUrl }
        });
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}" (Image: ${fileName})`
        });
      }
      // Handle PDF files
      else if (isPdf && mediaUrl) {
        blocks.push({
          type: 'file',
          source: { 
            type: 'url', 
            url: mediaUrl, 
            media_type: 'application/pdf' 
          },
          title: fileName
        });
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}" (PDF: ${fileName})`
        });
      }
      // Handle other file types
      else {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}" (File: ${fileName})`
        });
      }
      break;
    }
    
    default: {
      // Legacy / fallback - check old fields
      const legacyContent = (thought as any).content;
      if (legacyContent?.trim()) {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}"\n${legacyContent}`
        });
      } else {
        blocks.push({
          type: 'text',
          text: `Thought: "${thought.text}"`
        });
      }
    }
  }
  
  return blocks;
}

/**
 * Resolve a stack to content blocks (all thoughts in the stack)
 */
export async function resolveStackToContent(stack: Stack, thoughts: Thought[]): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  
  // Find all thoughts in this stack
  const stackThoughts = thoughts.filter(t => t.stackId === stack.id);
  
  // Add stack header
  blocks.push({
    type: 'text',
    text: `=== STACK: ${stack.name} (${stack.color}) - ${stackThoughts.length} thoughts ===`
  });
  
  // Resolve each thought
  for (const thought of stackThoughts) {
    const thoughtBlocks = await resolveThoughtToContent(thought);
    blocks.push(...thoughtBlocks);
  }
  
  return blocks;
}

/**
 * Fuzzy match - check if name contains query (case-insensitive)
 */
function fuzzyMatch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

/**
 * Find thought by name (fuzzy match)
 */
function findThoughtByName(thoughts: Thought[], name: string): Thought | null {
  // Exact match first
  let match = thoughts.find(t => t.text.toLowerCase() === name.toLowerCase());
  if (match) return match;
  
  // Fuzzy match
  match = thoughts.find(t => fuzzyMatch(t.text, name));
  if (match) return match;
  
  // Partial match (query must be at start)
  match = thoughts.find(t => t.text.toLowerCase().startsWith(name.toLowerCase()));
  if (match) return match;
  
  return null;
}

/**
 * Find stack by name (fuzzy match)
 */
function findStackByName(stacks: Stack[], name: string): Stack | null {
  // Exact match first
  let match = stacks.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (match) return match;
  
  // Fuzzy match
  match = stacks.find(s => fuzzyMatch(s.name, name));
  if (match) return match;
  
  // Partial match
  match = stacks.find(s => s.name.toLowerCase().startsWith(name.toLowerCase()));
  if (match) return match;
  
  return null;
}

/**
 * Main function: resolve all references in input to content blocks
 */
export async function resolveAllReferences(
  input: string,
  thoughts: Thought[],
  stacks: Stack[]
): Promise<ParseResult> {
  const references = parseReferences(input);
  
  if (references.length === 0) {
    return {
      references: [],
      userMessage: input
    };
  }
  
  const resolvedReferences: ResolvedReference[] = [];
  
  // Process each reference
  for (const ref of references) {
    if (ref.type === 'thought') {
      const thought = findThoughtByName(thoughts, ref.name);
      if (thought) {
        const data = await resolveThoughtToContent(thought);
        resolvedReferences.push({
          type: 'thought',
          name: thought.text,
          data
        });
      }
    } else if (ref.type === 'stack') {
      const stack = findStackByName(stacks, ref.name);
      if (stack) {
        const data = await resolveStackToContent(stack, thoughts);
        resolvedReferences.push({
          type: 'stack',
          name: stack.name,
          data
        });
      }
    }
  }
  
  // Build clean user message (remove references)
  let userMessage = input;
  // Sort by startIndex descending to avoid index shifting when removing
  const sortedRefs = [...references].sort((a, b) => b.startIndex - a.startIndex);
  
  for (const ref of sortedRefs) {
    userMessage = userMessage.slice(0, ref.startIndex) + userMessage.slice(ref.endIndex);
  }
  
  // Clean up extra whitespace
  userMessage = userMessage.replace(/\s+/g, ' ').trim();
  
  return {
    references: resolvedReferences,
    userMessage: userMessage || input // Keep original if all references were removed
  };
}

/**
 * Get clean display text for UI - includes @ and # so highlighting works
 */
export function getReferenceDisplayText(references: ResolvedReference[]): string {
  if (references.length === 0) return '';
  
  const thoughtRefs = references.filter(r => r.type === 'thought');
  const stackRefs = references.filter(r => r.type === 'stack');
  
  const parts: string[] = [];
  
  if (thoughtRefs.length > 0) {
    const names = thoughtRefs.map(r => `@${r.name}`).join(', ');
    parts.push(names);
  }
  
  if (stackRefs.length > 0) {
    const names = stackRefs.map(r => `#${r.name}`).join(', ');
    parts.push(names);
  }
  
  return parts.join(' + ');
}

// ============================================
// Helper Functions (for UI suggestions)
// ============================================

export interface SuggestionItem {
  id: string;
  name: string;
  type: 'thought' | 'stack';
  preview?: string;
  color?: string;
  hasContent?: boolean;
}

/**
 * Filter thoughts for suggestions
 */
export function filterThoughts(thoughts: Thought[], query: string, limit = 5): SuggestionItem[] {
  if (!query) {
    // Return recent thoughts if no query
    return thoughts
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        name: t.text,
        type: 'thought' as const,
        preview: t.text.substring(0, 30),
        hasContent: !!(t.data?.type === 'text' ? t.data.content : t.text)
      }));
  }
  
  return thoughts
    .filter(t => fuzzyMatch(t.text, query))
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      name: t.text,
      type: 'thought' as const,
      preview: t.text.substring(0, 30),
      hasContent: !!(t.data?.type === 'text' ? t.data.content : t.text)
    }));
}

/**
 * Filter stacks for suggestions
 */
export function filterStacks(stacks: Stack[], thoughts: Thought[], query: string, limit = 5): SuggestionItem[] {
  if (!query) {
    return stacks.slice(0, limit).map(s => ({
      id: s.id,
      name: s.name,
      type: 'stack' as const,
      color: s.color,
      preview: `${thoughts.filter(t => t.stackId === s.id).length} thoughts`
    }));
  }
  
  return stacks
    .filter(s => fuzzyMatch(s.name, query))
    .slice(0, limit)
    .map(s => ({
      id: s.id,
      name: s.name,
      type: 'stack' as const,
      color: s.color,
      preview: `${thoughts.filter(t => t.stackId === s.id).length} thoughts`
    }));
}
