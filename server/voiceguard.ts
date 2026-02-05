// server/voiceGuard.ts

import type { PersonaVoice } from "./personas";

function countEmojis(text: string): number {
  // Broad emoji detection
  const emojiRegex =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function containsBanned(text: string, banned: string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const b of banned) {
    const needle = b.toLowerCase();
    if (needle === "💀") {
      if (text.includes("💀")) hits.push(b);
      continue;
    }
    // word-ish match
    if (lower.includes(needle)) hits.push(b);
  }
  return hits;
}

function isGenericSamey(text: string): boolean {
  const lower = text.toLowerCase();
  const commonSlop = [
    "what's your deal",
    "what made you swipe",
    "haha",
    "lol",
    "i'm just",
    "chaotic",
    "vib",
    "bestie",
  ];
  const hits = commonSlop.filter((p) => lower.includes(p));
  // If it hits multiple sludge patterns, treat as generic.
  return hits.length >= 2;
}

export type GuardResult =
  | { ok: true }
  | {
      ok: false;
      reasons: string[];
    };

export function validatePersonaOutput(text: string, persona: PersonaVoice): GuardResult {
  const reasons: string[] = [];

  const bannedHits = containsBanned(text, persona.banned ?? []);
  if (bannedHits.length) {
    reasons.push(`Contains banned terms: ${bannedHits.join(", ")}`);
  }

  const emojiCount = countEmojis(text);
  const [minE, maxE] = persona.emojiRange ?? [0, 0];
  if (emojiCount < minE || emojiCount > maxE) {
    reasons.push(`Emoji count ${emojiCount} outside allowed range ${minE}-${maxE}`);
  }

  if (isGenericSamey(text)) {
    reasons.push("Output reads generic/same-y");
  }

  // Quick “no slang” heuristic if they demand it:
  const rules = (persona.voiceRules ?? []).join(" ").toLowerCase();
  if (rules.includes("no slang")) {
    const slang = ["lowkey", "fr", "ngl", "slay", "bestie", "vibe", "vibing", "era"];
    const slangHits = slang.filter((w) => text.toLowerCase().includes(w));
    if (slangHits.length) {
      reasons.push(`Slang detected despite rule: ${slangHits.join(", ")}`);
    }
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}
