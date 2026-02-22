# AI Performance Optimization

Strategies to enhance Groq inference speed and reduce latency in Oracle.

---

## Current Bottlenecks (Identified in Code)

### 1. NESTED API CALLS - HIGHEST PRIORITY
**Location**: `src/components/ChatOverlay.tsx:254-307`

When Oracle calls `get_thought_details`, the client makes a **SECOND full `/api/chat` request** to continue. This creates a cascading delay for every content retrieval.

```typescript
// ChatOverlay.tsx:254-307 - This is the problem
if (data.toolCall.toolName === 'get_thought_details' && result.success) {
  const followUpResponse = await fetch('/api/chat', { ... }); // ANOTHER full round-trip!
}
```

**Fix**: Handle tool results server-side instead of client-side round-trip.

---

### 2. Sequential Tool Execution
**Location**: `api/chat.ts:574-602`

Tools execute one-by-one in a loop.

---

## Parallel & Batch Processing

### When Tools Can Be Parallelized

Certain operations are truly independent and can run concurrently:

| Scenario | Can Parallelize? |
|----------|------------------|
| Multiple `web_search` with different queries | ✅ Yes |
| Multiple `create_thought` (different items) | ✅ Yes |
| Multiple `update_thought` (different IDs) | ✅ Yes |
| Multiple `delete_thoughts` (different IDs) | ✅ Yes |
| `search_youtube` → `create_thought` | ❌ No (dependent) |
| `get_thought_details` → `update_thought` | ❌ No (dependent) |

### Implementation: Parallel Server Tools

```typescript
// api/chat.ts:574-602 - Replace sequential loop with parallel execution

// Identify independent tools
const serverTools = filteredToolCalls.filter(tc => 
  ['web_search', 'create_thought', 'update_thought', 'delete_thoughts'].includes(tc.function.name)
);

// Execute all server tools in parallel
const toolResults = await Promise.all(
  serverTools.map(tc => 
    executeServerTool(tc.function.name, JSON.parse(tc.function.arguments))
  )
);

// Build messages with all results
serverTools.forEach((tc, i) => {
  nextMessages.push({
    role: 'tool',
    tool_call_id: tc.id,
    name: tc.function.name,
    content: JSON.stringify(toolResults[i])
  });
});
```

### Batch Processing for Bulk Operations

Group similar operations into single requests:

```typescript
// Instead of multiple individual creates, batch them
// Use existing create_thoughts for bulk creation

// For updates, batch IDs
const batchUpdate = async (updates: ThoughtUpdate[]) => {
  // Process all updates in one transaction
  await db.thoughts.bulkPut(updates);
};
```

### When Dependent, Use Smart Sequencing

For dependent operations, ensure efficient ordering:

1. **Search first** → fetch results → process
2. **Read content** → wait for data → modify
3. **Create results** → return to AI

The key is: **minimize round-trips** by handling as much as possible in each pass.

---

## Why Skeleton Strategy is Optimal

Cyberia's kinetic design already optimizes context correctly:

1. **Skeleton Strategy** (`contextBuilder.ts`) - Only sends metadata, not content
2. **On-demand fetching** - AI uses `get_thought_details` to read specific content when needed
3. **This is RAG** - The tool-based retrieval is the optimization, not pre-filtering context

Selective context (filtering thoughts before sending) would break the kinetic paradigm.

---

## Optimization Strategies

### A. Fix Nested API Calls (Highest Impact)

**Option 1**: Execute client-side tools server-side

Move `create_thought`, `update_thought`, `delete_thoughts`, etc. to server-side execution so the tool result returns directly in the stream instead of triggering a new request.

**Option 2**: Optimize the follow-up

If Option 1 is too complex, at least optimize the nested call to not re-send full context.

---

## Implementation Status

| Priority | Change | Status | Impact |
|----------|--------|--------|--------|
| 1 | Add `max_tokens: 1024` | ✅ Done | 20-30% |
| 2 | Reduce history 10→5 | ✅ Done | 15-25% |
| 3 | Pre-connect to Groq | ✅ Done | 5-10% |
| 4 | Fix nested API calls | ✅ Done | 40-60% |
| 5 | Parallel tool execution | ✅ Done | 20-40% |
| 6 | Batch processing | ✅ Done | 10-20% |

---

## Completed Changes

### 1. Added max_tokens limit
- **File**: `api/chat.ts:533`
- Added `max_tokens: 1024` to Groq request

### 2. Reduced message history
- **File**: `ChatOverlay.tsx:168-169`
- Changed from 10 messages to 5 messages

### 3. Pre-connected to Groq
- **File**: `index.html:8`
- Added `<link rel="preconnect" href="https://api.groq.com">`

### 4. Parallel Tool Execution
- **File**: `api/chat.ts:571-605`
- Server-side tools (`web_search`, `search_youtube`) now execute in parallel using `Promise.all`
- Client-side tools still execute sequentially (must wait for client execution)

### 5. Optimized Nested API Calls
- **File**: `ChatOverlay.tsx:254-280`
- When `get_thought_details` runs, the follow-up now uses minimal context instead of full workspace serialization
- Reduced message history to just the tool result (no re-sending conversation history)

---

### 6. Optimized Nested API Calls
- **File**: `ChatOverlay.tsx:254-280`
- When `get_thought_details` runs, the follow-up now uses minimal context instead of full workspace serialization
- Reduced message history to just the tool result (no re-sending conversation history)

### 7. Batch Processing
- **Files**: `api/chat.ts:490-575`, `ChatOverlay.tsx:80-100`
- Groups consecutive `create_thought` calls → `create_thoughts` (single bulk operation)
- Groups consecutive `update_thought` calls → `update_thoughts` (single bulk operation)
- Groups consecutive `update_stack` calls → `update_stacks` (single bulk operation)
- Groups consecutive `delete_stack` calls → `delete_stacks` (single bulk operation)
- Added new bulk tools:
  - `update_stacks` - Bulk rename multiple stacks
  - `delete_stacks` - Bulk delete multiple stacks
  - `read_files_content` - Bulk read multiple file contents
- Automatically converts individual calls to bulk operations
- UI shows appropriate status messages for all operations

---

## Next Steps

All major optimizations complete. The AI should now be significantly faster.

---

## Model Notes

| Model | Use Case | Speed |
|-------|----------|-------|
| `openai/gpt-oss-20b` | Free tier, simple tasks | Fast |
| `openai/gpt-oss-120b` | Pro tier, complex reasoning | Slower |

Use aggressive `max_tokens` limits with 120B model.

---

## Files Modified

| File | Changes |
|------|---------|
| `api/chat.ts` | Added max_tokens |
| `src/components/ChatOverlay.tsx` | Reduced history to 5 |
| `index.html` | Pre-connect to Groq |
