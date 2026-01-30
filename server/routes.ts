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
      const names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Skyler", "Peyton", "Avery", "Dakota", "Reese", "Hayden", "Emerson", "Parker"];
      const bios = [
        "Love exploring the outdoors and finding new hiking trails.",
        "Passionate about cooking and trying out new recipes.",
        "Avid reader and collector of vintage books.",
        "Tech enthusiast always looking for the next big thing.",
        "Music lover, I play three instruments and go to gigs every weekend.",
        "Artist who finds beauty in the everyday ordinary things.",
        "Traveler at heart, I've been to 15 countries and counting.",
        "Yoga practitioner and firm believer in mindfulness.",
        "Dog person who spends way too much time at the park.",
        "Movie buff with a soft spot for 80s classics.",
        "Competitive board gamer and puzzle enthusiast.",
        "Fitness junkie who loves a good sunrise run.",
        "Coffee connoisseur on a mission to find the best latte.",
        "Amateur astronomer who loves stargazing on clear nights.",
        "DIY project addict, currently renovating my home."
      ];

      for (let i = 0; i < 30; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        const bio = bios[Math.floor(Math.random() * bios.length)];
        const age = 21 + Math.floor(Math.random() * 20);
        const gender = Math.random() > 0.5 ? "male" : "female";
        const id = Math.floor(Math.random() * 1000);
        
        // Simple check to avoid exact duplicates in this batch
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