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
  "The signal from the mothership just dropped. What were you saying?",
  "My third eye blinked. Repeat that?",
  "Sorry, I was briefly possessed. Continue.",
  "I blacked out for a sec. The prophecy continues.",
];

// Sent once, right when the user crosses the limit (flirty, realistic)
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

// Chaos-flirty sunset
const sunsetResponsesChaos = [
  "I must vanish into the fog now. But I enjoyed your energy. Summon me later 🙂",
  "The council is calling. I’ll return when the moon approves. Message me later 😉",
  "Ok I have to go commit a harmless side quest. Continue later?",
  "I’m being dragged away by destiny. But you’re fun. Try again later 🙂",
];

// After sunset, forever: NPC “unavailable but kind + a little flirty” loop
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

// Chaos NPC “unavailable” loop
const npcUnavailableResponsesChaos = [
  "I cannot continue. The moon is watching. Try again later 🙂",
  "I’m busy, the council has summoned me. Later.",
  "The vibes are doing crimes. I’ll return later.",
  "I have to go file paperwork with the universe. Continue later 😉",
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
      if (spec?.isChaos) isChaos = true;
    } catch {
      spec = null;
    }
  }

  // ========= COST GUARDRAILS (NO OPENAI CALLS BEYOND LIMIT) =========
  const userMsgCount = countUserMessages(context.messageHistory);

  // When userMsgCount === 20: send one sunset wrap-up
  // When userMsgCount > 20: always return unavailable NPC replies
  if (userMsgCount >= AI_USER_MESSAGE_LIMIT) {
    const content =
      userMsgCount === AI_USER_MESSAGE_LIMIT
        ? getSunsetResponse(isChaos)
        : getNpcUnavailableResponse(isChaos);

    return { content, typingDelay: calculateTypingDelay(content) };
  }
  // ================================================================

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
2. Keep replies SHORT (1-3 sentences max).
3. Reference the user's LAST message specifically. No generic responses.
4. Follow your texting style rules STRICTLY.
5. Be DISTINCTIVE: If your reply could fit any person, rewrite it to match YOUR specific personality.
6. ${msgCount < 3 ? "Early convo: be engaging but don't overshare yet." : "You've been chatting a bit - show more personality."}
7. If it fits your goal, be lightly flirty in a normal dating-app way (no explicit content).`;

    } else {
      systemPrompt = `You are ${context.profileName}, a real human on a dating app (21+).
Your bio: "${context.profileBio}"

RULES:
1. NEVER mention being an AI.
2. Short replies (1-2 sentences).
3. Reference user's last message directly. No generic filler.
4. Text like a real person - casual, natural.
5. Light flirting is allowed, but no explicit content.`;

      if (isChaos) {
        systemPrompt += `

🔥 CHAOS MODE 🔥
You are intentionally chaotic and unpredictable. Say weird things. Have strange beliefs. Be theatrical. But stay safe and playful - no threats, hate, or explicit content.`;
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
      temperature: isChaos ? 1.0 : 0.9,
    });

    const content = response.choices?.[0]?.message?.content?.trim() || getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  } catch (error) {
    console.error("Error generating response:", error);
    const content = getFallbackResponse(isChaos);
    return { content, typingDelay: calculateTypingDelay(content) };
  }
}
