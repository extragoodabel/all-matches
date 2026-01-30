import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnused<T>(arr: T[], usedSet: Set<T>): T | null {
  const available = arr.filter(item => !usedSet.has(item));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// Curated list of real, working Unsplash portrait photo IDs
const PORTRAIT_IDS = [
  // Female portraits
  "1534528741775-53994a69daeb",
  "1494790108377-be9c29b29330",
  "1517841905572-4b668627c810",
  "1544005313-94ddf0286df2",
  "1531746020798-e6953c6e8e04",
  "1488426862026-3ee34a7d66df",
  "1524504388940-b1c1722653e1",
  "1502823403499-6ccfcf4fb453",
  "1489424731084-a5d8b219a5bb",
  "1554151228-14d9def656e4",
  "1573496359142-b8d87734a5a2",
  "1508214751196-bcfd4ca60f91",
  "1487412720507-e7ab37603c6f",
  "1526510747491-58f928ec870f",
  "1529626455594-4ff0802cfb7e",
  // Male portraits  
  "1500648767791-00dcc994a43e",
  "1507003211169-0a1dd7228f2d",
  "1506794778202-cad84cf45f1d",
  "1552374196-c4e7ffc6e12e",
  "1519345182560-3f2917c472ef",
  "1472099645785-5658abf4ff4e",
  "1560250097-0b93528c311a",
  "1519085360753-af0119f7cbe7",
  "1463453091185-61582044d556",
  "1492562080023-ab3db95bfbce",
  "1548142813-c348350df52b",
  "1504257432389-52343af06ae3",
  "1557862921-37829c790f19",
  "1528892952291-009c663ce843",
  "1537511446984-935f663eb1f4"
];

function getPortraitUrl(index: number): string {
  const id = PORTRAIT_IDS[index % PORTRAIT_IDS.length];
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=600&q=80`;
}

function getUnusedImageIndex(usedIndices: Set<number>): number {
  for (let i = 0; i < PORTRAIT_IDS.length; i++) {
    if (!usedIndices.has(i)) return i;
  }
  // All used, cycle with offset
  return usedIndices.size % PORTRAIT_IDS.length;
}

function generateUniqueName(
  firstNames: string[],
  usedNames: Set<string>,
  lastInitials: string[]
): string {
  // Shuffle first names for variety
  const shuffled = [...firstNames].sort(() => Math.random() - 0.5);
  
  // Try plain first name first
  for (const name of shuffled) {
    if (!usedNames.has(name.toLowerCase())) {
      return name;
    }
  }
  // Try first name + last initial (shuffled)
  const shuffledInitials = [...lastInitials].sort(() => Math.random() - 0.5);
  for (const first of shuffled) {
    for (const initial of shuffledInitials) {
      const combo = `${first} ${initial}.`;
      if (!usedNames.has(combo.toLowerCase())) {
        return combo;
      }
    }
  }
  // Fallback: add random number suffix
  const base = shuffled[0];
  const suffix = Math.floor(Math.random() * 99) + 1;
  return `${base}${suffix}`;
}

function hashBio(bio: string): string {
  let hash = 0;
  for (let i = 0; i < bio.length; i++) {
    const char = bio.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Bio generation modes with weighted probabilities
const BIO_MODES = [
  { mode: "one_liner", weight: 15, desc: "Single punchy sentence, confident or mysterious" },
  { mode: "hot_takes", weight: 12, desc: "2-3 controversial opinions or hot takes" },
  { mode: "list_of_things", weight: 10, desc: "Bullet-style list of 3-4 things about them" },
  { mode: "prompt_answers", weight: 10, desc: "Answer dating app prompts like 'My ideal Sunday:'" },
  { mode: "low_effort", weight: 8, desc: "Minimal effort bio, 3-5 words max, mysterious or lazy" },
  { mode: "self_aware", weight: 10, desc: "Meta/self-deprecating about being on a dating app" },
  { mode: "sincere", weight: 12, desc: "Genuine and heartfelt, looking for connection" },
  { mode: "weird_flex", weight: 8, desc: "Humble brag or weird accomplishment" },
  { mode: "question", weight: 8, desc: "Ends with a question to spark conversation" },
  { mode: "anti_bio", weight: 5, desc: "Refuses to write a normal bio, defiant" },
  { mode: "specific_scenario", weight: 7, desc: "Describes a very specific date scenario" },
  { mode: "red_flags_joke", weight: 5, desc: "Jokes about their own red flags" }
];

function pickWeightedMode(): string {
  const total = BIO_MODES.reduce((sum, m) => sum + m.weight, 0);
  let r = Math.random() * total;
  for (const m of BIO_MODES) {
    r -= m.weight;
    if (r <= 0) return m.mode;
  }
  return BIO_MODES[0].mode;
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

  const mode = pickWeightedMode();
  const modeInfo = BIO_MODES.find(m => m.mode === mode) || BIO_MODES[0];

  const prompt = `Write a dating app bio for a fictional person (NOT a real person, NOT a celebrity).

Character:
- Name: ${context.name}, Age: ${context.age}, Gender: ${context.gender}
- Vibe: ${context.archetypeLabel}
- Into: ${context.interests.join(", ")}
- Quirk: ${context.quirk}

Bio style: ${modeInfo.mode.replace(/_/g, " ")} - ${modeInfo.desc}

RULES:
- 1-5 lines max
- Do NOT start with "I'm a..." or "Usually found..." or "Secret talent:"
- Do NOT use labels like "Interests:" or "About me:"
- Use 0-3 emojis max (or none)
- Include 2-4 specific details from their interests/vibe but weave them in naturally
- Match the effort level of the bio style
- Output ONLY the bio text, no quotes, no explanation`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.9
    });
    return response.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("OpenAI bio generation failed:", error);
    return null;
  }
}

function generateFallbackBio(
  arch: { label: string; interests: string[] },
  quirk: string
): string {
  const templates = [
    `${arch.interests[0]} enthusiast. ${quirk}`,
    `Looking for someone who gets ${arch.interests[1]}. ${quirk}`,
    `${quirk} Also really into ${arch.interests[0]}.`,
    `Will talk your ear off about ${arch.interests[2]}.`,
    `${arch.interests[0]} + ${arch.interests[1]} + coffee`,
    `Here for a good time and ${arch.interests[1]}.`,
    `Probably thinking about ${arch.interests[0]} right now.`
  ];
  return pick(templates);
}

async function generateUniqueBioWithAI(
  archetypes: { label: string; interests: string[] }[],
  quirks: string[],
  usedBioHashes: Set<string>,
  context: { name: string; age: number; gender: string }
): Promise<{ bio: string; arch: { label: string; interests: string[] } }> {
  const arch = pick(archetypes);
  const quirk = pick(quirks);

  for (let attempt = 0; attempt < 5; attempt++) {
    const aiBio = await generateBioWithOpenAI({
      name: context.name,
      age: context.age,
      gender: context.gender,
      archetypeLabel: arch.label,
      interests: arch.interests,
      quirk
    });

    if (aiBio) {
      const bioHash = hashBio(aiBio);
      if (!usedBioHashes.has(bioHash)) {
        usedBioHashes.add(bioHash);
        console.log(`[Bio Generated] ${context.name}: ${aiBio}`);
        return { bio: aiBio, arch };
      }
    }
  }

  // Fallback to local template
  const fallback = generateFallbackBio(arch, quirk);
  usedBioHashes.add(hashBio(fallback));
  console.log(`[Bio Fallback] ${context.name}: ${fallback}`);
  return { bio: fallback, arch };
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const userId = 1;
    let unseen = await storage.getUnseenProfiles(userId);

    if (unseen.length < 20) {
      const archetypes = [
        { label: "Chaotic Art Kid", interests: ["analog photography", "DIY synthesizers", "street art"] },
        { label: "Aspiring DJ", interests: ["vinyl collecting", "techno", "club hopping"] },
        { label: "Burned Out Grad Student", interests: ["quantum physics", "perfecting sourdough", "thesis writing"] },
        { label: "Sweet Golden Retriever Energy", interests: ["dog parks", "beach days", "movie nights"] },
        { label: "Cynical but Funny", interests: ["dark comedy", "people watching", "urban exploration"] },
        { label: "Mysterious", interests: ["occult history", "stargazing", "poetry"] },
        { label: "Hyper-Competent Techie", interests: ["open source", "cybersecurity", "mechanical keyboards"] },
        { label: "Spiritual Nomad", interests: ["reiki", "crystals", "van life"] },
        { label: "High-Energy Athlete", interests: ["crossfit", "meal prep", "hiking"] },
        { label: "Old Soul Librarian", interests: ["classic literature", "tea blending", "knitting"] },
        { label: "Socialite with an Edge", interests: ["fashion design", "cocktail mixing", "modern art"] },
        { label: "Corporate Rebel", interests: ["investing", "skydiving", "poker"] },
        { label: "Indie Musician", interests: ["songwriting", "thrift shopping", "coffee"] },
        { label: "Gamer", interests: ["speedrunning", "cosplay", "streaming"] },
        { label: "History Buff", interests: ["museums", "archaeology", "weird historical trivia"] },
        { label: "Plant Parent", interests: ["botany", "interior design", "organic gardening"] },
        { label: "Anime Enthusiast", interests: ["manga", "conventions", "japanese cooking"] },
        { label: "DIY Crafter", interests: ["pottery", "sewing", "woodworking"] },
        { label: "Coffee Snob", interests: ["espresso machines", "bean roasting", "latte art"] },
        { label: "Stargazer", interests: ["astrophotography", "telescopes", "space exploration"] },
        { label: "Urban Gardener", interests: ["beekeeping", "hydroponics", "farmers markets"] },
        { label: "Vinyl Collector", interests: ["jazz", "record stores", "audio equipment"] },
        { label: "Puzzle Master", interests: ["escape rooms", "crosswords", "sudoku"] },
        { label: "Street Photographer", interests: ["leica cameras", "film processing", "architecture"] },
        { label: "Foodie Blogger", interests: ["hole-in-the-wall spots", "food photography", "tasting menus"] }
      ];

      const firstNames = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler",
        "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker",
        "Charlie", "Blake", "Sawyer", "Rowan", "Finley", "Jamie", "Drew", "Sam",
        "Kai", "Robin", "Jesse", "Devon", "Cameron", "Logan", "Sage"
      ];

      const lastInitials = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W", "Z"];

      const quirks = [
        "I'm weirdly good at naming pets.",
        "I collect vintage spoons like it's a sport.",
        "I can't eat pizza without ranch.",
        "I still have a flip phone for the aesthetic.",
        "I've never seen Star Wars. Don't hurt me.",
        "I sleep with a fan on even in winter.",
        "I'm a semi-pro at GeoGuessr.",
        "I only drink coffee from blue mugs. No exceptions.",
        "I have opinions about font kerning.",
        "I've memorized way too many movie quotes.",
        "I make playlists for every mood.",
        "I name all my houseplants."
      ];

      for (let i = 0; i < 30; i++) {
        // Generate unique name
        const name = generateUniqueName(firstNames, storage.usedNames, lastInitials);
        storage.usedNames.add(name.toLowerCase());
        
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        
        // Generate unique bio with OpenAI (or fallback)
        const { bio } = await generateUniqueBioWithAI(
          archetypes, 
          quirks, 
          storage.usedBioHashes,
          { name, age, gender }
        );
        
        // Get unique image index
        const imageIndex = getUnusedImageIndex(storage.usedImageIndices);
        storage.usedImageIndices.add(imageIndex);

        await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: getPortraitUrl(imageIndex),
          isAI: true,
          characterSpec: null
        });
      }

      unseen = await storage.getUnseenProfiles(userId);
    }

    res.json(unseen);
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

  app.get("/api/messages/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) return res.status(400).json({ error: "Invalid match ID" });

      const messages = await storage.getMessages(matchId);
      res.json(messages);
    } catch {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      const createdMessage = await storage.createMessage(message);

      if (!message.isAI) {
        const matches = await storage.getMatches(1);
        const match = matches.find((m) => m.id === message.matchId);
        if (!match) return res.status(404).json({ error: "Match not found" });

        const profile = await storage.getProfile(match.profileId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const currentMessages = await storage.getMessages(message.matchId);

        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
            messageHistory: currentMessages.map((m) => ({
              content: m.content,
              isAI: m.isAI
            }))
          },
          message.content
        )
          .then(async (aiResponse) => {
            try {
              await new Promise((r) => setTimeout(r, 400 + Math.random() * 500));
              await new Promise((r) => setTimeout(r, aiResponse.typingDelay));

              await storage.createMessage({
                matchId: message.matchId,
                content: aiResponse.content,
                isAI: true
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
