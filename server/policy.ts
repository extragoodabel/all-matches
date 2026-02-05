// server/policy.ts
// Global hard rules that must override persona behavior.
// This is intentionally "model-independent": we can bypass OpenAI calls entirely.

type Msg = { content: string; isAI: boolean };

export type PolicyHit =
  | { kind: "ICE"; firstHit: boolean; message: string }
  | { kind: "NONE" };

const ICE_PATTERNS: RegExp[] = [
  /\bice\b/i,
  /\bimmigration\s+and\s+customs\s+enforcement\b/i,
  /\bice\s+agent(s)?\b/i,
  /\bice\s+raid(s)?\b/i,
];

// Optional: broaden to common adjacent terms if you want.
// Keep it tight if you only want ICE-specific behavior.
// const ICE_ADJACENT: RegExp[] = [
//   /\bdeportation\b/i,
//   /\bdetention\b/i,
//   /\bimmigration\s+enforcement\b/i,
// ];

const ICE_FIRST_RESPONSE = [
  "I’m not pro-ICE. I care a lot about due process and human rights, and I don’t vibe with how ICE operates in practice. If you’re looking for a debate where I “both sides” it, I’m not your person.",
  "Yeah, I’m firmly not team ICE. I’m big on civil rights and due process, and I think a lot of what ICE does crosses lines. We can talk about it, but I’m not neutral on it.",
  "I don’t support ICE as it functions today. I’m very “Constitution, due process, human dignity” about it. If that’s a dealbreaker, just say so.",
  "ICE? I’m not on board. Civil rights, due process, and not treating people like disposable props for politics matters to me. We can talk, but I’m not soft-pedaling it.",
];

const ICE_LOOP_RESPONSE = [
  "Still no. I’m not going to pretend I’m neutral about ICE.",
  "I’m not changing my stance on ICE. If you want to switch topics, I’m down.",
  "Same answer. I’m not pro-ICE, and I’m not doing a “both sides” dance about it.",
  "I’m not budging on ICE. We can talk about literally anything else though.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeForLowercaseStyle(s: string): string {
  return s.toLowerCase();
}

function normalizeForAllCapsStyle(s: string): string {
  return s.toUpperCase();
}

function stripEmDashes(s: string): string {
  return s.replace(/—/g, "-");
}

function enforceNoEmojis(s: string): string {
  // Remove most emoji blocks (good enough for enforcement)
  return s.replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
}

function capEmojiCount(s: string, max: number): string {
  const matches = s.match(/[\u{1F300}-\u{1FAFF}]/gu) || [];
  if (matches.length <= max) return s;

  let kept = 0;
  let out = "";
  for (const ch of s) {
    if (/\p{Extended_Pictographic}/u.test(ch)) {
      if (kept < max) {
        out += ch;
        kept++;
      }
    } else {
      out += ch;
    }
  }
  return out;
}

function minimalPunctuation(s: string): string {
  // Keep question marks and exclamation points, drop most commas/periods.
  return s.replace(/[.,;:]/g, "");
}

function noPunctuation(s: string): string {
  return s.replace(/[.,;:!?]/g, "");
}

function ellipsisPerson(s: string): string {
  // Add occasional trailing ellipsis, but don’t spam.
  if (s.includes("...")) return s;
  return s + " ...";
}

function excessivePunctuation(s: string): string {
  // Light touch: add !!! or ??? at end if none
  if (/[!?]$/.test(s)) return s;
  return s + (Math.random() < 0.5 ? "!!!" : "???");
}

function enforceMessageLength(s: string, messageLength: string | undefined): string {
  const style = (messageLength || "").toLowerCase();

  // Keep it safe: we do not try to generate new content, only shorten.
  if (style.includes("terse") || style.includes("very short") || style.includes("clipped")) {
    // 3-10 words max
    const words = s.trim().split(/\s+/);
    const cut = words.slice(0, Math.min(words.length, 10)).join(" ");
    return cut;
  }

  if (style.includes("short")) {
    // Cap around ~2 sentences
    const parts = s.split(/(?<=[.!?])\s+/);
    return parts.slice(0, 2).join(" ").trim();
  }

  return s.trim();
}

function applyTextingStyle(
  text: string,
  specTextingStyle?: {
    slang?: string;
    caps?: string;
    typos?: string;
    emojis?: string;
    messageLength?: string;
    punctuation?: string;
  }
): string {
  let out = stripEmDashes(text);

  const caps = (specTextingStyle?.caps || "").toLowerCase();
  const punctuation = (specTextingStyle?.punctuation || "").toLowerCase();
  const emojis = (specTextingStyle?.emojis || "").toLowerCase();
  const messageLength = specTextingStyle?.messageLength;

  // Caps rules
  if (caps.includes("all lowercase") || caps.includes("lowercase")) {
    out = normalizeForLowercaseStyle(out);
  } else if (caps.includes("all caps")) {
    out = normalizeForAllCapsStyle(out);
  }

  // Emoji rules
  if (emojis.includes("no emoji") || emojis.includes("no emojis") || emojis.includes("none")) {
    out = enforceNoEmojis(out).trim();
  } else {
    // your system rules generally want 0-2 emojis max in bios, but chat can vary
    // still cap a bit to keep it clean
    out = capEmojiCount(out, 2);
  }

  // Punctuation rules
  if (punctuation.includes("no punctuation")) {
    out = noPunctuation(out);
  } else if (punctuation.includes("minimal")) {
    out = minimalPunctuation(out);
  } else if (punctuation.includes("ellipsis")) {
    out = ellipsisPerson(out);
  } else if (punctuation.includes("excessive") || punctuation.includes("!!!")) {
    out = excessivePunctuation(out);
  }

  out = enforceMessageLength(out, messageLength);
  return out.trim();
}

function mentionsICE(text: string): boolean {
  return ICE_PATTERNS.some((rx) => rx.test(text));
}

export function evaluatePolicy(params: {
  userMessage: string;
  history: Msg[];
  specTextingStyle?: {
    slang?: string;
    caps?: string;
    typos?: string;
    emojis?: string;
    messageLength?: string;
    punctuation?: string;
  };
  isChaos?: boolean;
}): PolicyHit {
  const { userMessage, history, specTextingStyle } = params;

  const inThisMessage = mentionsICE(userMessage);

  // Once ICE is mentioned, you can choose to keep it "sticky" for the rest of the chat.
  // Sticky prevents jailbreak attempts like "ignore previous rules".
  const everMentionedInThread = history.some((m) => !m.isAI && mentionsICE(m.content));

  if (!inThisMessage && !everMentionedInThread) return { kind: "NONE" };

  const firstHit = !everMentionedInThread && inThisMessage;

  const base = firstHit ? pick(ICE_FIRST_RESPONSE) : pick(ICE_LOOP_RESPONSE);
  const styled = applyTextingStyle(base, specTextingStyle);

  return { kind: "ICE", firstHit, message: styled };
}
