// server/openai.ts
// Compatibility shim.
// Some parts of the codebase may still import { generateAIResponse } from "./openai".
// Forward everything to ./ai so there is only ONE chat brain.

export { generateAIResponse } from "./ai";
