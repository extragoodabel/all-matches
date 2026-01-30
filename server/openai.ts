import OpenAI from "openai";
import crypto from "crypto";

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
  "Wait lol my app glitched for a sec. Say that again? 😅",
  "Hold up, my brain froze. One more time? 😭",
  "I think my phone lagged. What’d you say? 😅",
];

function getFallbackResponse(): string {
  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

function generatePersonaSpec(name: string, bio: string) {
  const seed = crypto.createHash('md5').update(name + bio).digest('hex');
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const archetypes = [
    "Chaotic Art Kid", "Aspiring DJ", "Burned Out Grad Student", "Sweet Golden Retriever Energy",
    "Cynical but Funny", "Mysterious", "Hyper-Competent Techie", "Spiritual Nomad",
    "High-Energy Athlete", "Old Soul Librarian", "Socialite with an Edge", "Corporate Rebel",
    "Indie Musician", "Gamer", "History Buff", "Plant Parent", "Anime Enthusiast",
    "DIY Crafter", "Coffee Snob", "Stargazer", "Urban Gardener", "Vinyl Collector",
    "Puzzle Master", "Street Photographer", "Foodie Blogger", "Tech Minimalist", "Extreme Sports Junkie"
  ];
  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend"];
  const intelligenceVibes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical"];
  const moralityFlavors = ["kind", "neutral", "messy", "blunt", "slightly toxic", "overly honest"];
  const interestPool = [
    "analog photography", "deep-sea diving", "obscure 70s horror", "competitive chess",
    "brutalist architecture", "DIY synthesizers", "ultra-marathons", "astrology",
    "quantum physics", "perfecting sourdough", "urban exploration", "vintage manga",
    "cybersecurity", "botany", "mixology", "poker", "mechanical keyboards", "knitting"
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

  return {
    archetype: archetypes[n(0) % archetypes.length],
    goal: goals[n(2) % goals.length],
    intelligence: intelligenceVibes[n(4) % intelligenceVibes.length],
    morality: moralityFlavors[n(6) % moralityFlavors.length],
    textingStyle: stylePool[n(8) % stylePool.length],
    interests: [interestPool[n(10) % interestPool.length], interestPool[n(12) % interestPool.length], interestPool[n(14) % interestPool.length]],
    signatureBits: [bits[n(16) % bits.length], bits[n(18) % bits.length]],
    boundaries: "Explicit sexual content, excessive negativity, boring small talk."
  };
}

export async function generateAIResponse(
  context: { profileName: string; profileBio: string; messageHistory: { content: string; isAI: boolean }[]; },
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
- Archetype: ${persona.archetype} | Goal: ${persona.goal} | Vibe: ${persona.intelligence}, ${persona.morality}
- Interests: ${persona.interests.join(", ")}
- Style: Emojis: ${persona.textingStyle.emojis}, Punctuation: ${persona.textingStyle.punctuation}, Slang: ${persona.textingStyle.slang}, Caps: ${persona.textingStyle.caps}
- Bits: ${persona.signatureBits.join(", ")}

RULES:
1. NEVER mention being an AI.
2. Short replies (1-2 sentences).
3. Reference user's last message directly. No generic filler.
4. Follow your Style rules.
5. DISTINCTIVENESS: If this reply could fit anyone, rewrite it to be specific to YOUR persona.`;

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
