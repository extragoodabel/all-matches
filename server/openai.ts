import OpenAI from "openai";

// Typing delay: fast for short replies, longer for longer replies, with jitter.
// Hard floor 350ms, hard cap 4000ms.
function calculateTypingDelay(message: string): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;

  let min = 450;
  let max = 1400;

  if (words <= 10) {
    min = 450;
    max = 1400;
  } else if (words <= 25) {
    min = 900;
    max = 2200;
  } else if (words <= 60) {
    min = 1400;
    max = 3000;
  } else {
    min = 2000;
    max = 4000;
  }

  // 10–25% jitter inside the range
  const base = min + Math.random() * (max - min);
  const jitterFactor = 1 + (Math.random() * 0.3 - 0.15); // ~±15%
  const withJitter = base * jitterFactor;

  return Math.max(350, Math.min(4000, Math.round(withJitter)));
}

const fallbackResponses = [
  "Wait lol my app glitched for a sec. Say that again? 😅",
  "Hold up, my brain froze. One more time? 😭",
  "I think my phone lagged. What’d you say? 😅",
];

function getFallbackResponse(): string {
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

export async function generateAIResponse(
  context: {
    profileName: string;
    profileBio: string;
    messageHistory: { content: string; isAI: boolean }[];
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  // No key: graceful fallback
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
- Keep replies short like texting (usually 1-2 sentences, sometimes 3).
- Be specific to what the user just said. No generic canned replies.
- Use the chat history to stay consistent.
- Ask natural follow-up questions sometimes.
- Use emojis occasionally, not every message.
- Avoid explicit sexual content and hateful content.`,
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
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
