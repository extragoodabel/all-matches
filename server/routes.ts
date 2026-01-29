import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertUserSchema, insertMatchSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const profiles = await storage.getProfiles();
    res.json(profiles);
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
        // Get the profile (in our case, matchId is actually profileId)
        const profile = await storage.getProfile(message.matchId);
        if (!profile) {
          return res.status(404).json({ error: "Profile not found" });
        }

        // Get message history for context
        const messages = await storage.getMessages(message.matchId);

        // Generate AI response asynchronously
        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
            messageHistory: messages.map(m => ({
              content: m.content,
              isAI: m.isAI
            }))
          },
          message.content
        ).then(async (aiResponse) => {
          try {
            // Realistic "human" delay:
            // 1. A short pause before the "typing" starts (1-2 seconds)
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

            // 2. The actual typing duration (already calculated in generateAIResponse)
            await new Promise(resolve => setTimeout(resolve, aiResponse.typingDelay));

            // Create the AI's response message
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