import OpenAI from "openai";

// Simulate typing delay based on message length and add randomness
function calculateTypingDelay(message: string): number {
  const wordsPerMinute = 40;
  const wordCount = message.trim().split(/\s+/).length;
  const minutes = wordCount / wordsPerMinute;

  const baseDelay = minutes * 60 * 1000;
  const randomFactor = 0.2;
  const randomDelay = baseDelay * (1 + (Math.random() * 2 - 1) * randomFactor);

  return Math.min(Math.max(randomDelay, 2000), 6000);
}

const mockResponses = [
  "Wait lol my app glitched for a sec. What were you saying? 😅",
  "Hold up, my brain froze. Say that again? 😭",
  "I think my phone just lagged. One more time? 😅",
];

function getFallbackResponse(): string {
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

export async function generateAIResponse(
  context: {
    profileName: string;
    profileBio: string;
    messageHistory: { content: string; isAI: boolean }[];
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  // If no API key at all, return a graceful fallback
  if (!process.env.OPENAI_API_KEY) {
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] =
      context.messageHistory.slice(-12).map((m) => ({
        role: m.isAI ? "assistant" : "user",
        content: m.content,
      }));

    const systemMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: "system",
      content: `You are ${context.profileName}, a real human on a dating app. You are 21+ years old.
Your profile bio is: "${context.profileBio}"

ROLEPLAY RULES:
- Never mention being an AI or a language model.
- Keep replies short (1-2 sentences), casual, and specific to what the user just said.
- Use the chat history to stay consistent.
- Ask natural follow-up questions sometimes.
- Use emojis occasionally, not every message.`,
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [systemMessage, ...formattedHistory, { role: "user", content: userMessage }],
      max_tokens: 150,
      temperature: 0.85,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("Error generating AI response:", error);

    // If OpenAI is out of quota or errors, don't respond with unrelated canned flirt
