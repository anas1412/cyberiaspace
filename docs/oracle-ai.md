# Oracle: Workspace Intelligence

Oracle is the AI assistant integrated into Cyberia to manage, research, and organize your spatial data.

## 1. Interaction Model
- **Streaming:** Responses are delivered via Server-Sent Events (SSE).
- **Tools:** Oracle can autonomously call workspace functions (create, move, delete).
- **Quota:** Daily usage is tracked in the User Profile and enforced at the API level.

## 2. Token Optimization (JIT Retrieval)
Oracle uses a **Skeleton Strategy** to remain fast and efficient:
1. **Initial Context:** The AI only receives the "Skeleton" of your space (Titles, Types, Status). It **does not** receive the content of every note.
2. **Retrieval Tool (`get_thought_details`):** If Oracle needs to see the tasks in a list or the text in a note, she must explicitly call this tool.
3. **Document Reading (`read_file_content`):** Oracle can request the text content of a file stored in Google Drive or local blobs to perform deep analysis.

## 3. Logic & Rules
- **Structural Priority:** Oracle defaults to using the `label` type for structural markers.
- **Search-Then-Act:** For external queries, Oracle must perform a `web_search` or `search_youtube` before creating an `embed` or `text` thought.
- **Conversation First:** Oracle is designed to be a CASUAL human-like companion. She should not use tools if the user is just chatting.

## 4. Provider Strategy
- **Base:** Groq (Mini 20B) for Free users.
- **Premium:** Groq (Pro 120B) for Pro users.
- **Verification:** Gemma models are used for internal data validation.
