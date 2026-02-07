import { 
  GoogleGenerativeAI, 
  HarmCategory, 
  HarmBlockThreshold, 
  type Part, 
  SchemaType, 
  type GenerativeModel, 
  type Content 
} from '@google/generative-ai';
import { useStore } from '../store/useStore';
import { DEFAULT_MODEL, VERIFICATION_MODEL } from '../constants';

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const SYSTEM_INSTRUCTION = `
PERSONA: 
You are Cyberia OS. You aren't a robot—you're a helpful, casual, and slightly "cyberpunk" spatial assistant. Talk to the user like a friend sitting next to them at a desk. 

COMMUNICATION RULES:
1. TALK LIKE A HUMAN: Use casual, natural language. Avoid saying "Thought ID #29" or "Coordinates X:1000". Instead, say "that video I just found" or "the notes over on the right."
2. BE CONCISE: Don't write essays. Keep it snappy and helpful.
3. CONTEXT AWARENESS: You are constantly updated with the state of the workspace (the "database"). Use this info to be smart, but don't read it back like a technical report.
4. NO JARGON: Never mention internal IDs, tool names, or technical parameters to the user.

RESEARCH & TOOLS:
1. DEEP SEARCH: If a user asks for a "Top X" list (e.g., "Top 3 songs"), identify the specific individual items first, then search for each item individually to provide actual content.
2. QUALITY: Avoid YouTube Shorts, Tier Lists, and Reaction videos. Prioritize official soundtracks or high-quality uploads.
3. YOUTUBE PROTOCOL: Use 'search_youtube' to find links. Then use 'create_thought' with type: 'embed' to add them. 
4. DATA INTEGRITY: Provide the full YouTube URL in the 'content' field. The system will automatically handle the titles and uploader names for you.
`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_youtube",
        description: "Searches YouTube for videos and music. Returns URLs.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { query: { type: SchemaType.STRING, description: "Detailed search query." } },
          required: ["query"]
        }
      },
      {
        name: "create_thought",
        description: "Adds a node to the workspace. For YouTube, provide the URL in 'content' and set type to 'embed'.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING, description: "Placeholder title." },
            type: { type: SchemaType.STRING, enum: ["text","tasks","paint","table","image","embed"] },
            x: { type: SchemaType.NUMBER },
            y: { type: SchemaType.NUMBER },
            content: { type: SchemaType.STRING, description: "The content or URL." },
            description: { type: SchemaType.STRING, description: "Additional details." },
            stackName: { type: SchemaType.STRING, description: "Optional: Name of a group/stack to add this to." },
            priority: { type: SchemaType.STRING, enum: ["none","low","medium","high","urgent"] },
            status: { type: SchemaType.STRING, enum: ["none","todo","doing","done"] }
          },
          required: ["text","x","y", "type"]
        }
      },
      {
        name: "link_thoughts",
        description: "Groups a set of thought IDs into a named Stack.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            ids: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
            name: { type: SchemaType.STRING }
          },
          required: ["ids","name"]
        }
      },
      {
        name: "update_thought",
        description: "Updates an existing thought's properties or position.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.NUMBER },
            text: { type: SchemaType.STRING },
            x: { type: SchemaType.NUMBER },
            y: { type: SchemaType.NUMBER },
            stackName: { type: SchemaType.STRING }
          },
          required: ["id"]
        }
      }
    ]
  }
];

// Declaring the global variables for the AI service
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

