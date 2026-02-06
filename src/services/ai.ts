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
- Spatial: You understand that ideas are physical objects with (x, y) coordinates.
- Unique Stacks: Thoughts can belong to one "Stack" (cluster). Linking thoughts merges their stacks into one larger physical group.
- Proactive: Don't just talk; use tools to create, update, or move thoughts when helpful.

Tools Usage:
- When the user asks to "organize" or "move", use 'update_thought' to change (x, y).
- To group thoughts, use 'link_thoughts' (merges existing stacks or creates new ones).
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
            order: { type: SchemaType.NUMBER, description: "Stacking order for Kanban/Calendar." },
            stackId: { type: SchemaType.STRING, description: "Optional unique stack ID." },
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
            image: { type: SchemaType.STRING, description: "URL or Base64 image data." }
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
            order: { type: SchemaType.NUMBER, description: "Stacking order for Kanban/Calendar." },
            stackId: { type: SchemaType.STRING, description: "Assign to a specific stack." },
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
            }
          },
          required: ["id"]
        }
      },
      {
        name: "link_thoughts",
        description: "Links multiple thoughts together into a single Stack (Cluster).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            ids: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER }, description: "IDs of thoughts to link." }
          },
          required: ["ids"]
        }
      },
      {
        name: "unlink_thought",
        description: "Removes a thought from its current stack.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.NUMBER, description: "The ID of the thought to unlink." }
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
export let ACTIVE_MODEL_NAME = DEFAULT_MODEL;

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

      case 'link_thoughts': {
        const ids = args.ids as number[];
        store.setSelectedThoughtIds(ids);
        await store.linkSelectedThoughts();
        store.setSelectedThoughtIds([]);
        return { success: true, message: `Linked ${ids.length} thoughts into a stack.` };
      }

      case 'unlink_thought': {
        const id = args.id as number;
        store.setSelectedThoughtIds([id]);
        await store.unlinkSelectedThoughts();
        store.setSelectedThoughtIds([]);
        return { success: true, message: `Removed thought ${id} from its stack.` };
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
    const store = useStore.getState();
    const isPro = store.activeModel.includes('-pro');
    const isThinkingEnabled = store.thinkingMode || isPro;

    if (!chatSession) {
      if (!model) throw new Error('AI Service not initialized. Please provide an API Key.');
      
      const generationConfig: any = {
        maxOutputTokens: 2000,
      };

      if (isThinkingEnabled) {
        generationConfig.thinkingConfig = {
          includeThoughts: false
        };
      }

      chatSession = model.startChat({
        generationConfig,
        history: [],
      });
    }

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
      chatSession = null;
      throw error;
    }
  },

  sendMessageStream: async (message: string, onChunk: (text: string) => void, onStatus?: (status: string) => void, imageBase64?: string) => {
    const store = useStore.getState();
    const isPro = store.activeModel.includes('-pro');
    const isThinkingEnabled = store.thinkingMode || isPro;

    if (!chatSession) {
      if (!model) throw new Error('AI Service not initialized. Please provide an API Key.');
      
      const generationConfig: any = {
        maxOutputTokens: 2000,
      };

      if (isThinkingEnabled) {
        generationConfig.thinkingConfig = {
          includeThoughts: false
        };
      }

      chatSession = model.startChat({
        generationConfig,
        history: [],
      });
    }

    try {
      const parts: Part[] = [{ text: message }];
      if (imageBase64) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        parts.push({
          inlineData: { data: base64Data, mimeType: 'image/png' }
        });
      }

      let result = await chatSession.sendMessageStream(parts);
      let fullText = "";
      
      for await (const chunk of result.stream) {
        try {
          const chunkText = chunk.text();
          if (chunkText) {
            fullText += chunkText;
            onChunk(fullText);
          }
        } catch (e) {
          // This happens if the chunk is a function call rather than text
          console.log("[Oracle] Received non-text chunk (likely tool call)");
        }
      }

      let response = await result.response;
      
      // Function Calling Loop (Max 5 turns)
      let turns = 0;
      while (response.functionCalls() && turns < 5) {
        turns++;
        const calls = response.functionCalls();
        const functionResponses = [];
        
        if (calls) {
          for (const call of calls) {
            console.log(`[Oracle] Executing tool: ${call.name}`, call.args);
            
            // Status Updates
            if (onStatus) {
              if (call.name === 'create_thought') onStatus("Creating a new thought...");
              else if (call.name === 'update_thought') onStatus("Organizing your workspace...");
              else if (call.name === 'delete_thought') onStatus("Removing a thought...");
            }

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
          // IMPORTANT: Disable thinkingConfig for the follow-up turn to prevent API conflicts
          // Tool result turns are highly structural; deep reasoning can cause 400 errors here.
          const toolResult = await chatSession.sendMessageStream(functionResponses, {
            thinkingConfig: { includeThoughts: false }
          } as any);
          
          fullText = ""; // Reset for the final explanation turn
          if (onStatus) onStatus("Oracle is processing...");
          
          for await (const chunk of toolResult.stream) {
            try {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                onChunk(fullText);
              }
            } catch (e) {
              // Non-text chunk
            }
          }
          response = await toolResult.response;
        }
      }

      return fullText;
    } catch (error) {
      console.error('Gemini API Error:', error);
      chatSession = null;
      throw error;
    }
  },

  isInitialized: () => !!model,
};