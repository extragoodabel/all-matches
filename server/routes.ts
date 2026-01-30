import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema, type Match } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { buildImageUrl } from "./portrait-library";
import { getUsageStats, COST_CONFIG } from "./cost-config";

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Age distribution config - weights control relative probability of each age bracket
// Higher weight = more likely to appear. Tune these to adjust the distribution.
const AGE_DISTRIBUTION = [
  { min: 21, max: 24, weight: 30 },  // Gen Z young adults - very common
  { min: 25, max: 29, weight: 28 },  // Late 20s - very common
  { min: 30, max: 34, weight: 18 },  // Early 30s - common
  { min: 35, max: 39, weight: 10 },  // Late 30s - less common
  { min: 40, max: 49, weight: 7 },   // 40s - uncommon
  { min: 50, max: 64, weight: 4 },   // 50s-early 60s - rare
  { min: 65, max: 79, weight: 2 },   // Senior - very rare
  { min: 80, max: 89, weight: 0.8 }, // 80s - extremely rare
  { min: 90, max: 99, weight: 0.2 }, // 90+ - ultra rare (comedic)
];

// Generate age using weighted distribution, respecting user's min/max preferences
function generateAge(userMinAge: number = 21, userMaxAge: number = 99): number {
  // Filter brackets that overlap with user's age range
  const validBrackets = AGE_DISTRIBUTION
    .map(bracket => ({
      min: Math.max(bracket.min, userMinAge),
      max: Math.min(bracket.max, userMaxAge),
      weight: bracket.weight,
    }))
    .filter(b => b.min <= b.max); // Only keep brackets with valid range

  if (validBrackets.length === 0) {
    // Fallback: return middle of user's range
    return Math.floor((userMinAge + userMaxAge) / 2);
  }

  // Calculate total weight
  const totalWeight = validBrackets.reduce((sum, b) => sum + b.weight, 0);
  
  // Pick a random value in the weight space
  let random = Math.random() * totalWeight;
  
  // Find which bracket the random value falls into
  for (const bracket of validBrackets) {
    random -= bracket.weight;
    if (random <= 0) {
      // Generate uniform random age within this bracket
      return bracket.min + Math.floor(Math.random() * (bracket.max - bracket.min + 1));
    }
  }
  
  // Fallback (shouldn't reach here)
  const lastBracket = validBrackets[validBrackets.length - 1];
  return lastBracket.min + Math.floor(Math.random() * (lastBracket.max - lastBracket.min + 1));
}

// Debug helper: Print histogram of age distribution (dev only)
function debugAgeDistribution(samples: number = 1000): void {
  const histogram: Record<string, number> = {
    "21-24": 0, "25-29": 0, "30-34": 0, "35-39": 0,
    "40-49": 0, "50-64": 0, "65-79": 0, "80-89": 0, "90-99": 0,
  };
  
  for (let i = 0; i < samples; i++) {
    const age = generateAge();
    if (age <= 24) histogram["21-24"]++;
    else if (age <= 29) histogram["25-29"]++;
    else if (age <= 34) histogram["30-34"]++;
    else if (age <= 39) histogram["35-39"]++;
    else if (age <= 49) histogram["40-49"]++;
    else if (age <= 64) histogram["50-64"]++;
    else if (age <= 79) histogram["65-79"]++;
    else if (age <= 89) histogram["80-89"]++;
    else histogram["90-99"]++;
  }
  
  console.log(`[Age Distribution] Sample of ${samples} ages:`);
  for (const [bracket, count] of Object.entries(histogram)) {
    const pct = ((count / samples) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(count / samples * 50));
    console.log(`  ${bracket}: ${pct}% ${bar} (${count})`);
  }
}

// Run debug on startup (remove in production)
debugAgeDistribution(1000);

function hashBio(bio: string): string {
  let hash = 0;
  for (let i = 0; i < bio.length; i++) {
    const char = bio.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function generateUniqueName(firstNames: string[], lastInitials: string[]): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const first = pick(firstNames);
    const initial = pick(lastInitials);
    const candidate = Math.random() < 0.55 ? first : `${first} ${initial}.`;
    if (!storage.usedNames.has(candidate.toLowerCase())) {
      storage.usedNames.add(candidate.toLowerCase());
      return candidate;
    }
  }
  const fallback = `${pick(firstNames)} ${pick(lastInitials)}.${Math.floor(Math.random() * 99) + 1}`;
  storage.usedNames.add(fallback.toLowerCase());
  return fallback;
}

