# Oracle JSON Retry Plan

## Problem

Client tool calls (`create_stack`, `update_stack`, etc.) sometimes produce malformed JSON from free models.

### Example Error
```
{"ids": []1063, 1067, 1068, 1069, 1076, "name": ""Anime Openings & Music Videos...
```

The free model outputs broken JSON - missing brackets, garbled quotes, etc.

## Root Cause

Free models are unreliable at generating valid JSON consistently. This is a model limitation, not a code bug.

## Current Behavior

Currently when JSON parsing fails:
1. Log the error
2. Mark as `_parseError: true`
3. Continue execution (tool call fails silently or partially)

## Proposed Solution

Add retry-on-error logic for client tools.

### Flow

```
Model outputs text → Try JSON.parse → Success → Use it
                                      ↓ Fail
                               Send error back to model: "Invalid JSON, retry"
                                      ↓
                               Model retries → Success → Use it
```

## Implementation

### Location
File: `api/chat.ts` - Function: `runChat` - Around line 886 (client tool parsing)

### Changes

#### Step 1: Add retry flag to context
Track `retryCount` in the conversation. If JSON fails, increment and allow max 1 retry.

#### Step 2: Send error feedback to model
When `safeParseJSON` fails, instead of just logging:

```javascript
// Current behavior (line ~886):
const args = safeParseJSON(tc.function.arguments, { _parseError: true, raw: tc.function.arguments });

// New behavior:
const args = safeParseJSON(tc.function.arguments, { _parseError: true, raw: tc.function.arguments });

if (args._parseError) {
  // Instead of continuing, add retry message to nextMessages
  nextMessages.push({
    role: 'system',
    content: `Invalid JSON in tool call: ${args.raw}. Please retry with valid JSON.`
  });
  
  // Call runChat again with retry message (max 1 retry)
  return await runChat(nextMessages, currentModel, currentTools, mode, true);
}
```

#### Step 3: Limit retries
Max 1 retry per tool call to prevent infinite loops.

### Code Location to Modify

In `runChat` function, around line 886:

```typescript
for (const batch of batchedClientCalls) {
  if (batch.length === 1) {
    const tc = batch[0];
    const args = safeParseJSON(tc.function.arguments, { _parseError: true, raw: tc.function.arguments });
    
    // NEW: If parse failed and we haven't retried yet
    if (args._parseError && !isRetry) {
      // Send error feedback and retry
      const retryMsg = {
        role: 'system',
        content: `Invalid JSON in previous tool call: ${args.raw}. Please retry with valid JSON.`
      };
      
      // Add the retry message AND the failed assistant message to context
      const retryMessages = [...currentMessages, { role: 'assistant', content: fullContent || null, tool_calls: filteredToolCalls }, retryMsg];
      
      return await runChat(retryMessages, currentModel, currentTools, mode, true);
    }
    
    // ... rest of existing code
  }
}
```

### Parameters

- Add `isRetry: boolean` parameter to `runChat`
- Pass `isRetry` through recursive calls
- Default: `false`

## Alternative Approaches Considered

1. **Zod validation** - Overkill, adds complexity
2. **Better model** - Would fix but costs more
3. **Structured outputs (response_format)** - Doesn't work for tool arguments, only final response

## Testing

Test cases:
1. Ask AI to create a stack → Should retry if JSON fails
2. Ask AI to create a stack → Should succeed if JSON is valid
3. After 1 retry, should give up (prevents infinite loop)
