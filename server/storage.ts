import { type User, type InsertUser, type Profile, type Match, type Message, type InsertProfile, type InsertMatch, type InsertMessage } from "@shared/schema";
import { mockProfiles } from "../client/src/lib/mock-profiles";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProfile(id: number): Promise<Profile | undefined>;
  getProfiles(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  createMatch(match: InsertMatch): Promise<Match>;
  getMatches(userId: number): Promise<Match[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(matchId: number): Promise<Message[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private profiles: Map<number, Profile>;
  private matches: Map<number, Match>;
  private messages: Map<number, Message>;
  private currentId: { [key: string]: number };
  
  // Track used names, image indices, and bio hashes to prevent duplicates
  public usedNames: Set<string>;
  public usedImageIndices: Set<number>;
  public usedBioHashes: Set<string>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.usedNames = new Set();
    this.usedImageIndices = new Set();
    this.usedBioHashes = new Set();
    this.currentId = {
      users: 1,
      profiles: mockProfiles.length + 1, // Start after mock profiles
      matches: 1,
      messages: 1,
    };

    // Initialize with mock profiles
    mockProfiles.forEach((profile, idx) => {
      this.profiles.set(profile.id, {
        ...profile,
        characterSpec: null
      });
      // Track mock profile names and bios as used
      this.usedNames.add(profile.name.toLowerCase());
      this.usedBioHashes.add(this.hashBio(profile.bio));
      this.usedImageIndices.add(idx);
    });
  }

  hashBio(bio: string): string {
    let hash = 0;
    for (let i = 0; i < bio.length; i++) {
      const char = bio.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const user: User = { 
      ...insertUser, 
      id,
      minAge: 21,
      maxAge: 50,
      genderPreference: "all"
    };
    this.users.set(id, user);
    return user;
  }

  async getProfile(id: number): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getProfiles(): Promise<Profile[]> {
    return Array.from(this.profiles.values());
  }

  async getUnseenProfiles(userId: number): Promise<Profile[]> {
    const userMatches = Array.from(this.matches.values())
      .filter(m => m.userId === userId)
      .map(m => m.profileId);
    
    return Array.from(this.profiles.values())
      .filter(p => !userMatches.includes(p.id));
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = this.currentId.profiles++;
    const profile: Profile = { 
      ...insertProfile, 
      id, 
      isAI: insertProfile.isAI ?? false,
      gender: insertProfile.gender ?? "other",
      characterSpec: insertProfile.characterSpec ?? null
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = this.currentId.matches++;
    const match: Match = { ...insertMatch, id, createdAt: new Date() };
    this.matches.set(id, match);
    return match;
  }

  async getMatches(userId: number): Promise<Match[]> {
    return Array.from(this.matches.values()).filter(
      (match) => match.userId === userId,
    );
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentId.messages++;
    const message: Message = { ...insertMessage, id, createdAt: new Date() };
    this.messages.set(id, message);
    return message;
  }

  async getMessages(matchId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.matchId === matchId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export const storage = new MemStorage();