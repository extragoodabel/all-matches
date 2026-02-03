import { type User, type InsertUser, type Profile, type Match, type Message, type InsertProfile, type InsertMatch, type InsertMessage } from "@shared/schema";
import crypto from "crypto";
import { 
  MEN_PORTRAIT_ASSETS, 
  WOMEN_PORTRAIT_ASSETS, 
  ANDROGYNOUS_PORTRAIT_ASSETS, 
  shuffleArray, 
  buildImageUrl,
  getAssetKey,
  type PortraitAsset 
} from "./portrait-library";

function generateMockCharacterSpec(name: string, bio: string, age: number, gender: string): string {
  const seed = crypto.createHash('md5').update(name + bio).digest('hex');
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const archetypes = [
    "Chaotic Art Kid", "Aspiring DJ", "Burned Out Grad Student", "Sweet Golden Retriever Energy",
    "Cynical but Funny", "Mysterious", "Hyper-Competent Techie", "Spiritual Nomad"
  ];
  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend"];
  const intelligenceTypes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical"];
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
    intelligence: intelligenceTypes[n(4) % intelligenceTypes.length],
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
  
  // Image pools with non-reuse tracking (PortraitAsset arrays)
  public maleImagePool: PortraitAsset[];
  public femaleImagePool: PortraitAsset[];
  public otherImagePool: PortraitAsset[];
  public usedMaleImageKeys: Set<string>;
  public usedFemaleImageKeys: Set<string>;
  public usedOtherImageKeys: Set<string>;
  // Track recently used (last 100) to prevent immediate repeats after exhaustion
  public recentMaleImageKeys: string[];
  public recentFemaleImageKeys: string[];
  public recentOtherImageKeys: string[];
  
  // Track rejected profiles (left swipes) per user
  public rejectedProfiles: Map<number, Set<number>>;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.matches = new Map();
    this.messages = new Map();
    this.usedNames = new Set();
    this.usedBioHashes = new Set();
    
    // Initialize shuffled image pools from curated library (PortraitAsset arrays)
    this.maleImagePool = shuffleArray([...MEN_PORTRAIT_ASSETS]);
    this.femaleImagePool = shuffleArray([...WOMEN_PORTRAIT_ASSETS]);
    this.otherImagePool = shuffleArray([...ANDROGYNOUS_PORTRAIT_ASSETS]);
    this.usedMaleImageKeys = new Set();
    this.usedFemaleImageKeys = new Set();
    this.usedOtherImageKeys = new Set();
    this.recentMaleImageKeys = [];
    this.recentFemaleImageKeys = [];
    this.recentOtherImageKeys = [];
    this.rejectedProfiles = new Map();
    
    this.currentId = {
      users: 1,
      profiles: INITIAL_PROFILES.length + 1,
      matches: 1,
      messages: 1,
    };

    // Initialize with mock profiles
    INITIAL_PROFILES.forEach((profile) => {
      const charSpec = generateMockCharacterSpec(profile.name, profile.bio, profile.age, profile.gender);
      const imageAsset = this.getUniqueImageAsset(profile.gender as 'male' | 'female');
      const imageUrl = buildImageUrl(imageAsset, profile.id);
      console.log(`[Image] Mock profile ${profile.id} (${profile.gender}): ${getAssetKey(imageAsset)}`);
      this.profiles.set(profile.id, {
        ...profile,
        imageUrl,
        characterSpec: charSpec
      });
      this.usedNames.add(profile.name.toLowerCase());
      this.usedBioHashes.add(this.hashBio(profile.bio));
    });
    
    console.log(`[Image] Pools initialized: ${this.maleImagePool.length} male, ${this.femaleImagePool.length} female, ${this.otherImagePool.length} other`);
  }
  
  getUniqueImageAsset(gender: 'male' | 'female' | 'other'): PortraitAsset {
    let pool: PortraitAsset[];
    let usedSet: Set<string>;
    let recentList: string[];
    let sourcePool: PortraitAsset[];
    
    if (gender === "male") {
      pool = this.maleImagePool;
      usedSet = this.usedMaleImageKeys;
      recentList = this.recentMaleImageKeys;
      sourcePool = MEN_PORTRAIT_ASSETS;
    } else if (gender === "female") {
      pool = this.femaleImagePool;
      usedSet = this.usedFemaleImageKeys;
      recentList = this.recentFemaleImageKeys;
      sourcePool = WOMEN_PORTRAIT_ASSETS;
    } else {
      pool = this.otherImagePool;
      usedSet = this.usedOtherImageKeys;
      recentList = this.recentOtherImageKeys;
      sourcePool = ANDROGYNOUS_PORTRAIT_ASSETS;
    }
    
    // Find unused images not in recent 100
    let available = pool.filter(asset => {
      const key = getAssetKey(asset);
      return !usedSet.has(key) && !recentList.includes(key);
    });
    
    if (available.length === 0) {
      // All images used, reshuffle but exclude recent 100
      console.log(`[Image] ${gender} pool EXHAUSTED. Reshuffling...`);
      const newPool = shuffleArray([...sourcePool]);
      if (gender === "male") {
        this.maleImagePool = newPool;
        this.usedMaleImageKeys.clear();
      } else if (gender === "female") {
        this.femaleImagePool = newPool;
        this.usedFemaleImageKeys.clear();
      } else {
        this.otherImagePool = newPool;
        this.usedOtherImageKeys.clear();
      }
      // Filter out recently used
      available = newPool.filter(asset => !recentList.includes(getAssetKey(asset)));
      if (available.length === 0) {
        // Even recent list is exhausted, just use any
        available = newPool;
        if (gender === "male") {
          this.recentMaleImageKeys = [];
        } else if (gender === "female") {
          this.recentFemaleImageKeys = [];
        } else {
          this.recentOtherImageKeys = [];
        }
      }
    }
    
    // Select random from available
    const selected = available[Math.floor(Math.random() * available.length)];
    const selectedKey = getAssetKey(selected);
    usedSet.add(selectedKey);
    
    // Track in recent list (keep last 100)
    recentList.push(selectedKey);
    if (recentList.length > 100) {
      recentList.shift();
    }
    
    console.log(`[Image] Selected ${gender}: ${selectedKey} (${available.length - 1} remaining)`);
    return selected;
  }
  
  // Legacy method for backward compatibility
  getUniqueImageId(gender: 'male' | 'female' | 'other'): string {
    const asset = this.getUniqueImageAsset(gender);
    return getAssetKey(asset);
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
    
    const rejectedSet = this.rejectedProfiles.get(userId) || new Set();
    
    return Array.from(this.profiles.values())
      .filter(p => !userMatches.includes(p.id) && !rejectedSet.has(p.id));
  }
  
  rejectProfile(userId: number, profileId: number): void {
    if (!this.rejectedProfiles.has(userId)) {
      this.rejectedProfiles.set(userId, new Set());
    }
    this.rejectedProfiles.get(userId)!.add(profileId);
    
    // Actually delete rejected profiles to free up bio/image slots
    const profile = this.profiles.get(profileId);
    if (profile) {
      // Remove bio hash so similar bios can be generated again
      const hash = this.hashBio(profile.bio);
      this.usedBioHashes.delete(hash);
      
      // Remove name so it can be reused
      this.usedNames.delete(profile.name.toLowerCase());
      
      // Delete the profile
      this.profiles.delete(profileId);
      console.log(`[Storage] Deleted rejected profile ${profileId} (${profile.name}), freed bio hash`);
    }
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
