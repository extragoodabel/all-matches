import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makePortraitUrl(seed: number): string {
  const portraitIds = [
    "1534528741775-53994a69daeb", "1506794778202-cad84cf45f1d", "1507003211169-0a1dd7228f2d",
    "1531746020798-e6953c6e8e04", "1544005313-94ddf0286df2", "1552374196-c4e7ffc6e12e",
    "1500648767791-00dcc994a43e", "1494790108377-be9c29b29330", "1521119956141-1933120bc71e",
    "1517841905572-4b668627c810", "1508214751196-435431004b74", "1529626431928-c79c1031c130",
    "1520813792240-a88d7c442654", "1524503033104-815228536339", "1509191425245-974c4673832d"
  ];
  const id = portraitIds[seed % portraitIds.length];
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=400&h=600`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const userId = 1; // Default user for now
    let unseen = await storage.getUnseenProfiles(userId);

    // Refill buffer if running low
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
        { label: "Foodie Blogger", interests: ["hole-in-the-wall spots", "food photography", "tasting menus"] },
      ];

      const names = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler", "Peyton", "Avery",
        "Dakota", "Reese", "Hayden", "Emerson", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
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

      for (let i = 0; i < 30; i++) {
        const arch = pick(archetypes);
        const name = pick(names);
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const quirk = pick(quirks);

        const seed = Math.floor(Math.random() * 1_000_000);
        const imageUrl = makePortraitUrl(seed);

        const bio = `I’m a ${arch.label.toLowerCase()}. Usually found doing ${arch.interests[0]} or ${arch.interests[1]}. ${quirk} Secret talent: ${arch.interests[2]}.`;

        await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl,
          isAI: true,
          characterSpec: null,
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

      // Save user message immediately
      const createdMessage = await storage.createMessage(message);

      // Generate AI reply asynchronously
      if (!message.isAI) {
        // IMPORTANT FIX:
        // message.matchId is a match id, not a profile id.
        // We must look up the match to find the profileId, then load that profile.
        const matches = await storage.getMatches(1); // default user
        const match = matches.find((m) => m.id === message.matchId);

        if (!match) {
          return res.status(404).json({ error: "Match not found" });
        }

        const profile = await storage.getProfile(match.profileId);
        if (!profile) {
          return res.status(404).json({ error: "Profile not found" });
        }

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
              // Small natural pause + typing duration
              await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 700));
              await new Promise((resolve) => setTimeout(resolve, aiResponse.typingDelay));

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
