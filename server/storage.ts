import { type User, type InsertUser, type Profile, type Match, type Message, type InsertProfile, type InsertMatch, type InsertMessage } from "@shared/schema";
import crypto from "crypto";
import { MALE_PHOTO_POOL, FEMALE_PHOTO_POOL, shufflePool, getImageUrl } from "./photoPools";

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
  { id: 1, name: "Sophie", age: 28, gender: "female", bio: "Adventure seeker and coffee enthusiast. I'm usually hiking or finding a new hidden cafe.", isAI: true },
  { id: 2, name: "James", age: 31, gender: "male", bio: "Photographer by day, chef by night. Dry humor. I will absolutely judge your cutting technique.", isAI: true },
  { id: 3, name: "Emma", age: 24, gender: "female", bio: "Book lover and yoga instructor. If you have a favorite essay, I want to hear about it.", isAI: true },
  { id: 4, name: "Michael", age: 30, gender: "male", bio: "Music producer. Outdoors when I can, obsessed with sound design when I cannot.", isAI: true },
  { id: 5, name: "Olivia", age: 25, gender: "female", bio: "Travel blogger. Street food, local markets, and I will ask you too many questions.", isAI: true },
];

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProfile(id: number): Promise<Profile | undefined>;
  getProfiles(): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | undefined>;
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
  
  // Image pools with non-reuse tracking (using numeric indices now)
  public maleImagePool: number[];
  public femaleImagePool: number[];
  public usedMaleImageIds: Set<number>;
  public usedFemaleImageIds: Set<number>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.usedNames = new Set();
    this.usedBioHashes = new Set();
    
    // Initialize shuffled image pools (now arrays of numbers 0-99)
    this.maleImagePool = shufflePool(MALE_PHOTO_POOL);
    this.femaleImagePool = shufflePool(FEMALE_PHOTO_POOL);
    this.usedMaleImageIds = new Set();
    this.usedFemaleImageIds = new Set();
    
    this.currentId = {
      users: 1,
      profiles: INITIAL_PROFILES.length + 1,
      matches: 1,
      messages: 1,
    };

    // Initialize with mock profiles (with generated character specs and unique images)
    INITIAL_PROFILES.forEach((profile) => {
      const charSpec = generateMockCharacterSpec(profile.name, profile.bio, profile.age, profile.gender);
      const imageUrl = this.getUniqueImageUrl(profile.gender as 'male' | 'female');
      console.log(`[Image] Mock profile ${profile.id} (${profile.gender}): ${imageUrl}`);
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
  
  getUniqueImageUrl(gender: 'male' | 'female'): string {
    const isMale = gender === "male";
    const pool = isMale ? this.maleImagePool : this.femaleImagePool;
    const usedSet = isMale ? this.usedMaleImageIds : this.usedFemaleImageIds;
    
    // Find unused images
    const available = pool.filter(id => !usedSet.has(id));
    
    if (available.length === 0) {
      // Pool exhausted - reshuffle and reset
      console.log(`[Image] ${gender} pool EXHAUSTED. Reshuffling ${pool.length} images.`);
      if (isMale) {
        this.maleImagePool = shufflePool(MALE_PHOTO_POOL);
        this.usedMaleImageIds.clear();
      } else {
        this.femaleImagePool = shufflePool(FEMALE_PHOTO_POOL);
        this.usedFemaleImageIds.clear();
      }
      // Select first from reshuffled pool
      const newPool = isMale ? this.maleImagePool : this.femaleImagePool;
      const selected = newPool[0];
      usedSet.add(selected);
      return getImageUrl(gender, selected);
    }
    
    // Select random from available
    const selected = available[Math.floor(Math.random() * available.length)];
    usedSet.add(selected);
    console.log(`[Image] Selected ${gender}: index ${selected} (${available.length - 1} remaining)`);
    return getImageUrl(gender, selected);
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
      characterSpec: insertProfile.characterSpec ?? null
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
