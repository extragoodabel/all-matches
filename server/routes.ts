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
        { label: "Chaotic Art Kid", interests: ["analog photography", "DIY synthesizers", "street art"], goal: "chaos", intelligence: "witty", morality: "messy", style: "lowercase, high slang" },
        { label: "Aspiring DJ", interests: ["vinyl collecting", "techno", "club hopping"], goal: "validation", intelligence: "street smart", morality: "neutral", style: "minimal caps, frequent emojis" },
        { label: "Burned Out Grad Student", interests: ["quantum physics", "perfecting sourdough", "thesis writing"], goal: "sincere", intelligence: "academic", morality: "neutral", style: "proper caps, rare emojis" },
        { label: "Sweet Golden Retriever Energy", interests: ["dog parks", "beach days", "movie nights"], goal: "relationship", intelligence: "ditzy", morality: "kind", style: "excessive punctuation, frequent emojis" },
        { label: "Cynical but Funny", interests: ["dark comedy", "people watching", "urban exploration"], goal: "debate", intelligence: "intense", morality: "blunt", style: "sarcastic tone, moderate punctuation" },
        { label: "Mysterious", interests: ["occult history", "stargazing", "poetry"], goal: "mystery", intelligence: "philosophical", morality: "neutral", style: "short, punchy sentences" },
        { label: "Hyper-Competent Techie", interests: ["open source", "cybersecurity", "mechanical keyboards"], goal: "validation", intelligence: "intense", morality: "overly honest", style: "proper grammar, low slang" },
        { label: "Spiritual Nomad", interests: ["reiki", "crystals", "van life"], goal: "making a friend", intelligence: "philosophical", morality: "kind", style: "peaceful tone, frequent flower emojis" },
        { label: "High-Energy Athlete", interests: ["crossfit", "meal prep", "hiking"], goal: "flirt", intelligence: "street smart", morality: "neutral", style: "direct, high energy" },
        { label: "Old Soul Librarian", interests: ["classic literature", "tea blending", "knitting"], goal: "relationship", intelligence: "academic", morality: "kind", style: "elegant, proper punctuation" },
        { label: "Socialite with an Edge", interests: ["fashion design", "cocktail mixing", "modern art"], goal: "validation", intelligence: "witty", morality: "slightly toxic", style: "trendy slang, frequent emojis" },
        { label: "Corporate Rebel", interests: ["investing", "skydiving", "poker"], goal: "flirt", intelligence: "intense", morality: "blunt", style: "brief, authoritative" },
        { label: "Indie Musician", interests: ["songwriting", "thrift shopping", "coffee"], goal: "sincere", intelligence: "witty", morality: "neutral", style: "lowercase, artistic" },
        { label: "Gamer Girl/Boy", interests: ["speedrunning", "cosplay", "streaming"], goal: "making a friend", intelligence: "street smart", morality: "kind", style: "internet slang, frequent emojis" },
        { label: "History Buff", interests: ["museums", "civil war reenactment", "archaeology"], goal: "debate", intelligence: "academic", morality: "overly honest", style: "informative, long-winded" },
        { label: "Plant Parent", interests: ["botany", "interior design", "organic gardening"], goal: "relationship", intelligence: "philosophical", morality: "kind", style: "soft tone, leaf emojis" },
        { label: "Anime Enthusiast", interests: ["manga", "conventions", "japanese cooking"], goal: "making a friend", intelligence: "street smart", morality: "neutral", style: "enthusiastic, references" },
        { label: "DIY Crafter", interests: ["pottery", "sewing", "woodworking"], goal: "sincere", intelligence: "street smart", morality: "kind", style: "helpful, warm" },
        { label: "Coffee Snob", interests: ["espresso machines", "bean roasting", "latte art"], goal: "debate", intelligence: "intense", morality: "blunt", style: "opinionated, punchy" },
        { label: "Stargazer", interests: ["astrophotography", "telescopes", "space exploration"], goal: "mystery", intelligence: "philosophical", morality: "neutral", style: "dreamy, poetic" },
        { label: "Urban Gardener", interests: ["beekeeping", "hydroponics", "farmers markets"], goal: "relationship", intelligence: "street smart", morality: "kind", style: "earthy, practical" },
        { label: "Vinyl Collector", interests: ["jazz", "record stores", "audio equipment"], goal: "sincere", intelligence: "witty", morality: "neutral", style: "casual, relaxed" },
        { label: "Puzzle Master", interests: ["escape rooms", "crosswords", "sudoku"], goal: "debate", intelligence: "intense", morality: "neutral", style: "logical, brief" },
        { label: "Street Photographer", interests: ["leica cameras", "film processing", "architecture"], goal: "sincere", intelligence: "philosophical", morality: "neutral", style: "visual, minimalist" },
        { label: "Foodie Blogger", interests: ["michelin stars", "food photography", "wine tasting"], goal: "validation", intelligence: "witty", morality: "slightly toxic", style: "opinionated, trendy" }
      ];

      const names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler", "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker"];

      for (let i = 0; i < 30; i++) {
        const arch = archetypes[Math.floor(Math.random() * archetypes.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        const age = 21 + Math.floor(Math.random() * 20);
        const gender = Math.random() > 0.5 ? "male" : "female";
        
        // Generate a specific bio based on archetype
        const bio = `I'm a ${arch.label.toLowerCase()}. Usually found ${arch.interests[0]} or ${arch.interests[1]}. I have a weird collection of ${arch.interests[2]} and I'm weirdly good at naming pets.`;

        await storage.createProfile({
          name,
          age,
          bio,
          gender,
          imageUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}`,
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