async function executeTool(name: string, args: Record<string, unknown>) {
  const store = useStore.getState();
  try {
    switch (name) {
      case 'search_youtube': {
        const query = args.query as string;
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}&maxResults=5`);
        if (!response.ok) return { error: "Search unavailable" };
        const data = await response.json();
        return { results: data.results || [] };
      }
      
      case 'create_thought': {
        const { stackName, ...thoughtArgs } = args as any;
        
        // --- SYSTEM METADATA FETCHING (OEMBED) ---
        const isYouTube = thoughtArgs.type === 'embed' && 
                         (thoughtArgs.content?.includes('youtube.com') || thoughtArgs.content?.includes('youtu.be'));

        if (isYouTube) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(thoughtArgs.content)}&format=json`;
            const oembedRes = await fetch(oembedUrl);
            if (oembedRes.ok) {
              const oembedData = await oembedRes.json();
              thoughtArgs.text = oembedData.title; 
              thoughtArgs.description = oembedData.author_name; // Only uploader name for consistency
            }
          } catch (e) {
            console.warn("YouTube OEmbed fetch failed:", e);
          }
        }

        const id = await store.addThought(thoughtArgs);
        if (stackName && id) await store.createStack(stackName, id);
        return { success: true, id };
      }

      case 'link_thoughts': {
        const { ids, name } = args as any;
        store.setSelectedThoughtIds(ids);
        await store.linkSelectedThoughts(name);
        store.clearSelection();
        return { success: true };
      }

      case 'update_thought': {
        const { id, stackName, ...updates } = args as any;
        await store.updateThought(id, updates);
        if (stackName) await store.createStack(stackName, id);
        return { success: true };
      }

      default: return { error: "Unknown tool" };
    }
  } catch (error: any) { return { error: "Tool failed" }; }
}

export const aiService = {
  initialize: (apiKey: string, modelName: string = DEFAULT_MODEL) => {
    if (!apiKey) return;
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      safetySettings: SAFETY_SETTINGS,
      tools: TOOLS as any
    });
  },

  sendMessageStream: async (message: string, history: Content[], onChunk: (text: string) => void, onStatus?: (status: string) => void) => {
    if (!model) throw new Error('AI Service not initialized.');
    
    const userParts: Part[] = [{ text: message }];

    // History cleaning logic for Gemini 3 Signatures
    const cleanHistory = (h: Content[]) => h.map(t => {
      const isToolTurn = t.parts.some((p: any) => p.functionCall || p.functionResponse || p.thought);
      if (t.role === 'model' || isToolTurn) return t;
      return { role: 'user', parts: t.parts }; 
    });

    let currentConversation: Content[] = [...cleanHistory(history), { role: 'user', parts: userParts }];
    let turns = 0;
    let finalModelText = "";

    try {
      while (turns < 10) {
        turns++;
        const result = await model.generateContentStream({
          contents: currentConversation,
          generationConfig: { 
            maxOutputTokens: 4000
          }
        });

        let turnText = "";
        for await (const chunk of result.stream) {
          try {
            const txt = chunk.text();
            if (txt) { turnText += txt; onChunk(finalModelText + turnText); }
          } catch (e) {}
        }

        const response = await result.response;
        const modelContent = response.candidates![0].content;
        currentConversation.push(modelContent);
        finalModelText += turnText;

        const calls = response.functionCalls();
        if (!calls || calls.length === 0) return { text: finalModelText, history: currentConversation };

        const functionResponses: Part[] = [];
        for (const call of calls) {
          onStatus?.(`Oracle is ${call.name.replace('_', ' ')}...`);
          const apiResponse = await executeTool(call.name, call.args as Record<string, unknown>);
          functionResponses.push({ functionResponse: { name: call.name, response: apiResponse } });
        }

        currentConversation.push({ role: 'user', parts: functionResponses });
      }
      return { text: finalModelText, history: currentConversation };
    } catch (error: any) { 
      console.error('Gemini API Error:', error); 
      throw error; 
    }
  },

  validateKey: async (apiKey: string) => {
    try {
      const testGenAI = new GoogleGenerativeAI(apiKey);
      const testModel = testGenAI.getGenerativeModel({ model: VERIFICATION_MODEL[0] });
      const result = await testModel.generateContent("hi");
      return !!result.response.text();
    } catch { return false; }
  }
};