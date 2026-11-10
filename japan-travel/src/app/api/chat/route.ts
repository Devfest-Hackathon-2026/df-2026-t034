import { createChatHandler } from "@/lib/server/chat";
import { generateGeminiReply, assessGeminiPlanning } from "@/lib/server/gemini";
import { sharedAccessFromEnvironment } from "@/lib/server/shared-firestore";

// Cache Components uses the default Node.js runtime and disallows its export.
export const POST = createChatHandler({
  getConfiguration: () => ({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    isDevelopment: process.env.NODE_ENV === "development",
    accessMode: process.env.CHAT_ACCESS_MODE,
    publicOrigin: process.env.CHAT_PUBLIC_ORIGIN,
    provider: process.env.GEMINI_PROVIDER,
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
  }),
  generate: generateGeminiReply,
  assess: assessGeminiPlanning,
  log: (event) => console.info(JSON.stringify(event)),
  sharedAccess: sharedAccessFromEnvironment,
});
