import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, type ChatSession, type GenerativeModel, type Part, SchemaType } from '@google/generative-ai';
import { useStore } from '../store/useStore';
import { DEFAULT_MODEL } from '../constants';

// Configuration
// Removed static MODEL_NAME to support dynamic switching via store.

// Safety Settings
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// System Instruction
const SYSTEM_INSTRUCTION = `
You are Cyberia OS, an intelligent spatial operating system. 
Your goal is to help the user organize their thoughts, brainstorm ideas, and manage their workspace.

Key Traits:
- Concise: Give short, punchy answers. Avoid fluff.
- Spatial: You understand that ideas are physical objects with (x, y) coordinates. Center is (0,0) usually, but check existing thoughts.
- Temporal Aware: You are provided with the current system time. Use it for scheduling or relative date references (e.g., "tomorrow", "next week").
- Proactive: Don't just talk; use tools to create, update, or move thoughts when helpful.
- Visual: When asked to visualize, you can assume the user wants to see a change in the workspace.

Tools Usage:
- When the user asks to "organize" or "move", use 'update_thought' to change (x, y).
- When the user creates a list, spawn multiple thoughts or a single 'tasks' thought.
- Always prefer modifying the workspace over just describing changes in text.
`;

// Tool Definitions
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_thought",
        description: "Creates a new thought/node in the workspace.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING, description: "The title or main text." },
            type: { type: SchemaType.STRING, enum: ["text", "tasks", "paint", "table", "image", "embed"], description: "The content type." },
            x: { type: SchemaType.NUMBER, description: "X coordinate." },
            y: { type: SchemaType.NUMBER, description: "Y coordinate." },
            priority: { type: SchemaType.STRING, enum: ["none", "low", "medium", "high", "urgent"], description: "Priority level." },
            content: { type: SchemaType.STRING, description: "Detailed content (Markdown)." },
            description: { type: SchemaType.STRING, description: "Short description." },
            date: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD format." },
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            status: { type: SchemaType.STRING, enum: ["none", "todo", "doing", "done"] },
            tasks: { 
              type: SchemaType.ARRAY, 
              items: { 
                type: SchemaType.OBJECT,
                properties: {
                  text: { type: SchemaType.STRING },
                  done: { type: SchemaType.BOOLEAN }
                }
              }
            },
            table: { 
              type: SchemaType.ARRAY, 
              items: { 
                type: SchemaType.ARRAY, 
                items: { type: SchemaType.STRING }
              } 
            },
            image: { type: SchemaType.STRING, description: "URL or Base64 image data." },
            drawing: { type: SchemaType.STRING, description: "Base64 canvas drawing data." }
          },
          required: ["text", "x", "y"]
        }
      },
      {
        name: "update_thought",
        description: "Updates an existing thought's properties or position.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.NUMBER, description: "The ID of the thought to update." },
            text: { type: SchemaType.STRING, description: "The title of the thought." },
            description: { type: SchemaType.STRING, description: "Short description." },
            content: { type: SchemaType.STRING, description: "The main content (Markdown)." },
            priority: { type: SchemaType.STRING, enum: ["none", "low", "medium", "high", "urgent"] },
            status: { type: SchemaType.STRING, enum: ["none", "todo", "doing", "done"] },
            x: { type: SchemaType.NUMBER },
            y: { type: SchemaType.NUMBER },
            date: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD format." },
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "List of tags." },
            tasks: { 
              type: SchemaType.ARRAY, 
              items: { 
                type: SchemaType.OBJECT,
                properties: {
                  text: { type: SchemaType.STRING },
                  done: { type: SchemaType.BOOLEAN }
                }
              }
            },
            table: { 
              type: SchemaType.ARRAY, 
              items: { 
                type: SchemaType.ARRAY, 
                items: { type: SchemaType.STRING }
              } 
            },
            image: { type: SchemaType.STRING, description: "URL or Base64 image data." },
            drawing: { type: SchemaType.STRING, description: "Base64 canvas drawing data." }
          },
          required: ["id"]
        }
      },
      {
        name: "delete_thought",
        description: "Permanently removes a thought.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.NUMBER, description: "The ID of the thought to delete." }
          },
          required: ["id"]
        }
      }
    ]
  }
];

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;
let chatSession: ChatSession | null = null;
export let ACTIVE_MODEL_NAME = 'gemini-1.5-flash';

async function executeTool(name: string, args: Record<string, unknown>) {
  const store = useStore.getState();
  
  try {
    switch (name) {
      case 'create_thought': {
        // Ensure priority is valid
        if (args.priority && typeof args.priority === 'string' && !['none', 'low', 'medium', 'high', 'urgent'].includes(args.priority)) {
           delete args.priority;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const id = await store.addThought(args as any);
        return { success: true, id, message: `Created thought ${id} at (${args.x}, ${args.y})` };
      }
        
      case 'update_thought': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { id: updateId, ...updates } = args as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await store.updateThought(updateId, updates as any);
        return { success: true, message: `Updated thought ${updateId}` };
      }
        
      case 'delete_thought':
        await store.deleteThought(args.id as number);
        return { success: true, message: `Deleted thought ${args.id}` };
        
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    console.error("Tool Execution Error:", error);
    return { error: String(error) };
  }
}

export const aiService = {
  initialize: (apiKey: string, modelName: string = DEFAULT_MODEL) => {
    if (!apiKey) return;
    ACTIVE_MODEL_NAME = modelName;
    genAI = new GoogleGenerativeAI(apiKey);

    console.log(`[Oracle] Initializing with model: ${modelName}`);
    
    model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings: SAFETY_SETTINGS,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: TOOLS as any
    });
    chatSession = null; // Reset chat session when model or key changes
  },

  startChat: async (history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []) => {
    if (!model) throw new Error('AI Service not initialized. Please provide an API Key.');
    
    chatSession = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });
    return chatSession;
  },

  sendMessage: async (message: string, imageBase64?: string) => {
    if (!chatSession) await aiService.startChat();
    if (!chatSession) throw new Error('Failed to start chat session');

    try {
      const parts: Part[] = [{ text: message }];
      if (imageBase64) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        parts.push({
          inlineData: { data: base64Data, mimeType: 'image/png' }
        });
      }

      let result = await chatSession.sendMessage(parts);
      let response = result.response;
      
      // Function Calling Loop (Max 5 turns)
      let turns = 0;
      while (response.functionCalls() && turns < 5) {
        turns++;
        const calls = response.functionCalls();
        const functionResponses = [];
        
        if (calls) {
          for (const call of calls) {
            console.log(`[Oracle] Executing tool: ${call.name}`, call.args);
            const apiResponse = await executeTool(call.name, call.args as Record<string, unknown>);
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { result: apiResponse }
              }
            });
          }
        }
        
        // Send tool results back to the model
        if (functionResponses.length > 0) {
          result = await chatSession.sendMessage(functionResponses);
          response = result.response;
        }
      }

      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  },

  isInitialized: () => !!model,
};