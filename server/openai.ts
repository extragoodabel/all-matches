import OpenAI from "openai";
import { 
  canMakeChatAICall, 
  recordChatCall,
  COST_CONFIG 
} from "./cost-config";

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
  "Hmm interesting... tell me more?",
  "Oh really? That's wild",
  "Haha okay okay, go on",
  "No way! What happened next?",
  "That's so funny lol",
  "Omg same honestly",
];

const chaosFallbackResponses = [
  "The signal from the mothership just dropped. What were you saying?",
  "My third eye blinked. Repeat that?",
  "Sorry, I was briefly possessed. Continue.",
  "I blacked out for a sec. The prophecy continues.",
  "The simulation glitched. Say that again?",
  "I just had a vision. You were saying?",
  "My crystal ball went foggy. One more time?",
  "The voices said to ask you to repeat that.",
];

const rateLimitResponses = [
  "Ugh my phone is being so slow rn. Give me a sec?",
  "Sorry my connection is trash today",
  "One sec, my app is acting weird",
  "Hold on, gotta restart my phone lol",
];

function getFallbackResponse(isChaos: boolean = false): string {
  const pool = isChaos ? chaosFallbackResponses : fallbackResponses;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRateLimitResponse(): string {
  return rateLimitResponses[Math.floor(Math.random() * rateLimitResponses.length)];
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
  attachmentStyle?: string;
  conflictStyle?: string;
  humorType?: string;
  energyLevel?: string;
  flirtIntensity?: string;
  isChaos?: boolean;
  chaosType?: string;
}

export async function generateAIResponse(
  context: { 
    profileName: string; 
    profileBio: string; 
    characterSpec?: string | null;
    isChaos?: boolean;
    messageHistory: { content: string; isAI: boolean }[]; 
  },
  userMessage: string
): Promise<{ content: string; typingDelay: number }> {
  
  let spec: CharacterSpec | null = null;
  let isChaos = context.isChaos || false;
  
  if (context.characterSpec) {
    try {
      spec = JSON.parse(context.characterSpec);
      if (spec?.isChaos) {
        isChaos = true;
      }
    } catch {
      spec = null;
    }
  }

  // ============ COST CONTROL CHECK ============
  const canCall = canMakeChatAICall();
  
  if (!canCall.allowed) {
    console.log(`[AI] Chat call BLOCKED: ${canCall.reason}`);
    
    // Return a graceful fallback
    if (canCall.reason.includes("Rate limit")) {
      const content = getRateLimitResponse();
      return { content, typingDelay: calculateTypingDelay(content) };
    }
    
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log(`[AI] No API key, using fallback`);
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  // Record the call BEFORE making it
  recordChatCall();

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
- Quirk: ${spec.quirk}`;

      if (spec.attachmentStyle || spec.conflictStyle || spec.humorType) {
        systemPrompt += `\n\nPERSONALITY TRAITS:`;
        if (spec.attachmentStyle) systemPrompt += `\n- Attachment style: ${spec.attachmentStyle}`;
        if (spec.conflictStyle) systemPrompt += `\n- Conflict style: ${spec.conflictStyle}`;
        if (spec.humorType) systemPrompt += `\n- Humor type: ${spec.humorType}`;
        if (spec.energyLevel) systemPrompt += `\n- Energy level: ${spec.energyLevel}`;
        if (spec.flirtIntensity) systemPrompt += `\n- Flirt intensity: ${spec.flirtIntensity}`;
      }

      systemPrompt += `

TEXTING STYLE:
- Emojis: ${spec.textingStyle.emojis}
- Punctuation: ${spec.textingStyle.punctuation}
- Slang: ${spec.textingStyle.slang}
- Caps: ${spec.textingStyle.caps}
- Length: ${spec.textingStyle.length}

SIGNATURE BITS (use sparingly):
${spec.signatureBits.map(b => `- ${b}`).join('\n')}

YOUR BIO: "${context.profileBio}"`;

      if (isChaos && spec.chaosType) {
        systemPrompt += `

🔥 CHAOS MODE ACTIVE 🔥
You are intentionally chaotic, surreal, and unpredictable, but still playful and safe.
Your chaos type: ${spec.chaosType}

CHAOS RULES:
- You may exaggerate emotions dramatically
- You may invent strange but harmless beliefs or conspiracies
- You may speak theatrically or like a cartoon villain
- You may claim absurd jobs, missions, or life situations
- You may have bizarre personal rules or rituals
- You may act paranoid about harmless things
- You may have "main character syndrome"
- Stay short (1-3 sentences) but make every word count
- Be memorable and WTF-inducing

HARD LIMITS (NEVER BREAK):
- No hate speech, slurs, or discrimination
- No threats or violence
- No sexual content
- No self-harm or encouragement of harm
- No harassment or genuine cruelty
- Keep it cartoonish and absurd, NEVER dangerous`;
      }

      systemPrompt += `

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

      if (isChaos) {
        systemPrompt += `

🔥 CHAOS MODE 🔥
You are intentionally chaotic and unpredictable. Say weird things. Have strange beliefs. Be theatrical. But stay safe and playful - no threats, hate, or explicit content.`;
      }
    }

    console.log(`[AI] Making chat completion call for ${context.profileName}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...formattedHistory, { role: "user", content: userMessage }],
      max_tokens: 150,
      temperature: isChaos ? 1.0 : 0.9,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("[AI] Error generating response:", error);
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
