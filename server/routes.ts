// server/routes.ts
import { Router } from "express";
import { PERSONAS } from "./personas";
import { generateAIResponse } from "./ai";

type Profile = {
  id: string;
  name: string;
  age: number;
  gender?: "male" | "female" | "other";
  bio?: string;
  photos?: string[];
  personaId?: string; // if present, profile is pinned to a persona
};

type Match = {
  id: string;
  profileId: string;
  personaId: string; // pinned per match
  lastMessageAt: number;
};

type Message = {
  id: string;
  matchId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const router = Router();

const profiles = new Map<string, Profile>();
const matches = new Map<string, Match>();
const messagesByMatch = new Map<string, Message[]>();

function now() {
  return Date.now();
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

function getPersonaOrFallback(personaId: string) {
  return PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
}

function pickRandomPersonaId() {
  if (!PERSONAS.length) return "illustrator-small-town";
  return PERSONAS[Math.floor(Math.random() * PERSONAS.length)].id;
}

/**
 * Seed minimal data so app always loads.
 * You can keep this even if you have other generators.
 */
(function seed() {
  if (profiles.size > 0) return;

  const p1: Profile = {
    id: "p_1",
    name: "Mara",
    age: 29,
    gender: "female",
    bio: "Small-town illustrator. Dry humor.",
    photos: [],
    personaId: "illustrator-small-town",
  };

  const p2: Profile = {
    id: "p_2",
    name: "Casey J.",
    age: 27,
    gender: "male",
    bio: "Brooklyn. Beach. Loud.",
    photos: [],
    personaId: "brooklyn-beach-chaos",
  };

  const p3: Profile = {
    id: "p_3",
    name: "Rowan",
    age: 31,
    gender: "other",
    bio: "Curious. A little unsettling.",
    photos: [],
    personaId: "unhinged-chaos-third",
  };

  profiles.set(p1.id, p1);
  profiles.set(p2.id, p2);
  profiles.set(p3.id, p3);
})();

/**
 * Health
 */
router.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/**
 * GET /profiles
 * Query: ?gender=all|male|female|other&minAge=21&maxAge=99
 * Never dead-ends: if empty, reuses whatever exists.
 */
router.get("/profiles", (req, res) => {
  const gender = String(req.query.gender ?? "all");
  const minAge = Number(req.query.minAge ?? 18);
  const maxAge = Number(req.query.maxAge ?? 120);

  const list = Array.from(profiles.values()).filter((p) => {
    const ageOk = p.age >= minAge && p.age <= maxAge;
    const genderOk = gender === "all" ? true : p.gender === gender;
    return ageOk && genderOk;
  });

  // If filters return empty, return all profiles so swipe never stalls.
  res.json(list.length ? list : Array.from(profiles.values()));
});

/**
 * GET /profiles/:profileId
 */
router.get("/profiles/:profileId", (req, res) => {
  const { profileId } = req.params;
  const p = profiles.get(profileId);
  if (!p) return res.status(404).json({ error: "Profile not found" });
  res.json(p);
});

/**
 * POST /matches
 * Body: { profileId: string }
 * Pins personaId for the match so voice stays stable forever.
 */
router.post("/matches", (req, res) => {
  const { profileId } = req.body ?? {};
  if (typeof profileId !== "string") {
    return res.status(400).json({ error: "Invalid payload. Expected { profileId }" });
  }

  const profile = profiles.get(profileId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const matchId = uid("m");
  const personaId = profile.personaId ?? pickRandomPersonaId();

  const match: Match = {
    id: matchId,
    profileId,
    personaId,
    lastMessageAt: now(),
  };

  matches.set(matchId, match);
  messagesByMatch.set(matchId, []);

  res.json(match);
});

/**
 * GET /matches
 */
router.get("/matches", (_req, res) => {
  const list = Array.from(matches.values())
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    .map((m) => ({ id: m.id, profileId: m.profileId }));

  res.json(list);
});

/**
 * GET /matches/by-id/:matchId
 * Your client calls: /api/matches/by-id/${matchId}
 */
router.get("/matches/by-id/:matchId", (req, res) => {
  const { matchId } = req.params;
  const m = matches.get(matchId);
  if (!m) return res.status(404).json({ error: "Match not found" });

  const profile = profiles.get(m.profileId) ?? null;

  res.json({
    id: m.id,
    profileId: m.profileId,
    profile,
  });
});

/**
 * GET /messages/:matchId
 */
router.get("/messages/:matchId", (req, res) => {
  const { matchId } = req.params;
  if (!matches.has(matchId)) return res.status(404).json({ error: "Match not found" });
  res.json(messagesByMatch.get(matchId) ?? []);
});

/**
 * POST /messages
 * Body: { matchId: string, content: string }
 * Returns: { userMessage, assistantMessage }
 */
router.post("/messages", async (req, res) => {
  try {
    const { matchId, content } = req.body ?? {};
    if (typeof matchId !== "string" || typeof content !== "string") {
      return res.status(400).json({ error: "Invalid payload. Expected { matchId, content }" });
    }

    const m = matches.get(matchId);
    if (!m) return res.status(404).json({ error: "Match not found" });

    const trimmed = content.trim();
    if (!trimmed) return res.status(400).json({ error: "Empty message" });

    const history = messagesByMatch.get(matchId) ?? [];

    const userMsg: Message = {
      id: uid("msg"),
      matchId,
      role: "user",
      content: trimmed,
      createdAt: now(),
    };
    history.push(userMsg);

    m.lastMessageAt = now();
    matches.set(matchId, m);
    messagesByMatch.set(matchId, history);

    const profile = profiles.get(m.profileId) ?? null;
    const persona = getPersonaOrFallback(m.personaId);

    const assistantText = await generateAIResponse({
      persona,
      profile,
      conversation: history.map((x) => ({ role: x.role, content: x.content })),
    });

    const assistantMsg: Message = {
      id: uid("msg"),
      matchId,
      role: "assistant",
      content: assistantText,
      createdAt: now(),
    };
    history.push(assistantMsg);

    m.lastMessageAt = now();
    matches.set(matchId, m);
    messagesByMatch.set(matchId, history);

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err: any) {
    console.error("POST /messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
