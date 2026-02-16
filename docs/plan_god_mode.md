# God Mode Implementation Plan (LLM Integration)

## Objective
Transform Cyberia from a passive tool into an active collaborator by integrating the Google Gemini API (referencing Gemini 1.5 capabilities). The system will allow users to chat with their workspace, manipulate data via Function Calling, and use Multimodal (Vision) capabilities to understand spatial layout.

## Phase 1: Infrastructure & Privacy (The "Shield")
- [ ] **Library Installation:**
    - Install `@google/generative-ai`.
- [ ] **API Key Management:**
    - Add logic to store/retrieve User's Gemini API Key in `localStorage`.
    - Create a secure settings modal for key input.
    - *Security Note:* Since this is a client-side app, the key remains local to the user's browser.
- [ ] **Service Layer (`src/services/ai.ts`):**
    - Initialize `GoogleGenerativeAI` client.
    - **Model Selection:** Default to `gemini-1.5-flash` for low latency and high throughput, or `gemini-1.5-pro` for complex reasoning.
    - Implement the "Shield" toggle state in `useStore` (Offline vs. God Mode).

## Phase 2: User Interface (The "God Mode")
- [ ] **Chat Interface (`src/components/ChatOverlay.tsx`):**
    - Create a floating, glassmorphism-styled chat panel.
    - Implement message history state (User vs. AI).
    - **Multimodal Support:**
        - Convert the Viewport to a Base64 image using `html-to-image`.
        - Pass this image part to `model.generateContent` for "Vision" context.
- [ ] **Toolbar Integration:**
    - Add the "Shield" icon/toggle to the main `Toolbar.tsx`.
    - Add a button to open the Chat Overlay.

## Phase 3: The Brain (Context & Logic)
- [ ] **System Instruction (The Persona):**
    - Define a `systemInstruction` that establishes the AI as "Cyberia OS", a spatial operating system helper.
    - Rules: concise answers, spatial awareness, JSON-centric thinking.
- [ ] **Context Builder:**
    - Create a utility `serializeWorkspace()`:
        - Filters out non-essential UI state.
        - Formats `thoughts` and `spaces` into a clean JSON schema for the context window.
- [ ] **Service Integration:**
    - Connect the Chat UI to `services/ai.ts`.

## Phase 4: Active Action (Function Calling)
- [ ] **Tool Definitions (SDK Schema):**
    - Define `functionDeclarations` for the Gemini model:
        - `create_thought(text: string, type: string, x: number, y: number, priority: string)`
        - `update_thought(id: number, updates: object)`
        - `delete_thought(id: number)`
        - `organize_space(strategy: string)` (e.g., "stack", "grid")
- [ ] **Execution Engine:**
    - Implement the `functionCall` handling loop.
    - Map tool calls to `useStore` actions (e.g., `useStore.getState().addThought(...)`).
    - **Physics Integration:** Ensure spawned nodes have `vx/vy` initialization for natural entry.

## Phase 5: Polish & "Magic Moments"
- [ ] **Streaming Responses:** Use `result.stream` for real-time text feedback.
- [ ] **Feedback:** Visual cues (e.g., a "Thinking..." pulse) when the AI is processing.
- [ ] **Safety Settings:** Configure `HarmCategory` and `HarmBlockThreshold` to allow creative freedom while maintaining safety.
