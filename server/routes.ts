import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertUserSchema, insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const userId = 1; // Assuming default user for now
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
        { label: "History Buff", interests: ["museums", "civil war reenactment", "archaeology"] },
        { label: "Plant Parent", interests: ["botany", "interior design", "organic gardening"] },
        { label: "Anime Enthusiast", interests: ["manga", "conventions", "japanese cooking"] },
        { label: "DIY Crafter", interests: ["pottery", "sewing", "woodworking"] },
        { label: "Coffee Snob", interests: ["espresso machines", "bean roasting", "latte art"] },
        { label: "Stargazer", interests: ["astrophotography", "telescopes", "space exploration"] },
        { label: "Urban Gardener", interests: ["beekeeping", "hydroponics", "farmers markets"] },
        { label: "Vinyl Collector", interests: ["jazz", "record stores", "audio equipment"] },
        { label: "Puzzle Master", interests: ["escape rooms", "crosswords", "sudoku"] },
        { label: "Street Photographer", interests: ["leica cameras", "film processing", "architecture"] },
        { label: "Foodie Blogger", interests: ["michelin stars", "food photography", "wine tasting"] }
      ];

      const names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler", "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley"];
      const quirks = ["I'm weirdly good at naming pets.", "I have a weird collection of vintage spoons.", "I can't eat pizza without ranch.", "I still have a flip phone for the aesthetic.", "I've never seen Star Wars.", "I sleep with a fan on even in winter.", "I'm a semi-pro at Geoguessr.", "I only drink coffee from blue mugs."];

      for (let i = 0; i < 30; i++) {
        const arch = archetypes[Math.floor(Math.random() * archetypes.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        const age = 21 + Math.floor(Math.random() * 25);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const quirk = quirks[Math.floor(Math.random() * quirks.length)];
        
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://picsum.photos/seed/${seed}/400/600`;
        
        const bio = `I'm a ${arch.label.toLowerCase()}. Usually found ${arch.interests[0]} or ${arch.interests[1]}. ${quirk} My secret talent is ${arch.interests[2]}.`;

        await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl,
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
    } catch (error) {
      res.status(400).json({ error: "Invalid match data" });
    }
  });

  app.get("/api/matches/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const matches = await storage.getMatches(userId);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.get("/api/messages/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) {
        return res.status(400).json({ error: "Invalid match ID" });
      }
      const messages = await storage.getMessages(matchId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);

      // Create the user's message first
      const createdMessage = await storage.createMessage(message);

      // If it's a user message, generate AI response
      if (!message.isAI) {
        const profile = await storage.getProfile(message.matchId);
        if (!profile) {
          return res.status(404).json({ error: "Profile not found" });
        }

        const currentMessages = await storage.getMessages(message.matchId);

        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
            messageHistory: currentMessages.map(m => ({
              content: m.content,
              isAI: m.isAI
            }))
          },
          message.content
        ).then(async (aiResponse) => {
          try {
            // Human-like delay: Initial pause (1.5-2.5s) + Typing duration (2-6s)
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
            await new Promise(resolve => setTimeout(resolve, aiResponse.typingDelay));

            await storage.createMessage({
              matchId: message.matchId,
              content: aiResponse.content,
              isAI: true
            });
          } catch (error) {
            console.error("Error creating AI response:", error);
          }
        }).catch(error => {
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