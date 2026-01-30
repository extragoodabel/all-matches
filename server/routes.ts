import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import express from "express";

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

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function safeFileName(name: string) {
  return name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
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
  // Try a bunch of combinations to avoid repeats
  for (let attempt = 0; attempt < 200; attempt++) {
    const first = pick(firstNames);
    const initial = pick(lastInitials);
    const candidate = Math.random() < 0.55 ? first : `${first} ${initial}.`;
    if (!storage.usedNames.has(candidate.toLowerCase())) {
      storage.usedNames.add(candidate.toLowerCase());
      return candidate;
    }
  }
  // fallback
  const fallback = `${pick(firstNames)} ${pick(lastInitials)}.${Math.floor(Math.random() * 99) + 1}`;
  storage.usedNames.add(fallback.toLowerCase());
  return fallback;
}

// Bio generation modes with weights
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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.9,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    return text;
  } catch (error) {
    console.error("OpenAI bio generation failed:", error);
    return null;
  }
}

function generateFallbackBio(interests: string[], quirk: string): string {
  const templates = [
    `${pick(interests)} lately. ${quirk}`,
    `If you can hang with ${pick(interests)}, we’ll get along. ${quirk}`,
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

async function generatePortraitAndSave(profile: {
  id: number;
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const outDir = path.join(process.cwd(), "generated");
  ensureDir(outDir);

  const fileBase = `profile_${profile.id}_${safeFileName(profile.name)}_${profile.age}`;
  const filePath = path.join(outDir, `${fileBase}.png`);

  // If already exists for this profile, reuse its own image (no cross-profile reuse)
  if (fs.existsSync(filePath)) {
    return `/generated/${path.basename(filePath)}?v=${profile.id}&t=${Date.now()}`;
  }

  const styleBitsPool = [
    "warm natural lighting", "cool indoor lighting", "window light", "soft shadows",
    "denim jacket", "hoodie", "minimal outfit", "streetwear", "earth-tone sweater",
    "glasses", "subtle freckles", "curly hair", "buzz cut", "wavy hair", "short bob haircut",
    "subtle tattoos", "small hoop earrings"
  ];

  const styleBits = shuffle(styleBitsPool).slice(0, 4).join(", ");

  const prompt = `Create a photorealistic dating-app style portrait photo of ONE fictional adult human (21+).
This must be an original fictional person, not a celebrity, not based on any real person.

Details:
- Age: ${profile.age} (must look 21+)
- Gender presentation: ${profile.gender}
- Vibe: ${profile.archetypeLabel}
- Interests: ${profile.interests.join(", ")}
- Quirk: ${profile.quirk}
- Visual style notes: ${styleBits}

Photo requirements:
- Looks like a real smartphone portrait photo
- Natural imperfections, not overly retouched
- Head-and-shoulders or upper torso
- Simple background, subtle bokeh
- Fully clothed, tasteful
- No text, no logos, no watermarks`;

  const img = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1536" as "1024x1024",
  });

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) return "";

  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  // Cache buster to avoid browser reuse
  return `/generated/${path.basename(filePath)}?v=${profile.id}&t=${Date.now()}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const genDir = path.join(process.cwd(), "generated");
  ensureDir(genDir);

  // Serve generated images with no caching
  app.use(
    "/generated",
    express.static(genDir, {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-store");
      },
    })
  );

  app.get("/api/profiles", async (req, res) => {
    const userId = 1;
    let unseen = await storage.getUnseenProfiles(userId);

    const TARGET_BUFFER = 20;
    const MAX_NEW_PER_REQUEST = 3; // keep it fast; generates portraits

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
      ];

      const firstNames = [
        "Alex","Jordan","Taylor","Morgan","Casey","Riley","Quinn","Skyler","Peyton","Avery",
        "Dakota","Reese","Hayden","Emerson","Parker","Charlie","Blake","Sawyer","Rowan","Finley",
        "Jamie","Sam","Cameron","Drew","Kai","Logan","Milan","Noah","Remy","Sasha",
        "Leah","Maya","Nina","Zoe","Iris","Lena","Aria","Jules","Tessa","Mina",
        "Evan","Owen","Miles","Eli","Theo","Max","Jonah","Isaac","Leo","Caleb",
      ];

      const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

      const quirks = [
        "I make playlists for every mood.",
        "I name all my houseplants.",
        "I have opinions about font kerning.",
        "I’ve memorized way too many movie quotes.",
        "I’m weirdly good at naming pets.",
        "I’m a semi-pro at GeoGuessr.",
        "I still have a flip phone for the aesthetic.",
        "I only drink coffee from blue mugs. No exceptions.",
        "I can’t eat pizza without ranch.",
      ];

      const need = Math.min(TARGET_BUFFER - unseen.length, MAX_NEW_PER_REQUEST);

      for (let i = 0; i < need; i++) {
        const arch = pick(archetypes);
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const quirk = pick(quirks);
        const name = generateUniqueName(firstNames, lastInitials);

        const bio = await generateUniqueBio({
          name,
          age,
          gender,
          archetypeLabel: arch.label,
          interests: arch.interests,
          quirk,
        });

        // Create profile first (so we have a stable id)
        const created = await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: "", // fill after portrait
          isAI: true,
          characterSpec: null,
        });

        try {
          const imgUrl = await generatePortraitAndSave({
            id: created.id,
            name,
            age,
            gender,
            archetypeLabel: arch.label,
            interests: arch.interests,
            quirk,
          });
          await storage.updateProfile(created.id, { imageUrl: imgUrl });
        } catch (e) {
          console.error("Portrait generation failed:", e);
          await storage.updateProfile(created.id, { imageUrl: "" });
        }
      }

      unseen = await storage.getUnseenProfiles(userId);
    }

    // Only return profiles that have an image (prevents UI fallback reusing the same placeholder)
    const ready = unseen.filter((p) => p.imageUrl && p.imageUrl.length > 0);

    // Randomize order so it never feels the same
    res.json(shuffle(ready));
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
      const incoming = parseInt(req.params.matchId);
      if (isNaN(incoming)) return res.status(400).json({ error: "Invalid match ID" });

      // First assume it is a real matchId
      let messages = await storage.getMessages(incoming);

      // Fallback: if client sent profileId instead
      if (messages.length === 0) {
        const matches = await storage.getMatches(1);
        const m = matches.find((mm) => mm.profileId === incoming);
        if (m) messages = await storage.getMessages(m.id);
      }

      res.json(messages);
    } catch {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);

      // Determine actual matchId (client sometimes sends profileId)
      const matches = await storage.getMatches(1);
      let match = matches.find((m) => m.id === message.matchId);

      let actualMatchId = message.matchId;
      if (!match) {
        match = matches.find((m) => m.profileId === message.matchId);
        if (match) actualMatchId = match.id;
      }

      // Save user message with correct matchId
      const createdMessage = await storage.createMessage({
        ...message,
        matchId: actualMatchId,
      });

      // Generate AI response
      if (!message.isAI) {
        if (!match) return res.status(404).json({ error: "Match not found" });

        const profile = await storage.getProfile(match.profileId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const currentMessages = await storage.getMessages(actualMatchId);

        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
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
