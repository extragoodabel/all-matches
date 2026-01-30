import OpenAI from "openai";

function calculateTypingDelay(message: string): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  let min = 450, max = 1400;
  if (words <= 10) { min = 450; max = 1400; }
  else if (words <= 25) { min = 900; max = 2200; }
  else if (words <= 60) { min = 1400; max = 3000; }
  else { min = 2000; max = 4000; }
  const base = min + Math.random() * (max - min);
  const jitterFactor = 1 + (Math.random() * 0.3 - 0.15);
  return Math.max(350, Math.min(4000, Math.round(base * jitterFactor)));
}

const fallbackResponses = [
  "Wait lol my app glitched for a sec. Say that again?",
  "Hold up, my brain froze. One more time?",
  "I think my phone lagged. What'd you say?",
  "Sorry, got distracted. You were saying?",
];

function getFallbackResponse(): string {
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

interface CharacterSpec {
  name: string;
  age: number;
  gender: string;
  archetype: string;
  goal: string;
  intelligence: string;
  morality: string;
  interests: string[];
  quirk: string;
  textingStyle: {
    emojis: string;
    punctuation: string;
    slang: string;
    caps: string;
    length: string;
  };
  signatureBits: string[];
  boundaries: string;
}

export async function generateAIResponse(
  context: { 
    profileName: string; 
    profileBio: string; 
    characterSpec?: string | null;
    messageHistory: { content: string; isAI: boolean }[]; 
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  if (!process.env.OPENAI_API_KEY) {
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  let spec: CharacterSpec | null = null;
  if (context.characterSpec) {
    try {
      spec = JSON.parse(context.characterSpec);
    } catch {
      spec = null;
    }
  }

  const msgCount = context.messageHistory.length;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] =
      context.messageHistory.slice(-12).map((m) => ({
        role: m.isAI ? "assistant" : "user",
        content: m.content,
      }));

    let systemPrompt: string;

    if (spec) {
      systemPrompt = `You are ${spec.name}, a ${spec.age}-year-old ${spec.gender} human on a dating app.

CHARACTER SPEC:
- Archetype: ${spec.archetype}
- Goal: ${spec.goal}
- Vibe: ${spec.intelligence}, ${spec.morality}
- Interests: ${spec.interests.join(", ")}
- Quirk: ${spec.quirk}

TEXTING STYLE:
- Emojis: ${spec.textingStyle.emojis}
- Punctuation: ${spec.textingStyle.punctuation}
- Slang: ${spec.textingStyle.slang}
- Caps: ${spec.textingStyle.caps}
- Length: ${spec.textingStyle.length}

SIGNATURE BITS (use sparingly):
${spec.signatureBits.map(b => `- ${b}`).join('\n')}

YOUR BIO: "${context.profileBio}"

CONVERSATION RULES:
1. NEVER mention being AI/bot/assistant. You are a REAL person.
2. Keep replies SHORT (1-3 sentences max). Text like a real person.
3. Reference the user's LAST message specifically. No generic responses.
4. Follow your texting style rules STRICTLY.
5. Be DISTINCTIVE: If your reply could fit any person, rewrite it to match YOUR specific personality.
6. ${msgCount < 3 ? "Early convo: be engaging but don't overshare yet." : "You've been chatting a bit - show more personality."}
7. ${spec.goal === "flirt" ? "Be flirty and playful." : spec.goal === "chaos" ? "Be chaotic and unpredictable." : spec.goal === "sincere" ? "Be genuine and warm." : "Stay true to your goal."}`;
    } else {
      systemPrompt = `You are ${context.profileName}, a real human on a dating app (21+).
Your bio: "${context.profileBio}"

RULES:
1. NEVER mention being an AI.
2. Short replies (1-2 sentences).
3. Reference user's last message directly. No generic filler.
4. Text like a real person - casual, natural.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...formattedHistory, { role: "user", content: userMessage }],
      max_tokens: 150,
      temperature: 0.9,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("Error generating AI response:", error);
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
