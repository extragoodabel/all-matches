import { type User, type InsertUser, type Profile, type Match, type Message, type InsertProfile, type InsertMatch, type InsertMessage } from "@shared/schema";
import crypto from "crypto";
import { MEN_PORTRAIT_IDS, WOMEN_PORTRAIT_IDS, shuffleArray, buildImageUrl } from "./portrait-library";

function generateMockCharacterSpec(name: string, bio: string, age: number, gender: string): string {
  const seed = crypto.createHash('md5').update(name + bio).digest('hex');
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const archetypes = [
    "Chaotic Art Kid", "Aspiring DJ", "Burned Out Grad Student", "Sweet Golden Retriever Energy",
    "Cynical but Funny", "Mysterious", "Hyper-Competent Techie", "Spiritual Nomad"
  ];
  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend"];
  const intelligenceVibes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical"];
  const moralityFlavors = ["kind", "neutral", "messy", "blunt", "slightly toxic", "overly honest"];
  const interestPool = [
    "analog photography", "deep-sea diving", "obscure 70s horror", "competitive chess",
    "brutalist architecture", "DIY synthesizers", "ultra-marathons", "astrology",
    "quantum physics", "perfecting sourdough", "urban exploration", "vintage manga"
  ];
  const stylePool = [
    { emojis: "frequent", punctuation: "loose", slang: "high", caps: "minimal", length: "short" },
    { emojis: "rare", punctuation: "perfect", slang: "low", caps: "proper", length: "moderate" },
    { emojis: "moderate", punctuation: "none", slang: "moderate", caps: "lowercase", length: "punchy" },
    { emojis: "occasional", punctuation: "minimal", slang: "gen-z", caps: "no caps ever", length: "short bursts" }
  ];
  const bits = [
    "teasing the user relentlessly", "asking weird 'would you rather' questions",
    "using overly dramatic metaphors", "sending one-word replies then a long follow-up",
    "constantly referencing a 'secret project'", "dropping random facts"
  ];
  const quirks = [
    "I make playlists for every mood.",
    "I name all my houseplants.",
    "I have opinions about font kerning."
  ];

  const spec = {
    name,
    age,
    gender,
    archetype: archetypes[n(0) % archetypes.length],
    goal: goals[n(2) % goals.length],
    intelligence: intelligenceVibes[n(4) % intelligenceVibes.length],
    morality: moralityFlavors[n(6) % moralityFlavors.length],
    interests: [interestPool[n(8) % interestPool.length], interestPool[n(10) % interestPool.length]],
    quirk: quirks[n(12) % quirks.length],
    textingStyle: stylePool[n(14) % stylePool.length],
    signatureBits: [bits[n(16) % bits.length], bits[n(18) % bits.length]],
    boundaries: "No explicit content. Stay in character. Be engaging but not creepy."
  };

  return JSON.stringify(spec);
}

