import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema, type Match } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { buildImageUrl, MEN_PORTRAIT_IDS, WOMEN_PORTRAIT_IDS, ANDROGYNOUS_PORTRAIT_IDS } from "./portrait-library";

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

// ============ PROFILE GENERATION CONFIG ============
const PROFILE_BUFFER_TARGET = 60;        // Target number of unseen profiles to maintain
const PROFILE_GEN_BATCH_SIZE = 30;       // How many profiles to generate per background batch
const PROFILE_LOW_THRESHOLD = 35;        // Trigger background generation when below this
const IMAGE_VALIDATION_TIMEOUT = 1500;   // Image validation timeout (ms)

// Track if background generation is already running to prevent duplicate runs
let isGeneratingProfiles = false;

// Background profile generation (fire-and-forget, doesn't block requests)
async function generateProfilesInBackground(
  genderPref: string, 
  minAge: number, 
  maxAge: number,
  count: number
): Promise<void> {
  if (isGeneratingProfiles) {
    console.log(`[BG Gen] Already generating, skipping`);
    return;
  }
  
  isGeneratingProfiles = true;
  const startTime = Date.now();
  console.log(`[BG Gen] Starting background generation of ${count} profiles for gender=${genderPref}`);
  
  try {
    const archetypes = [
      { label: "Chaotic Art Kid", interests: ["analog photography", "DIY synthesizers", "street art"] },
      { label: "Aspiring DJ", interests: ["vinyl collecting", "techno", "club hopping"] },
      { label: "Burned Out Grad Student", interests: ["research rabbit holes", "sourdough experiments", "late-night debates"] },
      { label: "Sweet Golden Retriever Energy", interests: ["dog parks", "cozy movie nights", "sunny brunch"] },
      { label: "Cynical but Funny", interests: ["dark comedy", "people watching", "urban exploration"] },
      { label: "Mysterious", interests: ["occult history", "stargazing", "poetry"] },
      { label: "Hyper-Competent Techie", interests: ["open source", "cybersecurity", "mechanical keyboards"] },
      { label: "Spiritual Nomad", interests: ["reiki", "crystals", "van life"] },
      { label: "High-Energy Athlete", interests: ["crossfit", "meal prep", "mountain trails"] },
      { label: "Old Soul Librarian", interests: ["classic literature", "tea blending", "quiet museums"] },
      { label: "Socialite with an Edge", interests: ["fashion design", "cocktail mixing", "modern art"] },
      { label: "Corporate Rebel", interests: ["investing", "skydiving", "poker"] },
      { label: "Indie Musician", interests: ["songwriting", "thrift shopping", "coffee"] },
      { label: "Gamer", interests: ["speedrunning", "co-op games", "streaming"] },
      { label: "Plant Parent", interests: ["botany", "interior design", "organic gardening"] },
      { label: "Street Photographer", interests: ["architecture", "film processing", "night walks"] },
      { label: "Foodie", interests: ["hole-in-the-wall spots", "tasting menus", "food photography"] },
    ];

    const maleFirstNames = [
      "Alex", "Jordan", "Taylor", "Casey", "Riley", "Quinn", "Skyler", "Peyton",
      "Dakota", "Reese", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
      "Jamie", "Sam", "Cameron", "Drew", "Kai", "Logan", "Noah", "Remy",
      "Evan", "Owen", "Miles", "Eli", "Theo", "Max", "Jonah", "Isaac", "Leo", "Caleb",
      "Marcus", "Derek", "Jason", "Tyler", "Ryan", "Kevin", "Brandon", "Justin"
    ];
    
    const femaleFirstNames = [
      "Morgan", "Avery", "Hayden", "Emerson", "Sasha",
      "Leah", "Maya", "Nina", "Zoe", "Iris", "Lena", "Aria", "Jules", "Tessa", "Mina",
      "Sophie", "Emma", "Olivia", "Ava", "Isabella", "Mia", "Charlotte", "Amelia",
      "Harper", "Evelyn", "Luna", "Camila", "Gianna", "Penelope", "Riley", "Layla"
    ];
    
    const otherFirstNames = [
      "Alex", "Jordan", "Taylor", "Casey", "Riley", "Quinn", "Skyler", "Peyton",
      "Dakota", "Reese", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
      "Jamie", "Sam", "Cameron", "Drew", "Kai", "Morgan", "Avery", "Hayden",
      "Emerson", "Sasha", "Jules", "Remy", "Phoenix", "River", "Sage", "Eden"
    ];
    
    const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const quirks = [
      "I make playlists for every mood.",
      "I name all my houseplants.",
      "I have opinions about font kerning.",
      "I've memorized way too many movie quotes.",
      "I'm weirdly good at naming pets.",
      "I'm a semi-pro at GeoGuessr.",
      "I still have a flip phone for the aesthetic.",
      "I only drink coffee from blue mugs. No exceptions.",
      "I can't eat pizza without ranch.",
      "I sleep with a fan on, even in winter.",
      "I've never seen Star Wars. Don't hurt me.",
      "I collect vintage spoons like it's an Olympic sport.",
    ];

    // Generate profiles in parallel batches of 5 for speed
    const batchSize = 5;
    for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push((async () => {
          const arch = pick(archetypes);
          const age = generateAge(minAge, maxAge);
          
          let gender: string;
          if (genderPref === "male") {
            gender = "male";
          } else if (genderPref === "female") {
            gender = "female";
          } else if (genderPref === "other") {
            gender = "other";
          } else {
            const rand = Math.random();
            if (rand < 0.4) gender = "male";
            else if (rand < 0.8) gender = "female";
            else gender = "other";
          }
          
          const quirk = pick(quirks);
          const firstNames = gender === "male" ? maleFirstNames : 
                            gender === "female" ? femaleFirstNames : otherFirstNames;
          const name = generateUniqueName(firstNames, lastInitials);

          const bio = await generateUniqueBio({
            name,
            age,
            gender,
            archetypeLabel: arch.label,
            interests: arch.interests,
            quirk,
          });

          const charSpec = generateCharacterSpec({
            name,
            age,
            gender,
            archetypeLabel: arch.label,
            interests: arch.interests,
            quirk,
          });

          const nextProfileId = storage['currentId'].profiles + i;
          const imageId = storage.getUniqueImageId(gender as 'male' | 'female' | 'other');
          const imageUrl = buildImageUrl(imageId, nextProfileId);

          const profile = await storage.createProfile({
            name,
            age,
            bio,
            gender,
            imageUrl,
            isAI: true,
            characterSpec: charSpec,
          });
          
          console.log(`[BG Gen] Created profile ${i + 1}/${count}: ${name} (${gender}, ${age})`);
          return profile;
        })());
      }
      
      await Promise.all(batchPromises);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[BG Gen] Completed ${count} profiles in ${elapsed}ms`);
  } catch (error) {
    console.error(`[BG Gen] Error:`, error);
  } finally {
    isGeneratingProfiles = false;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
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
    
    console.log(`[Profiles] Request start - gender=${genderPref}, age=${minAge}-${maxAge}`);

    // Fetch unseen profiles (fast - just reads from memory)
    const fetchStart = Date.now();
    let unseen = await storage.getUnseenProfiles(userId);
    console.log(`[Profiles] getUnseenProfiles took ${Date.now() - fetchStart}ms, found ${unseen.length}`);

    // Apply filters
    if (genderPref !== "all") {
      unseen = unseen.filter(p => p.gender === genderPref);
    }
    unseen = unseen.filter(p => p.age >= minAge && p.age <= maxAge);
    console.log(`[Profiles] After filtering: ${unseen.length} profiles`);

    // If running low, trigger background generation (fire-and-forget)
    if (unseen.length < PROFILE_LOW_THRESHOLD) {
      const needed = PROFILE_BUFFER_TARGET - unseen.length;
      console.log(`[Profiles] Low buffer (${unseen.length}), triggering background generation of ${needed}`);
      // Fire and forget - don't await
      generateProfilesInBackground(genderPref, minAge, maxAge, Math.min(needed, PROFILE_GEN_BATCH_SIZE))
        .catch(err => console.error('[BG Gen] Unhandled error:', err));
    }

    // Return immediately with whatever we have
    const elapsed = Date.now() - requestStart;
    console.log(`[Profiles] Request completed in ${elapsed}ms, returning ${unseen.length} profiles`);
    
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

  // Mark a profile as having a bad image (so it won't be returned again)
  app.post("/api/profiles/:id/bad-image", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });

      console.log(`[Bad Image] Profile ${id} reported as having broken image`);
      
      // Delete the profile so it won't be served again
      const deleted = await storage.deleteProfile(id);
      if (deleted) {
        console.log(`[Bad Image] Profile ${id} deleted successfully`);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("[Bad Image] Error:", error);
      res.status(500).json({ error: "Failed to mark bad image" });
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
  
  app.post("/api/reject", async (req, res) => {
    try {
      const { userId, profileId } = req.body;
      if (!userId || !profileId) {
        return res.status(400).json({ error: "Missing userId or profileId" });
      }
      storage.rejectProfile(userId, profileId);
      res.json({ success: true });
    } catch (error) {
      console.error("[POST /api/reject] Error:", error);
      res.status(400).json({ error: "Failed to reject profile" });
    }
  });

  app.get("/api/matches/by-id/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) {
        console.log(`[GET /api/matches/by-id/${req.params.matchId}] Invalid matchId`);
        return res.status(400).json({ error: "Invalid match ID" });
      }

      // Find the match by iterating through all user matches (userId=1 for now)
      const allMatches = await storage.getMatches(1);
      const match = allMatches.find(m => m.id === matchId);
      
      if (!match) {
        console.log(`[GET /api/matches/by-id/${matchId}] Match NOT found. Available matches: [${allMatches.map(m => m.id).join(', ')}]`);
        return res.status(404).json({ error: "Match not found" });
      }

      const profile = await storage.getProfile(match.profileId);
      if (!profile) {
        console.log(`[GET /api/matches/by-id/${matchId}] Match found but profile ${match.profileId} NOT found`);
        return res.status(404).json({ error: "Profile not found" });
      }

      console.log(`[GET /api/matches/by-id/${matchId}] Success - match.id=${match.id}, profile.id=${profile.id}, profile.name=${profile.name}`);
      res.json({ match, profile });
    } catch (error) {
      console.error("[GET /api/matches/by-id] Error:", error);
      res.status(500).json({ error: "Failed to fetch match" });
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

  // ============ ADMIN: IMAGE TAGGING ============
  app.get("/api/admin/images", async (_req, res) => {
    try {
      const allImages: { id: string; gender: "male" | "female" | "other" }[] = [];
      const seen = new Set<string>();
      
      for (const id of MEN_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "male" });
          seen.add(id);
        }
      }
      for (const id of WOMEN_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "female" });
          seen.add(id);
        }
      }
      for (const id of ANDROGYNOUS_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "other" });
          seen.add(id);
        }
      }
      
      console.log(`[Admin] Returning ${allImages.length} unique images (${MEN_PORTRAIT_IDS.length} male, ${WOMEN_PORTRAIT_IDS.length} female, ${ANDROGYNOUS_PORTRAIT_IDS.length} other)`);
      res.json(allImages);
    } catch (error) {
      console.error("[Admin] Error fetching images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.post("/api/admin/images/tags", async (req, res) => {
    try {
      const { tags } = req.body as { tags: Record<string, "male" | "female" | "other" | "broken"> };
      
      const changes = {
        toMale: [] as string[],
        toFemale: [] as string[],
        toOther: [] as string[],
        broken: [] as string[],
      };
      
      for (const [id, newTag] of Object.entries(tags)) {
        if (newTag === "male") changes.toMale.push(id);
        else if (newTag === "female") changes.toFemale.push(id);
        else if (newTag === "other") changes.toOther.push(id);
        else if (newTag === "broken") changes.broken.push(id);
      }
      
      console.log("[Admin] Image tag changes:", {
        toMale: changes.toMale.length,
        toFemale: changes.toFemale.length,
        toOther: changes.toOther.length,
        broken: changes.broken.length,
      });
      
      console.log("\n=== COPY THESE CHANGES TO portrait-library.ts ===");
      if (changes.toMale.length > 0) {
        console.log("\nMove to MEN_PORTRAIT_IDS:");
        changes.toMale.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.toFemale.length > 0) {
        console.log("\nMove to WOMEN_PORTRAIT_IDS:");
        changes.toFemale.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.toOther.length > 0) {
        console.log("\nRemove from both arrays (other/ambiguous):");
        changes.toOther.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.broken.length > 0) {
        console.log("\nBROKEN - Remove from all arrays:");
        changes.broken.forEach(id => console.log(`  "${id}",`));
      }
      console.log("\n=== END CHANGES ===\n");
      
      res.json({ 
        success: true, 
        message: "Changes logged to console. Update portrait-library.ts manually.",
        changes 
      });
    } catch (error) {
      console.error("[Admin] Error saving tags:", error);
      res.status(500).json({ error: "Failed to save tags" });
    }
  });

  const httpServer = createServer(app);
  
  // Pre-generate profiles at startup so users don't wait
  console.log(`[Startup] Triggering initial profile generation of ${PROFILE_GEN_BATCH_SIZE} profiles`);
  generateProfilesInBackground("all", 21, 99, PROFILE_GEN_BATCH_SIZE)
    .catch(err => console.error('[Startup Gen] Error:', err));
  
  return httpServer;
}