const BIO_MODES = [
  { mode: "one_liner", weight: 15, desc: "Single punchy sentence, confident or mysterious" },
  { mode: "hot_takes", weight: 12, desc: "2-3 spicy opinions/hot takes" },
  { mode: "list_of_things", weight: 10, desc: "Bullet-ish list of 3-4 facts" },
  { mode: "prompt_answers", weight: 10, desc: "Dating app prompt answers" },
  { mode: "low_effort", weight: 8, desc: "3-7 words max, lazy or cryptic" },
  { mode: "self_aware", weight: 10, desc: "Meta/self-deprecating about dating apps" },
  { mode: "sincere", weight: 12, desc: "Genuine, warm, looking for connection" },
  { mode: "weird_flex", weight: 8, desc: "Odd accomplishment / humble brag" },
  { mode: "question", weight: 8, desc: "Ends with a question to spark convo" },
  { mode: "anti_bio", weight: 5, desc: "Defiant anti-bio" },
  { mode: "specific_scenario", weight: 7, desc: "A vivid specific scenario" },
  { mode: "red_flags_joke", weight: 5, desc: "Jokes about their own red flags" }
];

function pickWeightedMode(): { mode: string; desc: string } {
  const total = BIO_MODES.reduce((sum, m) => sum + m.weight, 0);
  let r = Math.random() * total;
  for (const m of BIO_MODES) {
    r -= m.weight;
    if (r <= 0) return { mode: m.mode, desc: m.desc };
  }
  return { mode: BIO_MODES[0].mode, desc: BIO_MODES[0].desc };
}

async function generateBioWithOpenAI(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const modeInfo = pickWeightedMode();

  const prompt = `Write a dating app bio for a FICTIONAL person (adult 21+, not a real person, not a celebrity).
Character:
- Name: ${context.name}
- Age: ${context.age} (must read 21+)
- Gender: ${context.gender}
- Vibe: ${context.archetypeLabel}
- Interests: ${context.interests.join(", ")}
- Quirk: ${context.quirk}

Bio style: ${modeInfo.mode.replace(/_/g, " ")} - ${modeInfo.desc}

RULES:
- 1-5 lines max
- Do NOT start with "I'm a..." or "Usually found..." or "Secret talent:"
- Do NOT use labels like "Interests:" or "About me:"
- 0-3 emojis max
- Include 2-4 specific details but weave them naturally
- Output ONLY the bio text, no quotes, no explanation`;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.9,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("OpenAI bio generation failed:", error);
    return null;
  }
}

function generateFallbackBio(interests: string[], quirk: string): string {
  const templates = [
    `${pick(interests)} lately. ${quirk}`,
    `If you can hang with ${pick(interests)}, we'll get along. ${quirk}`,
    `${quirk} Also: ${pick(interests)}.`,
    `Currently obsessed with ${pick(interests)}.`,
    `${pick(interests)} + ${pick(interests)} + coffee`,
  ];
  return pick(templates);
}

async function generateUniqueBio(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
}): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bio = await generateBioWithOpenAI(context);
    if (bio) {
      const h = hashBio(bio);
      if (!storage.usedBioHashes.has(h)) {
        storage.usedBioHashes.add(h);
        return bio;
      }
    }
  }
  const fallback = generateFallbackBio(context.interests, context.quirk);
  storage.usedBioHashes.add(hashBio(fallback));
  return fallback;
}


