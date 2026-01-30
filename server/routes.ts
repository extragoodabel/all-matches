import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

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

// Gender and age-bucketed photo pools
// Age buckets: 21-25, 26-32, 33-40, 41-50
const MALE_PHOTOS_BY_AGE: Record<string, string[]> = {
  "21-25": [
    "1500648767791-00dcc994a43e",
    "1507003211169-0a1dd7228f2d", 
    "1519345182560-3f2917c472ef",
    "1472099645785-5658abf4ff4e",
  ],
  "26-32": [
    "1506794778202-cad84cf45f1d",
    "1560250097-0b93528c311a",
    "1463453091185-61582044d556",
    "1502323777036-f29e3972d82f",
  ],
  "33-40": [
    "1552374196-c4e7ffc6e12e",
    "1500648767791-00dcc994a43e",
    "1519345182560-3f2917c472ef",
    "1506794778202-cad84cf45f1d",
  ],
  "41-50": [
    "1560250097-0b93528c311a",
    "1463453091185-61582044d556",
    "1472099645785-5658abf4ff4e",
    "1502323777036-f29e3972d82f",
  ],
};

const FEMALE_PHOTOS_BY_AGE: Record<string, string[]> = {
  "21-25": [
    "1534528741775-53994a69daeb",
    "1544005313-94ddf0286df2",
    "1531746020798-e6953c6e8e04",
    "1488426862026-3ee34a7d66df",
  ],
  "26-32": [
    "1524504388940-b1c1722653e1",
    "1489424731084-a5d8b219a5bb",
    "1508214751196-bcfd4ca60f91",
    "1487412720507-e7ab37603c6f",
  ],
  "33-40": [
    "1503235930437-8c6293ba41f5",
    "1533636721434-0e2d61030955",
    "1506863530036-1efeddceb993",
    "1438761681033-6461ffad8d80",
  ],
  "41-50": [
    "1508214751196-bcfd4ca60f91",
    "1503235930437-8c6293ba41f5",
    "1487412720507-e7ab37603c6f",
    "1438761681033-6461ffad8d80",
  ],
};

function getAgeBucket(age: number): string {
  if (age <= 25) return "21-25";
  if (age <= 32) return "26-32";
  if (age <= 40) return "33-40";
  return "41-50";
}