const INITIAL_PROFILES = [
  { id: 1, name: "Sophie", age: 28, gender: "female", bio: "Adventure seeker and coffee enthusiast. I'm usually hiking or finding a new hidden cafe.", isAI: true, isChaos: false },
  { id: 2, name: "James", age: 31, gender: "male", bio: "Photographer by day, chef by night. Dry humor. I will absolutely judge your cutting technique.", isAI: true, isChaos: false },
  { id: 3, name: "Emma", age: 24, gender: "female", bio: "Book lover and yoga instructor. If you have a favorite essay, I want to hear about it.", isAI: true, isChaos: false },
  { id: 4, name: "Michael", age: 30, gender: "male", bio: "Music producer. Outdoors when I can, obsessed with sound design when I cannot.", isAI: true, isChaos: false },
  { id: 5, name: "Olivia", age: 25, gender: "female", bio: "Travel blogger. Street food, local markets, and I will ask you too many questions.", isAI: true, isChaos: false },
];

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProfile(id: number): Promise<Profile | undefined>;
  getProfiles(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | undefined>;
  deleteProfile(id: number): Promise<boolean>;
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
  
  // Track used names and bio hashes to prevent duplicates
  public usedNames: Set<string>;
  public usedBioHashes: Set<string>;
  
  // Image pools with non-reuse tracking
  public maleImagePool: string[];
  public femaleImagePool: string[];
  public usedMaleImageIds: Set<string>;
  public usedFemaleImageIds: Set<string>;
  // Track recently used (last 100) to prevent immediate repeats after exhaustion
  public recentMaleImageIds: string[];
  public recentFemaleImageIds: string[];

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.usedNames = new Set();
    this.usedBioHashes = new Set();
    
    // Initialize shuffled image pools from curated library
    this.maleImagePool = shuffleArray([...MEN_PORTRAIT_IDS]);
    this.femaleImagePool = shuffleArray([...WOMEN_PORTRAIT_IDS]);
    this.usedMaleImageIds = new Set();
    this.usedFemaleImageIds = new Set();
    this.recentMaleImageIds = [];
    this.recentFemaleImageIds = [];
    
    this.currentId = {
      users: 1,
      profiles: INITIAL_PROFILES.length + 1,
      matches: 1,
      messages: 1,
    };

    // Initialize with mock profiles
    INITIAL_PROFILES.forEach((profile) => {
      const charSpec = generateMockCharacterSpec(profile.name, profile.bio, profile.age, profile.gender);
      const imageId = this.getUniqueImageId(profile.gender as 'male' | 'female');
      const imageUrl = buildImageUrl(imageId, profile.id);
      console.log(`[Image] Mock profile ${profile.id} (${profile.gender}): ${imageId}`);
      this.profiles.set(profile.id, {
        ...profile,
        imageUrl,
        characterSpec: charSpec
      });
      this.usedNames.add(profile.name.toLowerCase());
      this.usedBioHashes.add(this.hashBio(profile.bio));
    });
    
    console.log(`[Image] Pools initialized: ${this.maleImagePool.length} male, ${this.femaleImagePool.length} female`);
  }
  
  getUniqueImageId(gender: 'male' | 'female'): string {
    const isMale = gender === "male";
    const pool = isMale ? this.maleImagePool : this.femaleImagePool;
    const usedSet = isMale ? this.usedMaleImageIds : this.usedFemaleImageIds;
    const recentList = isMale ? this.recentMaleImageIds : this.recentFemaleImageIds;
    const sourcePool = isMale ? MEN_PORTRAIT_IDS : WOMEN_PORTRAIT_IDS;
    
    // Find unused images not in recent 100
    let available = pool.filter(id => !usedSet.has(id) && !recentList.includes(id));
    
    if (available.length === 0) {
      // All images used, reshuffle but exclude recent 100
      console.log(`[Image] ${gender} pool EXHAUSTED. Reshuffling...`);
      const newPool = shuffleArray([...sourcePool]);
      if (isMale) {
        this.maleImagePool = newPool;
        this.usedMaleImageIds.clear();
      } else {
        this.femaleImagePool = newPool;
        this.usedFemaleImageIds.clear();
      }
      // Filter out recently used
      available = newPool.filter(id => !recentList.includes(id));
      if (available.length === 0) {
        // Even recent list is exhausted, just use any
        available = newPool;
        if (isMale) {
          this.recentMaleImageIds = [];
        } else {
          this.recentFemaleImageIds = [];
        }
      }
    }
    
    // Select random from available
    const selected = available[Math.floor(Math.random() * available.length)];
    usedSet.add(selected);
    
    // Track in recent list (keep last 100)
    recentList.push(selected);
    if (recentList.length > 100) {
      recentList.shift();
    }
    
    console.log(`[Image] Selected ${gender}: ${selected} (${available.length - 1} remaining)`);
    return selected;
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
      maxAge: 99,
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
      characterSpec: insertProfile.characterSpec ?? null,
      isChaos: insertProfile.isChaos ?? false
    };
    this.profiles.set(id, profile);
    return profile;
  }

  async updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | undefined> {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;
    const updated = { ...profile, ...updates };
    this.profiles.set(id, updated);
    return updated;
  }

  async deleteProfile(id: number): Promise<boolean> {
    return this.profiles.delete(id);
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