function generateCharacterSpec(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
}): string {
  const seed = crypto.createHash('md5').update(context.name + context.archetypeLabel + context.quirk).digest('hex');
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend", "vibes only"];
  const intelligenceVibes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical", "creative", "chill"];
  const moralityFlavors = ["kind", "neutral", "messy", "blunt", "slightly toxic", "overly honest", "wholesome", "chaotic good"];
  const stylePool = [
    { emojis: "frequent", punctuation: "loose", slang: "high", caps: "minimal", length: "short" },
    { emojis: "rare", punctuation: "perfect", slang: "low", caps: "proper", length: "moderate" },
    { emojis: "moderate", punctuation: "none", slang: "moderate", caps: "lowercase", length: "punchy" },
    { emojis: "frequent", punctuation: "excessive!!!", slang: "internet speak", caps: "all caps for emphasis", length: "varied" },
    { emojis: "occasional", punctuation: "minimal", slang: "gen-z", caps: "no caps ever", length: "short bursts" },
    { emojis: "none", punctuation: "proper", slang: "none", caps: "normal", length: "thoughtful" }
  ];
  const bits = [
    "teasing the user relentlessly", "asking weird 'would you rather' questions",
    "using overly dramatic metaphors", "sending one-word replies then a long follow-up",
    "constantly referencing a 'secret project'", "predicting the user's future",
    "correcting the user's grammar (as a joke)", "sending 'voice note' descriptions",
    "making everything into a competition", "dropping random facts",
    "being suspiciously specific about niche topics", "using a signature catchphrase",
    "referencing obscure movies nobody knows", "sending chaotic energy",
    "replying in questions", "being mysteriously vague"
  ];

  const goal = goals[n(0) % goals.length];
  const intelligence = intelligenceVibes[n(2) % intelligenceVibes.length];
  const morality = moralityFlavors[n(4) % moralityFlavors.length];
  const style = stylePool[n(6) % stylePool.length];
  const signatureBits = [bits[n(8) % bits.length], bits[n(10) % bits.length]];

  const spec = {
    name: context.name,
    age: context.age,
    gender: context.gender,
    archetype: context.archetypeLabel,
    goal,
    intelligence,
    morality,
    interests: context.interests,
    quirk: context.quirk,
    textingStyle: style,
    signatureBits,
    boundaries: "No explicit content. Stay in character. Be engaging but not creepy."
  };

  return JSON.stringify(spec);
}