function getPhotoForGenderAndAge(gender: string, age: number, profileId: number): string {
  const bucket = getAgeBucket(age);
  let photoPool: string[];
  
  // Default fallback pool if everything else fails
  const fallbackPool = ["1500648767791-00dcc994a43e", "1534528741775-53994a69daeb"];
  
  if (gender === "male") {
    photoPool = MALE_PHOTOS_BY_AGE[bucket] || MALE_PHOTOS_BY_AGE["26-32"] || fallbackPool;
  } else if (gender === "female") {
    photoPool = FEMALE_PHOTOS_BY_AGE[bucket] || FEMALE_PHOTOS_BY_AGE["26-32"] || fallbackPool;
  } else {
    // "other" or unknown - pick from combined pool
    const malePool = MALE_PHOTOS_BY_AGE[bucket] || MALE_PHOTOS_BY_AGE["26-32"] || [];
    const femalePool = FEMALE_PHOTOS_BY_AGE[bucket] || FEMALE_PHOTOS_BY_AGE["26-32"] || [];
    photoPool = [...malePool, ...femalePool];
  }
  
  // Ensure we always have at least one photo
  if (photoPool.length === 0) {
    photoPool = fallbackPool;
  }
  
  const photoId = photoPool[profileId % photoPool.length];
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=400&h=600&q=80&v=${profileId}&t=${Date.now()}`;
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const userId = 1;
    
    // Parse and validate filter params
    const rawGender = (req.query.gender as string) || "all";
    const genderPref = ["male", "female", "all"].includes(rawGender) ? rawGender : "all";
    const rawMinAge = parseInt(req.query.minAge as string) || 21;
    const rawMaxAge = parseInt(req.query.maxAge as string) || 50;
    // Clamp ages to valid range
    const minAge = Math.max(21, Math.min(50, rawMinAge));
    const maxAge = Math.max(21, Math.min(50, rawMaxAge));
    
    console.log(`[Profiles] Filters: gender=${genderPref}, age=${minAge}-${maxAge}`);

    let unseen = await storage.getUnseenProfiles(userId);
    console.log(`[Profiles] Total unseen: ${unseen.length}`);

    // Apply gender filter
    if (genderPref !== "all") {
      const beforeCount = unseen.length;
      unseen = unseen.filter(p => p.gender === genderPref);
      console.log(`[Profiles] After gender filter (${genderPref}): ${beforeCount} -> ${unseen.length}`);
    }
    
    // Apply age filter
    const beforeAgeCount = unseen.length;
    unseen = unseen.filter(p => p.age >= minAge && p.age <= maxAge);
    console.log(`[Profiles] After age filter (${minAge}-${maxAge}): ${beforeAgeCount} -> ${unseen.length}`);

    const TARGET_BUFFER = 25;
    const MAX_NEW_PER_REQUEST = 12;

    if (unseen.length < TARGET_BUFFER) {
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

      const need = Math.min(TARGET_BUFFER - unseen.length, MAX_NEW_PER_REQUEST);
      console.log(`[Profiles] Generating ${need} new profiles for genderPref=${genderPref}`);

      for (let i = 0; i < need; i++) {
        const arch = pick(archetypes);
        
        // Generate age within user's preferred range
        const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
        
        // Determine gender based on user preference
        let gender: string;
        if (genderPref === "male") {
          gender = "male";
        } else if (genderPref === "female") {
          gender = "female";
        } else {
          gender = Math.random() > 0.5 ? "male" : "female";
        }
        
        const quirk = pick(quirks);
        const firstNames = gender === "male" ? maleFirstNames : femaleFirstNames;
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

        const created = await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: "",
          isAI: true,
          characterSpec: charSpec,
        });

        // Use gender and age appropriate photo
        const imageUrl = getPhotoForGenderAndAge(gender, age, created.id);
        await storage.updateProfile(created.id, { imageUrl });
      }

      // Re-fetch unseen profiles after generation
      unseen = await storage.getUnseenProfiles(userId);
      
      // Re-apply filters
      if (genderPref !== "all") {
        unseen = unseen.filter(p => p.gender === genderPref);
      }
      unseen = unseen.filter(p => p.age >= minAge && p.age <= maxAge);
      console.log(`[Profiles] After generation and filtering: ${unseen.length} profiles`);
    }

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
      const match = insertMatchSchema.parse(req.body);
      const createdMatch = await storage.createMatch(match);
      res.json(createdMatch);
    } catch {
      res.status(400).json({ error: "Invalid match data" });
    }
  });

  app.get("/api/matches/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const matches = await storage.getMatches(userId);
      res.json(matches);
    } catch {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const incoming = parseInt(req.params.id);
      if (isNaN(incoming)) return res.status(400).json({ error: "Invalid id" });

      let messages = await storage.getMessages(incoming);
      
      if (messages.length === 0) {
        const matches = await storage.getMatches(1);
        const match = matches.find((m) => m.profileId === incoming);
        if (match) {
          messages = await storage.getMessages(match.id);
        }
      }
      
      res.json(messages);
    } catch {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      
      console.log(`[Message] Incoming matchId: ${message.matchId}`);
      
      const matches = await storage.getMatches(1);
      let match = matches.find((m) => m.id === message.matchId);
      console.log(`[Message] Match found by id: ${!!match}${match ? `, profileId: ${match.profileId}` : ''}`);
      
      let actualMatchId = message.matchId;
      if (!match) {
        console.log(`[Message] Trying fallback: treating ${message.matchId} as profileId`);
        match = matches.find((m) => m.profileId === message.matchId);
        if (match) {
          console.log(`[Message] Fallback success: found match.id=${match.id} for profileId=${message.matchId}`);
          actualMatchId = match.id;
        }
      }
      
      const createdMessage = await storage.createMessage({
        ...message,
        matchId: actualMatchId
      });

      if (!message.isAI) {
        if (!match) return res.status(404).json({ error: "Match not found" });

        const profile = await storage.getProfile(match.profileId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const currentMessages = await storage.getMessages(actualMatchId);

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
                matchId: actualMatchId,
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

  const httpServer = createServer(app);
  return httpServer;
}
