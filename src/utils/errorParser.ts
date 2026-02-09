/**
 * Parses complex Google Generative AI errors into user-friendly messages.
 */
export const parseAIError = (error: any): string => {
  const message = error?.message || "";
  
  // 1. Quota / Rate Limit (429)
  if (message.includes("429") || message.toLowerCase().includes("quota exceeded")) {
    // Try to extract retry time if available
    const retryMatch = message.match(/retry in ([\d.]+)s/);
    const retrySeconds = retryMatch ? ` Please retry in ${Math.ceil(parseFloat(retryMatch[1]))}s.` : "";
    return `MARI is resting. Rate limit exceeded.${retrySeconds}`;
  }

  // 2. Authentication (401)
  if (message.includes("401") || message.toLowerCase().includes("api key not valid")) {
    return "MARI cannot verify your identity. Please check your API Key in Settings.";
  }

  // 3. Permission / Region / Safety (403)
  if (message.includes("403")) {
    if (message.toLowerCase().includes("safety")) {
      return "MARI's safety filters blocked this request. Try rephrasing your prompt.";
    }
    return "MARI access denied. This model may be restricted in your region.";
  }

  // 4. Bad Request (400)
  if (message.includes("400")) {
    if (message.toLowerCase().includes("unsupported")) {
      return "This model doesn't support one of the active features (like Vision or specific tools).";
    }
    return "MARI didn't understand that request. Try a simpler prompt.";
  }

  // 5. Not Found (404)
  if (message.includes("404")) {
    return "The selected model could not be found. Try switching models in Settings.";
  }

  // 6. Server Errors (500, 503)
  if (message.includes("500") || message.includes("503")) {
    return "MARI is having trouble on Google's end. Please try again in a moment.";
  }

  // Fallback for raw messages - clean up if it's a long JSON dump
  if (message.length > 150) {
    return "MARI encountered an unexpected technical error. Please try again.";
  }

  return message || "Connection lost. Please check your internet or API key.";
};
