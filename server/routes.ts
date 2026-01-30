import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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

function getPortraitUrl(seed: number): string {
  const id = PORTRAIT_IDS[seed % PORTRAIT_IDS.length];
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=600&q=80`;
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

      const names = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler",
        "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker",
        "Charlie", "Blake", "Sawyer", "Rowan", "Finley"
      ];

      const quirks = [
        "I'm weirdly good at naming pets.",
        "I collect vintage spoons like it's a sport.",
        "I can't eat pizza without ranch.",
        "I still have a flip phone for the aesthetic.",
        "I've never seen Star Wars. Don't hurt me.",
        "I sleep with a fan on even in winter.",
        "I'm a semi-pro at GeoGuessr.",
        "I only drink coffee from blue mugs. No exceptions."
      ];

      for (let i = 0; i < 30; i++) {
        const arch = pick(archetypes);
        const name = pick(names);
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const quirk = pick(quirks);
        const seed = Date.now() + i + Math.floor(Math.random() * 10000);

        const bio = `I'm a ${arch.label.toLowerCase()}. Usually found doing ${arch.interests[0]} or ${arch.interests[1]}. ${quirk} Secret talent: ${arch.interests[2]}.`;

        await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: getPortraitUrl(seed),
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