// ============ COST-SAFE MODE ============
// In cost-safe mode, NO background generation happens.
// Profiles are served from existing storage only.
// See server/cost-config.ts for configuration.

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/profiles - Returns profiles from storage only (NO AI generation)
  app.get("/api/profiles", async (req, res) => {
    const requestStart = Date.now();
    const userId = 1;
    
    // Parse and validate filter params
    const rawGender = (req.query.gender as string) || "all";
    const genderPref = ["male", "female", "other", "all"].includes(rawGender) ? rawGender : "all";
    const rawMinAge = parseInt(req.query.minAge as string) || 21;
    const rawMaxAge = parseInt(req.query.maxAge as string) || 99;
    const minAge = Math.max(21, Math.min(99, rawMinAge));
    const maxAge = Math.max(21, Math.min(99, rawMaxAge));
    
    console.log(`[Profiles] Request - gender=${genderPref}, age=${minAge}-${maxAge}`);

    // Fetch unseen profiles from storage (fast - no AI calls)
    let unseen = await storage.getUnseenProfiles(userId);

    // Apply filters
    if (genderPref !== "all") {
      unseen = unseen.filter(p => p.gender === genderPref);
    }
    unseen = unseen.filter(p => p.age >= minAge && p.age <= maxAge);

    // COST-SAFE: If no profiles match, return ALL profiles shuffled (no generation)
    if (unseen.length === 0) {
      console.log(`[Profiles] No unseen profiles, returning all profiles shuffled`);
      const allProfiles = await storage.getProfiles();
      let filtered = allProfiles;
      if (genderPref !== "all") {
        filtered = filtered.filter(p => p.gender === genderPref);
      }
      filtered = filtered.filter(p => p.age >= minAge && p.age <= maxAge);
      
      const elapsed = Date.now() - requestStart;
      console.log(`[Profiles] Completed in ${elapsed}ms, returning ${filtered.length} profiles (recycled)`);
      return res.json(shuffle(filtered));
    }

    const elapsed = Date.now() - requestStart;
    console.log(`[Profiles] Completed in ${elapsed}ms, returning ${unseen.length} profiles`);
    
    res.json(shuffle(unseen));
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });

      const profile = await storage.getProfile(id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      res.json(profile);
    } catch {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/matches", async (req, res) => {
    try {
      console.log(`[POST /api/matches] Incoming body:`, req.body);
      const match = insertMatchSchema.parse(req.body);
      const createdMatch = await storage.createMatch(match);
      console.log(`[POST /api/matches] Created match.id=${createdMatch.id}, userId=${createdMatch.userId}, profileId=${createdMatch.profileId}`);
      res.json(createdMatch);
    } catch (error) {
      console.error("[POST /api/matches] Error:", error);
      res.status(400).json({ error: "Invalid match data" });
    }
  });

  app.get("/api/matches/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const matches = await storage.getMatches(userId);
      console.log(`[GET /api/matches/${userId}] Returning ${matches.length} matches: [${matches.map(m => `{id:${m.id},profileId:${m.profileId}}`).join(', ')}]`);
      res.json(matches);
    } catch (error) {
      console.error("[GET /api/matches] Error:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  // Combined endpoint for inbox: matches with profile data + last message
  app.get("/api/inbox/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const matches = await storage.getMatches(userId);
      
      const inboxItems = await Promise.all(
        matches.map(async (match) => {
          const profile = await storage.getProfile(match.profileId);
          const messages = await storage.getMessages(match.id);
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          
          return {
            matchId: match.id,
            profileId: match.profileId,
            createdAt: match.createdAt,
            profile: profile ? {
              name: profile.name,
              age: profile.age,
              imageUrl: profile.imageUrl,
            } : null,
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              isAI: lastMessage.isAI,
              createdAt: lastMessage.createdAt,
            } : null,
          };
        })
      );

      // Sort by last message time (descending), then by match creation time
      inboxItems.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      res.json(inboxItems);
    } catch (error) {
      console.error("Inbox error:", error);
      res.status(500).json({ error: "Failed to fetch inbox" });
    }
  });

  // Shared resolver: resolves an incoming ID to a real match record
  // First tries incomingId as matchId, then falls back to treating it as profileId
  async function resolveMatchId(incomingId: number, userId: number = 1): Promise<{ match: Match; matchId: number } | null> {
    const matches = await storage.getMatches(userId);
    
    // First try: treat incomingId as matchId
    let match = matches.find(m => m.id === incomingId);
    if (match) {
      console.log(`[Resolver] ID ${incomingId} resolved as matchId -> match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }
    
    // Fallback: treat incomingId as profileId
    match = matches.find(m => m.profileId === incomingId);
    if (match) {
      console.log(`[Resolver] ID ${incomingId} resolved as profileId -> match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }
    
    console.log(`[Resolver] ID ${incomingId} could not be resolved to any match`);
    return null;
  }

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const incoming = parseInt(req.params.id);
      if (isNaN(incoming)) return res.status(400).json({ error: "Invalid id" });

      console.log(`[GET /api/messages/${incoming}] Resolving ID...`);
      
      const resolved = await resolveMatchId(incoming);
      
      if (!resolved) {
        console.log(`[GET /api/messages/${incoming}] No match found, returning empty array`);
        return res.json([]);
      }
      
      const messages = await storage.getMessages(resolved.matchId);
      console.log(`[GET /api/messages/${incoming}] Found ${messages.length} messages for matchId=${resolved.matchId}`);
      
      res.json(messages);
    } catch (error) {
      console.error("[GET /api/messages] Error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      
      console.log(`[POST /api/messages] Incoming matchId: ${message.matchId}, content: "${message.content.substring(0, 30)}..."`);
      
      const resolved = await resolveMatchId(message.matchId);
      
      if (!resolved) {
        console.log(`[POST /api/messages] Match not found for id=${message.matchId}`);
        return res.status(404).json({ error: "Match not found" });
      }
      
      console.log(`[POST /api/messages] Resolved to matchId=${resolved.matchId}`);
      
      const createdMessage = await storage.createMessage({
        ...message,
        matchId: resolved.matchId
      });

      if (!message.isAI) {
        const match = resolved.match;

        const profile = await storage.getProfile(match.profileId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const currentMessages = await storage.getMessages(resolved.matchId);

        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
            characterSpec: profile.characterSpec,
            isChaos: profile.isChaos,
            messageHistory: currentMessages.map((m) => ({
              content: m.content,
              isAI: m.isAI,
            })),
          },
          message.content
        )
          .then(async (aiResponse) => {
            try {
              await new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
              await new Promise((r) => setTimeout(r, aiResponse.typingDelay));

              await storage.createMessage({
                matchId: resolved.matchId,
                content: aiResponse.content,
                isAI: true,
              });
            } catch (error) {
              console.error("Error creating AI response:", error);
            }
          })
          .catch((error) => {
            console.error("Error generating AI response:", error);
          });
      }

      res.json(createdMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid message data" });
      } else {
        console.error("Message error:", error);
        res.status(500).json({ error: "Failed to create message" });
      }
    }
  });

  // ============ USAGE STATS ENDPOINT ============
  app.get("/api/usage-stats", async (_req, res) => {
    const stats = getUsageStats();
    res.json({
      config: {
        costSafeMode: COST_CONFIG.COST_SAFE_MODE,
        enableChatAI: COST_CONFIG.ENABLE_CHAT_AI,
        enableImageAI: COST_CONFIG.ENABLE_IMAGE_AI,
        maxChatCallsPerHour: COST_CONFIG.MAX_CHAT_CALLS_PER_HOUR,
      },
      usage: stats,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
