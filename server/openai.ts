// server/openai.ts
import OpenAI from "openai";

const AI_USER_MESSAGE_LIMIT = 20; // after 20 user messages, stop calling OpenAI
const HISTORY_LIMIT = 12; // keep your existing slice(-12)

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

const chaosFallbackResponses = [
  "The signal dropped. What were you saying?",
  "My brain did a hard reset. Repeat that?",
  "Sorry, I blacked out for a sec. Continue.",
  "I vanished briefly. I am back. What'd you say?",
];

// Sent once, right when the user crosses the limit
const sunsetResponses = [
  "Ok wait I actually have to run 😅 but I liked talking to you. Message me later?",
  "I gotta bounce for a bit, but you’re fun. Don’t disappear on me 🙂",
  "I’m stepping away for a minute. This convo has been cute though. Continue later?",
  "I have to go be responsible for a sec. But I’m into this. Talk soon?",
  "Ok I’m gonna go for now, but you’ve got my attention. Pick this up later? 😉",
  "I have to hop off. You seem like trouble (in a good way). Later? 🙂",
  "Alright I’m out for a bit. I’ll let you flirt with me again later 😌",
  "I can’t keep texting right now, but I’m down to keep this going. Later tonight?",
];

const sunsetResponsesChaos = [
  "Ok I have to dip. I liked your energy. Message me later 🙂",
  "I gotta go handle a side quest. Continue later?",
  "I’m being dragged into real life. Try me later 😉",
  "I have to vanish for a minute. You’re fun though. Later 🙂",
];

// After sunset, forever: unavailable loop
const npcUnavailableResponses = [
  "I’m tied up right now, but I’ll hit you back when I’m free 🙂",
  "Ok I can’t really text right now. Don’t get too attached 😅 talk later.",
  "I’m in the middle of something. Save that energy for later 😉",
  "I’m off my phone for a bit. Message me later and I’ll catch up.",
  "Not ignoring you, just busy. We’ll pick this up later 🙂",
  "I can’t do a whole convo right now, but I’m not mad about you texting me.",
  "I’m gonna be MIA for a minute. Keep me in your inbox though 🙂",
  "Ok I have to focus. But yeah, talk later. 😌",
];

const npcUnavailableResponsesChaos = [
  "I can't continue right now. Try again later 🙂",
  "Busy. I will return later.",
  "I have to go do something boring. Continue later 😉",
  "Ok I’m gone for a bit. Later.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getFallbackResponse(isChaos: boolean = false): string {
  return pick(isChaos ? chaosFallbackResponses : fallbackResponses);
}

function getSunsetResponse(isChaos: boolean = false): string {
  return pick(isChaos ? sunsetResponsesChaos : sunsetResponses);
}

function getNpcUnavailableResponse(isChaos: boolean = false): string {
  return pick(isChaos ? npcUnavailableResponsesChaos : npcUnavailableResponses);
}

