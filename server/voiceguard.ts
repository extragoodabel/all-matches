// server/voiceGuard.ts
import type { PersonaVoice } from "./personas";

function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function containsBanned(text: string, banned: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const b of banned) {
    const needle = (b || "").toLowerCase();
    if (!needle) continue;
    if (b === "💀") {
      if (text.includes("💀")) hits.push(b);
      continue;
    }
    if (lower.includes(needle)) hits.push(b);
  }
  return hits;
}

function hitsGenericDatingSlop(text: string): string[] {
  const lower = text.toLowerCase();

  // This list is intentionally aggressive. It is not about banning words.
  // It is about catching the "same dating app voice" texture.
  const sludge = [
    "what made you swipe",
    "what's your deal",
    "haha",
    "lol",
    "lmao",
    "i'm just",
    "just vib",
    "vibing",
    "chaotic",
    "lowkey",
    "ngl",
    "fr",
    "bestie",
    "era",
    "slay",
    "navigate life",
    "steal your heart",
    "quirky",
    "chaotic good",
    "so random",
    "tell me about yourself",
  ];

  return sludge.filter((p) => lower.includes(p));
}

function tooManyExclamations(text: string) {
  const matches = text.match(/!/g) ?? [];
  return matches.length >= 4;
}

export type GuardResult =
  | { ok: true }
  | {
      ok: false;
      reasons: string[];
    };

export function validatePersonaOutput(text: string, persona: PersonaVoice): GuardResult {
  const reasons: string[] = [];

  // Persona bans (optional, user can keep short)
  const bannedHits = containsBanned(text, persona.banned ?? []);
  if (bannedHits.length) reasons.push(`Contains banned terms: ${bannedHits.join(", ")}`);

  // Emoji range enforcement
  const emojiCount = countEmojis(text);
  const [minE, maxE] = persona.emojiRange ?? [0, 0];
  if (emojiCount < minE || emojiCount > maxE) {
    reasons.push(`Emoji count ${emojiCount} outside allowed range ${minE}-${maxE}`);
  }

  // Generic dating voice detector
  const sludgeHits = hitsGenericDatingSlop(text);
  if (sludgeHits.length >= 2) {
    reasons.push(`Reads generic/samey: hits ${sludgeHits.join(" | ")}`);
  }

  // Prevent the all-caps emoji scream persona bleed
  if (tooManyExclamations(text) && (persona.voiceRules ?? []).join(" ").toLowerCase().includes("quiet")) {
    reasons.push("Too many exclamation points for a quiet persona");
  }

  // No em dashes, per your global preference
  if (text.includes("—")) reasons.push("Contains em dash");

  // Must be non-empty and not a single bland question
  const trimmed = text.trim();
  if (trimmed.length < 10) reasons.push("Too short to be a real reply");

  return reasons.length ? { ok: false, reasons } : { ok: true };
}
