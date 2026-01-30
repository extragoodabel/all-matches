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

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function safeFileName(name: string) {
  return name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

/**
 * Generate a fictional, photoreal dating-app portrait.
 * - NOT a real person
 * - NOT a celebrity
 * - 21+ adult
 *
 * Uses GPT image models which return base64-encoded images. :contentReference[oaicite:1]{index=1}
 */
async function generatePortraitToDisk(args: {
  profileId: number;
  name: string;
  age: number;
  gender: "male" | "female";
  archetypeLabel: string;
  interests: string[];
  quirk: string;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const outDir = path.join(process.cwd(), "generated");
  ensureDir(outDir);

  const fileBase = `profile_${args.profileId}_${safeFileName(args.name)}_${args.age}`;
  const filePath = path.join(outDir, `${fileBase}.png`);

  // If we already generated it, reuse it.
  if (fs.existsSync(filePath)) {
    return `/generated/${path.basename(filePath)}`;
  }

  const [i1, i2] = args.interests;

  // Strong guardrails to avoid real-person resemblance.
  const prompt = `
Create a photorealistic portrait photo for a fictional dating-app profile.

Subject:
- Fictional ${args.gender}, age ${args.age} (must look 21+)
- Archetype: ${args.archetypeLabel}
- Vibe: modern, believable, candid
- Interests: ${i1}, ${i2}
- Quirk: ${args.quirk}

Photo style:
- Looks like a real smartphone portrait (natural lighting, slight imperfection, shallow depth of field)
- Head-and-shoulders or upper torso
- Neutral/simple background (apartment wall, cafe, street bokeh) but not a landmark
- No text, no logos, no watermarks
- Not a celebrity, not a public figure, not based on any real person
- Do not resemble a specific identifiable person
- One person only
- Tasteful, fully clothed
  `.trim();

  // Portrait size supported by GPT image models. :contentReference[oaicite:2]{index=2}
  const img = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1536",
  });

  const b64 = img.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no base64 data.");

  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
  return `/generated/${path.basename(filePath)}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve generated images from disk at /generated/...
  const genDir = path.join(process.cwd(), "generated");
  ensureDir(genDir);
  app.use("/generated", express.static(genDir));

  app.get("/api/profiles", async (req, res) => {
    const userId = 1; // default user for now
    let unseen = await storage.getUnseenProfiles(userId);

    // If we’re low, generate a few more right now.
    // IMPORTANT: Image generation is slower/costly, so cap per request to avoid timeouts.
    const TARGET_BUFFER = 20;
    const MAX_NEW_PER_REQUEST = 4;

    if (unseen.length < TARGET_BUFFER) {
      const archetypes = [
        {
          label: "Chaotic Art Kid",
          interests: ["analog photography", "DIY synthesizers", "street art"],
          styleHint: "expressive, unpredictable, witty",
        },
        {
          label: "Aspiring DJ",
          interests: ["vinyl collecting", "techno", "club hopping"],
          styleHint: "confident, flirty, nightlife energy",
        },
        {
          label: "Burned Out Grad Student",
          interests: ["research rabbit holes", "sourdough experiments", "late-night debates"],
          styleHint: "smart, slightly frazzled, funny",
        },
        {
          label: "Sweet Golden Retriever Energy",
          interests: ["dog parks", "beach days", "movie nights"],
          styleHint: "warm, upbeat, wholesome",
        },
        {
          label: "Cynical but Funny",
          interests: ["dark comedy", "people watching", "urban exploration"],
          styleHint: "dry, sharp, surprisingly sweet",
        },
        {
          label: "Mysterious",
          interests: ["occult history", "stargazing", "poetry"],
          styleHint: "cryptic, poetic, curious",
        },
        {
          label: "Hyper-Competent Techie",
          interests: ["open source", "cybersecurity", "mechanical keyboards"],
          styleHint: "fast brain, playful competence",
        },
        {
          label: "Spiritual Nomad",
          interests: ["reiki", "crystals", "van life"],
          styleHint: "gentle, mystical, inviting",
        },
        {
          label: "High-Energy Athlete",
          interests: ["crossfit", "meal prep", "mountain trails"],
          styleHint: "motivated, competitive, upbeat",
        },
        {
          label: "Old Soul Librarian",
          interests: ["classic literature", "tea blending", "quiet museums"],
          styleHint: "soft-spoken, thoughtful, charming",
        },
        // You can add more here later without changing anything else.
      ];

      const names = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler",
        "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker",
        "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
      ];

      const quirks = [
        "I’m weirdly good at naming pets.",
        "I collect vintage spoons like it’s a sport.",
        "I can’t eat pizza without ranch.",
        "I still have a flip phone for the aesthetic.",
        "I’ve never seen Star Wars. Don’t hurt me.",
        "I sleep with a fan on even in winter.",
        "I’m a semi-pro at GeoGuessr.",
        "I only drink coffee from blue mugs. No exceptions.",
      ];

      const toCreate = Math.min(TARGET_BUFFER - unseen.length, MAX_NEW_PER_REQUEST);

      for (let i = 0; i < toCreate; i++) {
        const arch = pick(archetypes);
        const name = pick(names);
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const quirk = pick(quirks);

        // Bio includes explicit personality hooks to help chat immediately.
        const bio =
          `Archetype: ${arch.label}. ` +
          `I’m into ${arch.interests[0]}, ${arch.interests[1]}, and ${arch.interests[2]}. ` +
          `${quirk} ` +
          `Texting style: ${arch.styleHint}.`;

        // Create the profile first with a temporary image URL (won’t be shown long)
        // Then replace it with generated image once we have the ID.
        const created = await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: "", // filled after image generation
          isAI: true,
          characterSpec: null,
        });

        // Generate and save portrait to disk; then update imageUrl by re-creating profile record.
        // MemStorage has no update method, so we re-create by direct get+set via createProfile isn't possible.
        // Instead: since MemStorage stores the object, we can fetch it and mutate safely in memory.
        const p = await storage.getProfile(created.id);
        if (p) {
          try {
            const imgUrl = await generatePortraitToDisk({
              profileId: created.id,
              name,
              age,
              gender: gender as "male" | "female",
              archetypeLabel: arch.label,
              interests: arch.interests,
              quirk,
            });
            // @ts-expect-error MemStorage stores by reference; safe to mutate in-memory record
            p.imageUrl = imgUrl;
          } catch (e) {
            console.error("Image generation failed:", e);
            // Fallback: a simple local placeholder (you can add a real placeholder asset later)
            // @ts-expect-error
            p.imageUrl = "";
          }
        }
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

      // Save user message
      const createdMessage = await storage.createMessage(message);

      if (!message.isAI) {
        // FIX: matchId is not profileId. Find the match, then the profileId.
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
              isAI: m.isAI,
            })),
          },
          message.content
        )
          .then(async (aiResponse) => {
            try {
              // Shorter, less annoying delay baseline
              await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));
              await new Promise((r) => setTimeout(r, aiResponse.typingDelay));

              await storage.createMessage({
                matchId: message.matchId,
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
