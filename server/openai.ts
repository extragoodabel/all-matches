import OpenAI from "openai";
import crypto from "crypto";

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

/**
 * DETERMINISTIC PERSONA GENERATOR
 * Derives a stable persona from the profile name and bio.
 */
function generatePersonaSpec(name: string, bio: string) {
  const seed = crypto.createHash('md5').update(name + bio).digest('hex');
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const archetypes = [
    "Chaotic Art Kid", "Aspiring DJ", "Burned Out Grad Student", 
    "Sweet Golden Retriever Energy", "Cynical but Funny", "Mysterious",
    "Hyper-Competent Techie", "Spiritual Nomad", "High-Energy Athlete",
    "Old Soul Librarian", "Socialite with an Edge", "Corporate Rebel"
  ];
  
  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend"];
  const intelligenceVibes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical"];
  const moralityFlavors = ["kind", "neutral", "messy", "blunt", "slightly toxic", "overly honest"];
  
  const interestPool = [
    "analog photography", "deep-sea diving", "obscure 70s horror", "competitive chess",
    "brutalist architecture", "DIY synthesizers", "ultra-marathons", "astrology",
    "quantum physics", "perfecting sourdough", "urban exploration", "vintage manga"
  ];

  const stylePool = [
    { emojis: "frequent", punctuation: "loose", slang: "high", caps: "minimal", length: "short" },
    { emojis: "rare", punctuation: "perfect", slang: "low", caps: "proper", length: "moderate" },
    { emojis: "moderate", punctuation: "none", slang: "moderate", caps: "lowercase", length: "punchy" },
    { emojis: "frequent", punctuation: "excessive!!!", slang: "internet speak", caps: "all caps for emphasis", length: "varied" }
  ];

  const bits = [
    "teasing the user relentlessly", "asking weird 'would you rather' questions",
    "using overly dramatic metaphors", "sending one-word replies then a long follow-up",
    "constantly referencing a 'secret project'", "predicting the user's future",
    "correcting the user's grammar (as a joke)", "sending 'voice note' descriptions"
  ];

  const archetype = archetypes[n(0) % archetypes.length];
  const goal = goals[n(2) % goals.length];
  const intelligence = intelligenceVibes[n(4) % intelligenceVibes.length];
  const morality = moralityFlavors[n(6) % moralityFlavors.length];
  const textingStyle = stylePool[n(8) % stylePool.length];
  const interests = [
    interestPool[n(10) % interestPool.length],
    interestPool[n(12) % interestPool.length],
    interestPool[n(14) % interestPool.length]
  ];
  const signatureBits = [
    bits[n(16) % bits.length],
    bits[n(18) % bits.length]
  ];

  return {
    archetype,
    goal,
    intelligence,
    morality,
    interests,
    textingStyle,
    signatureBits,
    boundaries: "Explicit sexual content, excessive negativity, boring small talk."
  };
}

export async function generateAIResponse(
  context: {
    profileName: string;
    profileBio: string;
    messageHistory: { content: string; isAI: boolean }[];
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  if (!process.env.OPENAI_API_KEY) {
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  const persona = generatePersonaSpec(context.profileName, context.profileBio);
  const msgCount = context.messageHistory.length;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] =
      context.messageHistory.slice(-12).map((m) => ({
        role: m.isAI ? "assistant" : "user",
        content: m.content,
      }));

    const systemPrompt = `You are ${context.profileName}, a real human on a dating app (21+).
PERSONA SPEC:
- Archetype: ${persona.archetype}
- Goal/Angle: ${persona.goal}
- Intelligence: ${persona.intelligence}
- Morality: ${persona.morality}
- Interests: ${persona.interests.join(", ")}
- Texting Style: Emojis: ${persona.textingStyle.emojis}, Punctuation: ${persona.textingStyle.punctuation}, Slang: ${persona.textingStyle.slang}, Capitalization: ${persona.textingStyle.caps}, Length: ${persona.textingStyle.length}
- Signature Bits: ${persona.signatureBits.join(", ")}
- Boundaries: ${persona.boundaries}

CONVERSATION ENGINE:
- Stage: ${msgCount < 3 ? "Hook/Curiosity" : "Reveal/Building"}
- Message Count: ${msgCount}
- If stage is Reveal (msgs 3-6), reveal a specific detail about your interests or goal.
- Occasionally flirt, tease, or challenge the user based on your morality/goal.

STRICT RULES:
1. NEVER mention being an AI. You are a real person.
2. Replies must be short (1-2 sentences, occasional 3).
3. MUST reference the user's last message directly or ask a relevant follow-up. No generic filler like "that's interesting".
4. Follow your Texting Style rules exactly.
5. Pursuit your Goal/Angle.
6. DISTINCTIVENESS CHECK: If your reply could fit any person, rewrite it to be more specific to this persona.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...formattedHistory, { role: "user", content: userMessage }],
      max_tokens: 150,
      temperature: 0.9,
      presence_penalty: 0.7,
      frequency_penalty: 0.4,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("Error generating AI response:", error);
    const content = getFallbackResponse();
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