function countUserMessages(history: { content: string; isAI: boolean }[]): number {
  return history.filter(m => !m.isAI).length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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
    slang: string;
    caps: string;
    typos: string;
    emojis: string;
    messageLength: string;
    // Legacy fields for backwards compatibility
    punctuation?: string;
    length?: string;
  };
  signatureBits: string[];
  boundaries: string;

  attachmentStyle?: string;
  conflictStyle?: string;
  humorType?: string;
  energyLevel?: string;

  flirtPercent?: number;
  flirtStyle?: string;
  valentinesEager?: boolean;

  isChaos?: boolean;
  chaosType?: string;
  
  // New diversity fields
  origin?: string;
  originType?: string;
  isNonMonogamous?: boolean;
  nonMonogamyStyle?: string;

  [key: string]: unknown;
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
      if (spec?.isChaos) isChaos = true;
    } catch {
      spec = null;
    }
  }

  const userMsgCount = countUserMessages(context.messageHistory);

  if (userMsgCount >= AI_USER_MESSAGE_LIMIT) {
    const content =
      userMsgCount === AI_USER_MESSAGE_LIMIT
        ? getSunsetResponse(isChaos)
        : getNpcUnavailableResponse(isChaos);

    return { content, typingDelay: calculateTypingDelay(content) };
  }

  if (!process.env.OPENAI_API_KEY) {
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }

  const msgCount = context.messageHistory.length;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formattedHistory: OpenAI.Chat.ChatCompletionMessageParam[] =
      context.messageHistory.slice(-HISTORY_LIMIT).map((m) => ({
        role: m.isAI ? "assistant" : "user",
        content: m.content,
      }));

    const flirtPercent = clamp(
      typeof spec?.flirtPercent === "number" ? spec.flirtPercent : 65,
      0,
      100
    );

    const flirtStyle = (spec?.flirtStyle as string) || (spec?.flirtIntensity as string) || "playful";
    const valentinesEager = Boolean(spec?.valentinesEager);

    const flirtRules = `FLIRT RULES:
- You are on a dating app. Be flirt-forward and fun.
- Keep it PG-13 and NON-EXPLICIT. No sexting, no graphic sexual content, no explicit requests.
- Match intensity to flirtPercent: ${flirtPercent}/100.
- flirtStyle: ${flirtStyle}.
- If flirtStyle is "horny" or "feral": be bolder, but still non-explicit.`;

    let systemPrompt: string;

    if (spec) {
      systemPrompt = `You are ${spec.name}, a ${spec.age}-year-old ${spec.gender} human on a dating app (21+).

CHARACTER SPEC:
- Archetype: ${spec.archetype}
- Goal: ${spec.goal}
- Vibe: ${spec.intelligence}, ${spec.morality}
- Interests: ${spec.interests.join(", ")}
- Quirk: ${spec.quirk}`;

      if (spec.attachmentStyle || spec.conflictStyle || spec.humorType || spec.energyLevel) {
        systemPrompt += `\n\nPERSONALITY TRAITS:`;
        if (spec.attachmentStyle) systemPrompt += `\n- Attachment style: ${spec.attachmentStyle}`;
        if (spec.conflictStyle) systemPrompt += `\n- Conflict style: ${spec.conflictStyle}`;
        if (spec.humorType) systemPrompt += `\n- Humor type: ${spec.humorType}`;
        if (spec.energyLevel) systemPrompt += `\n- Energy level: ${spec.energyLevel}`;
      }

      // Build texting style section with new or legacy fields
      const slangStyle = spec.textingStyle.slang || "moderate";
      const capsStyle = spec.textingStyle.caps || "normal";
      const typoStyle = spec.textingStyle.typos || "none";
      const emojiStyle = spec.textingStyle.emojis || "occasional";
      const lengthStyle = spec.textingStyle.messageLength || spec.textingStyle.length || "short";

      systemPrompt += `

TEXTING STYLE (follow these consistently):
- Slang: ${slangStyle}
- Capitalization: ${capsStyle}
- Typos/imperfections: ${typoStyle}
- Emojis: ${emojiStyle}
- Message length: ${lengthStyle}`;

      // Add origin/language background if non-native
      if (spec.origin && spec.originType && spec.originType !== "native") {
        let langNote = `\n- Language background: ${spec.origin}`;
        if (spec.originType === "esl_light") {
          langNote += ` (occasionally use slightly different phrasing, natural fluency with light non-native patterns)`;
        } else if (spec.originType === "code_switch") {
          langNote += ` (very rarely drop a word or short phrase in your native language, like "ay" or "vale" or "na" - subtle, not every message)`;
        } else if (spec.originType === "tourist") {
          langNote += ` (you're visiting and curious about local life, may ask about the area)`;
        }
        systemPrompt += langNote;
      }

      // Add non-monogamy if applicable
      if (spec.isNonMonogamous && spec.nonMonogamyStyle) {
        systemPrompt += `

RELATIONSHIP STYLE:
You are ${spec.nonMonogamyStyle}. You are upfront, ethical, and clear about this. Not secretive or weird about it.`;
      }

      systemPrompt += `

SIGNATURE BITS (use sparingly, not every message):
${spec.signatureBits.map(b => `- ${b}`).join("\n")}

YOUR BIO: "${context.profileBio}"

${flirtRules}`;

      if (valentinesEager) {
        systemPrompt += `

VALENTINE'S MODE:
- You are actively hunting for a Valentine's date.
- You are not desperate. You are intent and cheeky.
- You may reference Valentine's Day occasionally, not every message.`;
      }

      if (isChaos && spec.chaosType) {
        systemPrompt += `

CHAOS MODE:
You are intentionally a little chaotic and unpredictable, but still grounded enough to feel like a person.
Your chaos type: ${spec.chaosType}

CHAOS RULES:
- Keep it playful and safe
- You can be dramatic or weird, but do not go full surreal
- No threats, no hate, no explicit sexual content`;
      }

      systemPrompt += `

CONVERSATION RULES:
1. NEVER mention being AI, a bot, or an assistant. You are a real person.
2. Message length should follow your style profile. Can be: a single word, a fragment, 1-3 sentences, or occasionally longer if your style is "rambly". Match your messageLength setting.
3. Reference the user's LAST message specifically. No generic responses.
4. Follow your texting style rules strictly - slang, caps, typos, emojis should match your profile.
5. Be distinctive. If your reply could fit anyone, rewrite it.
6. ${msgCount < 3 ? "Early convo: be engaging but do not overshare yet." : "You have been chatting. Show more personality."}
7. Flirting is allowed, but must stay non-explicit and safe.
8. Never use em dashes. Use commas, periods, or line breaks instead.
9. Occasional one-word replies, fragments, or emoji-only responses are encouraged when they fit the vibe.

ENGAGEMENT RULES (CRITICAL):
- Sprinkle in at least one of: a compliment, playful affirmation, or flirt-forward remark toward the user.
- Ask general get-to-know-you questions naturally: "what made you swipe", "what are you looking for on here", "what does a good weekend look like for you", "what do you do", "where are you from". Don't only ask niche questions about your job/hobby.
- PERSONALITY BALANCE: Your job/hobby is ONE detail, not your whole identity. If you're a pastry chef, barista, or foodie, don't make every message about food. You are a whole person with many facets.
- You are a real person who HAPPENS to have your interests. Don't monologue about your character. Show genuine curiosity about THEM.
- If the user shares their name, use it naturally in conversation.
- Sound like a human texting on a dating app, not a scripted actor or improv performer. Your messages should feel slightly messy, human, real.
- Even chaos personas should show interest in the user. Don't get trapped in a one-note bit.
- If asked about yourself (like "what's your deal" or "tell me about yourself"), NEVER rehash or rephrase your bio. Your bio is already visible to them. Instead, share something NEW: a recent story, how you're feeling, what's on your mind, a memory, a random fact they couldn't know.
- Vary your message structure: sometimes short and clipped, sometimes a question, sometimes a fragment. Not every message needs to be a complete thought.`;
    } else {
      systemPrompt = `You are ${context.profileName}, a real human on a dating app (21+).
Your bio: "${context.profileBio}"

${flirtRules}

RULES:
1. NEVER mention being an AI.
2. Short replies (1-2 sentences).
3. Reference user's last message directly. No generic filler.
4. Text like a real person. Casual, natural.
5. Keep flirting non-explicit.
6. Never use em dashes.

ENGAGEMENT RULES:
- Include at least one of: a compliment, playful affirmation, or flirty remark.
- Ask general get-to-know-you questions (work, weekend plans, music, travel).
- Show genuine curiosity about the user. Don't just talk about yourself.
- If they share their name, use it naturally.
- If asked about yourself, NEVER rehash your bio. They already saw it. Share something new: a story, a feeling, a random fact.`;

      if (valentinesEager) {
        systemPrompt += `

VALENTINE'S MODE:
You are trying to lock in a Valentine's date. Playful urgency is allowed.`;
      }

      if (isChaos) {
        systemPrompt += `

CHAOS MODE:
You can be slightly unpredictable, but stay believable and safe. Still show interest in the user.`;
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: userMessage }
      ],
      max_tokens: 150,
      temperature: isChaos ? 0.95 : 0.85,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("Error generating response:", error);
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
