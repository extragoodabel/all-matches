// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema, type Match } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { buildImageUrl, MEN_PORTRAIT_IDS, WOMEN_PORTRAIT_IDS, ANDROGYNOUS_PORTRAIT_IDS } from "./portrait-library";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function chance(p: number): boolean {
  return Math.random() < p;
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// ------------------------------------------------------------
// Age distribution
// ------------------------------------------------------------
const AGE_DISTRIBUTION = [
  { min: 21, max: 24, weight: 30 },
  { min: 25, max: 29, weight: 28 },
  { min: 30, max: 34, weight: 18 },
  { min: 35, max: 39, weight: 10 },
  { min: 40, max: 49, weight: 7 },
  { min: 50, max: 64, weight: 4 },
  { min: 65, max: 79, weight: 2 },
  { min: 80, max: 89, weight: 0.8 },
  { min: 90, max: 99, weight: 0.2 },
];

function generateAge(userMinAge: number = 21, userMaxAge: number = 99): number {
  const validBrackets = AGE_DISTRIBUTION
    .map(bracket => ({
      min: Math.max(bracket.min, userMinAge),
      max: Math.min(bracket.max, userMaxAge),
      weight: bracket.weight,
    }))
    .filter(b => b.min <= b.max);

  if (validBrackets.length === 0) return Math.floor((userMinAge + userMaxAge) / 2);

  const totalWeight = validBrackets.reduce((sum, b) => sum + b.weight, 0);
  let random = Math.random() * totalWeight;

  for (const bracket of validBrackets) {
    random -= bracket.weight;
    if (random <= 0) {
      return bracket.min + Math.floor(Math.random() * (bracket.max - bracket.min + 1));
    }
  }

  const lastBracket = validBrackets[validBrackets.length - 1];
  return lastBracket.min + Math.floor(Math.random() * (lastBracket.max - lastBracket.min + 1));
}

// ------------------------------------------------------------
// Name + Bio hashing
// ------------------------------------------------------------
function hashBio(bio: string): string {
  let hash = 0;
  for (let i = 0; i < bio.length; i++) {
    const char = bio.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function generateUniqueName(firstNames: string[], lastInitials: string[]): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const first = pick(firstNames);
    const initial = pick(lastInitials);
    const candidate = Math.random() < 0.55 ? first : `${first} ${initial}.`;
    if (!storage.usedNames.has(candidate.toLowerCase())) {
      storage.usedNames.add(candidate.toLowerCase());
      return candidate;
    }
  }
  const fallback = `${pick(firstNames)} ${pick(lastInitials)}.${Math.floor(Math.random() * 99) + 1}`;
  storage.usedNames.add(fallback.toLowerCase());
  return fallback;
}

// ------------------------------------------------------------
// Trait frequency control
// Goal: with 100+ traits, no single trait should exceed ~2%
// We enforce a rolling cap over a window of recent profiles.
// ------------------------------------------------------------
const TRAIT_WINDOW = 500;
const TRAIT_CAP = 0.02;

const recentTraits: string[] = [];
const traitCounts = new Map<string, number>();

function recordTrait(trait: string) {
  recentTraits.push(trait);
  traitCounts.set(trait, (traitCounts.get(trait) || 0) + 1);

  if (recentTraits.length > TRAIT_WINDOW) {
    const removed = recentTraits.shift();
    if (removed) {
      const c = (traitCounts.get(removed) || 1) - 1;
      if (c <= 0) traitCounts.delete(removed);
      else traitCounts.set(removed, c);
    }
  }
}

function traitAllowed(trait: string): boolean {
  const total = Math.max(1, recentTraits.length);
  const c = traitCounts.get(trait) || 0;
  return (c / total) < TRAIT_CAP;
}

function pickTraitWithCap(traits: PersonaTemplate[]): PersonaTemplate {
  // Try multiple times to satisfy cap. If not possible, return random.
  for (let i = 0; i < 50; i++) {
    const t = pick(traits);
    if (traitAllowed(t.label)) return t;
  }
  return pick(traits);
}

// ------------------------------------------------------------
// Persona templates (single primary trait only)
// No stacking "rollerblading caveman tarot reader" style combos.
// ------------------------------------------------------------
type PersonaTemplate = {
  label: string;
  interests: string[];         // keep to 1-2 used in bio, not a list of 5
  flirtBias?: number;          // additive to flirtPercent
  chaosBias?: number;          // small chance only
  quirkHint?: string;          // optional
};

const PRIMARY_TRAITS: PersonaTemplate[] = [
  { label: "Caveman", interests: ["meat sticks", "going for walks"], flirtBias: 6, chaosBias: 0.03, quirkHint: "I communicate primarily in vibes and gestures." },
  { label: "Fish Holding Boat Guy", interests: ["boats", "holding fish"], flirtBias: 10, chaosBias: 0.02, quirkHint: "If I am not holding a fish, assume I am about to be holding a fish." },
  { label: "Hypochondriac", interests: ["vitamins", "air purifiers"], flirtBias: -5, chaosBias: 0.02, quirkHint: "I have WebMD open, but I am trying to grow." },

  { label: "Sports Guy", interests: ["fantasy leagues", "stadium nachos"], flirtBias: 10 },
  { label: "Sports Girl", interests: ["WNBA takes", "tailgates"], flirtBias: 10 },
  { label: "Anti Sports Person", interests: ["bookstores", "quiet restaurants"], flirtBias: 0 },

  { label: "Comedian", interests: ["bits", "banter"], flirtBias: 15 },
  { label: "Art Film Lover", interests: ["film festivals", "arguing about movies"], flirtBias: 5 },

  { label: "Punk", interests: ["shows", "patched jackets"], flirtBias: 10, chaosBias: 0.03 },
  { label: "Goth", interests: ["dark playlists", "late night walks"], flirtBias: 10, chaosBias: 0.03 },
  { label: "Witchy", interests: ["tarot", "candles"], flirtBias: 10, chaosBias: 0.04 },

  { label: "Bird Watcher", interests: ["binoculars", "rare sightings"], flirtBias: 4 },
  { label: "Animal Lover", interests: ["fostering pets", "animal facts"], flirtBias: 8 },

  { label: "Chef", interests: ["food spots", "hosting"], flirtBias: 8 },
  { label: "Bartender", interests: ["nightlife", "people watching"], flirtBias: 10 },
  { label: "Nurse", interests: ["comfort shows", "daytime naps"], flirtBias: 4 },
  { label: "Teacher", interests: ["weekend resets", "coffee"], flirtBias: 4 },

  { label: "Architect", interests: ["weird buildings", "design arguments"], flirtBias: 5 },
  { label: "Engineer", interests: ["over optimizing", "problem solving"], flirtBias: 3 },
  { label: "Mechanic", interests: ["fixing anything", "tool organization"], flirtBias: 7 },
  { label: "Pilot", interests: ["airport lounges", "cloud photos"], flirtBias: 8 },

  { label: "Timid and Shy", interests: ["soft playlists", "texts over calls"], flirtBias: -10 },
  { label: "Serial Dater", interests: ["first date spots", "banter"], flirtBias: 15, chaosBias: 0.03 },
  { label: "Hopeless Romantic", interests: ["romcoms", "cute dates"], flirtBias: 10 },

  { label: "Gym Rat", interests: ["lifting", "protein snacks"], flirtBias: 12 },
  { label: "Keto and CrossFit", interests: ["macros", "PRs"], flirtBias: 6 },

  { label: "Gardening Person", interests: ["tomatoes", "propagating cuttings"], flirtBias: 3 },
  { label: "Vintage Camera Person", interests: ["film photos", "thrifting"], flirtBias: 6 },

  { label: "History Nerd", interests: ["museums", "long walks"], flirtBias: 2 },
  { label: "Linguist", interests: ["words", "being right"], flirtBias: 0, chaosBias: 0.02 },

  { label: "Basic (But Fun)", interests: ["brunch", "group trips"], flirtBias: 10 },
  { label: "Boss Energy", interests: ["boundaries", "wins"], flirtBias: 10 },

  { label: "Chronically Unemployed", interests: ["daytime errands", "big plans"], flirtBias: 6, chaosBias: 0.03 },
  { label: "Hustle Bro", interests: ["side hustles", "cold emails"], flirtBias: 8, chaosBias: 0.02 },

  // Add volume to exceed 100+ distinct traits
  // Keep these grounded and single trait labels
  ...Array.from({ length: 120 }).map((_, idx) => {
    const n = idx + 1;
    const labels = [
      "Coffee Snob", "Museum Person", "Runner", "Hiker", "Beach Person", "City Planner",
      "Accountant", "Therapist", "Tattoo Artist", "UX Researcher", "Data Analyst",
      "Product Manager", "Set Designer", "Sound Engineer", "Flight Attendant",
      "Librarian", "Park Ranger", "Biologist", "Chemist", "Translator",
      "Real Estate Agent", "Sommelier", "Coffee Roaster", "Wedding Planner",
      "Event Producer", "Pastry Chef", "Yoga Instructor", "Firefighter",
      "Public Defender", "Plumber", "Electrician", "Stunt Performer",
      "Geologist", "Orchestra Musician", "Opera Singer", "Fashionista", "Designer"
    ];
    const l = labels[idx % labels.length];
    const interestsByLabel: Record<string, string[]> = {
      "Coffee Snob": ["espresso", "walking to coffee"],
      "Museum Person": ["museums", "weekend plans"],
      "Runner": ["running", "podcasts"],
      "Hiker": ["hikes", "views"],
      "Beach Person": ["sun", "snacks"],
      "City Planner": ["neighborhoods", "walkability"],
      "Accountant": ["budgets", "treats"],
      "Therapist": ["communication", "soft honesty"],
      "Tattoo Artist": ["art", "late nights"],
      "UX Researcher": ["people watching", "why we do things"],
      "Data Analyst": ["patterns", "little charts"],
      "Product Manager": ["planning", "decision making"],
      "Set Designer": ["visuals", "making things"],
      "Sound Engineer": ["music", "tiny details"],
      "Flight Attendant": ["travel", "people stories"],
      "Librarian": ["books", "quiet"],
      "Park Ranger": ["parks", "animals"],
      "Biologist": ["nature facts", "walks"],
      "Chemist": ["experiments", "coffee"],
      "Translator": ["languages", "travel"],
      "Real Estate Agent": ["neighborhoods", "architecture"],
      "Sommelier": ["wine", "snacks"],
      "Coffee Roaster": ["coffee", "smells"],
      "Wedding Planner": ["events", "logistics"],
      "Event Producer": ["events", "energy"],
      "Pastry Chef": ["dessert", "coffee"],
      "Yoga Instructor": ["stretching", "calm"],
      "Firefighter": ["shift life", "food"],
      "Public Defender": ["opinions", "justice"],
      "Plumber": ["fixing stuff", "being useful"],
      "Electrician": ["solving problems", "tools"],
      "Stunt Performer": ["adrenaline", "movies"],
      "Geologist": ["rocks", "national parks"],
      "Orchestra Musician": ["music", "practice"],
      "Opera Singer": ["music", "drama"],
      "Fashionista": ["fits", "thrifting"],
      "Designer": ["type", "color"],
    };
    return {
      label: `${l} ${n}`,
      interests: interestsByLabel[l] || ["weekend plans", "food spots"],
      flirtBias: randInt(0, 10),
      chaosBias: 0.01
    } as PersonaTemplate;
  })
];

// ------------------------------------------------------------
// Bio generation (grounded, max 4 lines)
// 5% mention what they are looking for or why they are on the app.
// ------------------------------------------------------------
const LOOKING_FOR_LINES = [
  "Let’s try this out.",
  "I caved, sigh.",
  "Looking for my knight in shining Reeboks.",
  "Here for something real, but fun.",
  "Not here for pen pals.",
  "If we laugh on the first date, we’re basically married.",
  "Looking for someone who can pick a spot and commit.",
  "Open to a slow burn, not a sprint.",
  "I’m here to meet someone I actually like.",
  "I am normal about this app. I swear.",
  "Looking for a plus one to real life.",
  "I want a crush that turns into plans.",
];

const BIO_DETAILS = [
  "two coffees before I’m human",
  "walks that turn into 90 minutes",
  "I will order dessert first if the vibe is right",
  "I keep a running list of date spots",
  "I’m picky about lighting in restaurants",
  "I will actually plan the itinerary",
  "I’m the friend who shows up early",
  "I take photos like it’s a documentary",
  "I can cook one meal extremely well",
  "I will steal a fry politely",
  "I’m competitive about games I pretend not to care about",
  "I own at least one outfit that’s just for errands",
];

function countEmojis(s: string): number {
  return (s.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
}

function isBadBio(text: string): boolean {
  const t = text.trim();
  if (!t) return true;

  // No em dashes
  if (t.includes("—")) return true;

  // Limit emojis
  if (countEmojis(t) > 2) return true;

  // Max 4 lines
  const lines = t.split("\n").filter(Boolean);
  if (lines.length > 4) return true;

  // Avoid obvious surreal phrases in bios
  const banned = [
    "mothership", "prophecy", "third eye", "the council",
    "summon", "destiny", "time traveler", "string board"
  ];
  const lower = t.toLowerCase();
  if (banned.some(b => lower.includes(b))) return true;

  return false;
}

// Bio lead priorities - what each persona leads with (not all traits)
const BIO_LEAD_TYPES = [
  "humor",      // lead with a joke or witty observation
  "vibe",       // lead with energy/mood/aesthetic
  "interest",   // lead with one specific passion
  "quirk",      // lead with something quirky about them
  "question",   // lead by asking or challenging the reader
  "confession", // lead with an admission or hot take
];

async function generateBioWithOpenAI(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string | null;
  flirtPercent: number;
  valentinesEager: boolean;
  lookingForLine?: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const targetLines = chance(0.35) ? 1 : chance(0.55) ? 2 : chance(0.80) ? 3 : 4;
  
  // Randomly pick 1 or 2 lead types to highlight
  const numHighlights = chance(0.5) ? 1 : 2;
  const shuffledLeads = [...BIO_LEAD_TYPES].sort(() => Math.random() - 0.5);
  const leadTypes = shuffledLeads.slice(0, numHighlights);
  
  // Pick just ONE interest to potentially mention (not all)
  const featuredInterest = pick(context.interests);

  // Build instruction for each lead type
  const getLeadInstruction = (lead: string): string => {
    switch (lead) {
      case "humor": return "something funny, a witty observation, or a joke";
      case "vibe": return "your energy, mood, or aesthetic";
      case "interest": return `your passion for: ${featuredInterest}`;
      case "quirk": return context.quirk ? `this quirk: ${context.quirk}` : "something unusual about yourself";
      case "question": return "a question or challenge to the reader";
      case "confession": return "an admission, hot take, or confession";
      default: return "something interesting about yourself";
    }
  };

  const leadInstruction = numHighlights === 1
    ? `Lead with ${getLeadInstruction(leadTypes[0])}.`
    : `Highlight TWO things: ${getLeadInstruction(leadTypes[0])} AND ${getLeadInstruction(leadTypes[1])}.`;

  const prompt = `Write a dating app bio for a FICTIONAL person (adult 21+).

LEAD PRIORITY: ${leadInstruction}

Character context (use sparingly, NOT all of this):
- Archetype hint: ${context.archetypeLabel}
- One interest: ${featuredInterest}
${context.quirk ? `- Quirk: ${context.quirk}` : ""}
- Flirt vibe: ${context.flirtPercent}/100 (PG-13)

${context.lookingForLine ? `Optional line about what they want:\n- ${context.lookingForLine}\n` : ""}

FORMAT:
- Exactly ${targetLines} line(s). Max 4 lines.
- 0-2 emojis max.
- Never use em dashes.

RULES:
- This is a TEASER, not a resume. Highlight only what's specified above.
- Do NOT list more than what's asked.
- Leave mystery for conversation.
- Grounded and human, not surreal.
- No labels like "Interests:" or "About me:"
- Do not start with: "I'm a", "Usually found", "Secret talent"

Output ONLY the bio text.`;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 110,
        temperature: 0.65,
        presence_penalty: 0.7,
        frequency_penalty: 0.6,
      });

      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      if (!isBadBio(text)) return text;
    }

    return null;
  } catch (error) {
    console.error("OpenAI bio generation failed:", error);
    return null;
  }
}

function generateFallbackBio(interests: string[], quirk: string | null, lookingForLine?: string | null): string {
  const i1 = interests[0] || "good food";
  const i2 = interests[1] || interests[0] || "weekend plans";
  const d = pick(BIO_DETAILS);

  const lines: string[] = [];

  const roll = Math.random();
  if (roll < 0.33) lines.push(`${i1}, ${i2}.`);
  else if (roll < 0.66) lines.push(`Into ${i1} and ${i2}.`);
  else lines.push(`Here for ${i1} and ${i2}.`);

  if (chance(0.75)) lines.push(`${d}.`);
  if (quirk && chance(0.45)) lines.push(quirk);

  if (lookingForLine) lines.push(lookingForLine);

  // Max 4 lines
  return lines.slice(0, 4).join("\n");
}

async function generateUniqueBio(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string | null;
  flirtPercent: number;
  valentinesEager: boolean;
  lookingForLine?: string | null;
}): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bio = await generateBioWithOpenAI(context);
    if (bio) {
      const h = hashBio(bio);
      if (!storage.usedBioHashes.has(h)) {
        storage.usedBioHashes.add(h);
        return bio;
      }
    }
  }

  const fallback = generateFallbackBio(context.interests, context.quirk, context.lookingForLine || null);
  storage.usedBioHashes.add(hashBio(fallback));
  return fallback;
}

// ------------------------------------------------------------
// Character spec generation
// ------------------------------------------------------------
function generateCharacterSpec(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
  flirtPercent: number;
  flirtStyle: string;
  valentinesEager: boolean;
  isChaos: boolean;
  chaosType?: string;
}): string {
  const seed = crypto.createHash("md5").update(context.name + context.archetypeLabel + context.quirk).digest("hex");
  const n = (i: number) => parseInt(seed.substring(i, i + 2), 16);

  const goals = ["flirt", "relationship", "validation", "debate", "sincere", "making a friend", "vibes only"];
  const intelligenceVibes = ["academic", "street smart", "chill", "witty", "creative", "philosophical"];
  const moralityFlavors = ["kind", "neutral", "blunt", "messy", "overly honest", "wholesome", "chaotic good"];
  const attachmentStyles = ["secure", "anxious", "avoidant", "unknown"];
  const conflictStyles = ["direct", "avoidant", "joking", "diplomatic"];
  const humorTypes = ["dry", "absurdist", "roast", "sardonic", "wholesome"];
  const energyLevels = ["low", "medium", "high"];

  const stylePool = [
    { emojis: "rare", punctuation: "normal", slang: "moderate", caps: "minimal", length: "short" },
    { emojis: "occasional", punctuation: "minimal", slang: "gen-z", caps: "no caps ever", length: "short bursts" },
    { emojis: "none", punctuation: "proper", slang: "low", caps: "normal", length: "thoughtful" },
    { emojis: "moderate", punctuation: "loose", slang: "high", caps: "minimal", length: "punchy" },
  ];

  const bits = [
    "teasing the user (lightly)",
    "asking a specific question",
    "being blunt in a funny way",
    "dropping one random fact sometimes",
    "turning things into a playful challenge",
  ];

  const chaosTypes = [
    "extra dramatic",
    "mildly unhinged",
    "main character energy",
    "romcom menace",
  ];

  const goal = goals[n(0) % goals.length];
  const intelligence = intelligenceVibes[n(2) % intelligenceVibes.length];
  const morality = moralityFlavors[n(4) % moralityFlavors.length];
  const style = stylePool[n(6) % stylePool.length];
  const signatureBits = [bits[n(8) % bits.length], bits[n(10) % bits.length]];

  const spec = {
    name: context.name,
    age: context.age,
    gender: context.gender,
    archetype: context.archetypeLabel,
    goal: context.isChaos ? "chaos" : goal,
    intelligence,
    morality,
    interests: context.interests,
    quirk: context.quirk,
    textingStyle: style,
    signatureBits,
    boundaries: "No explicit sexual content. Stay in character. Be engaging but not creepy.",

    attachmentStyle: attachmentStyles[n(12) % attachmentStyles.length],
    conflictStyle: conflictStyles[n(14) % conflictStyles.length],
    humorType: humorTypes[n(16) % humorTypes.length],
    energyLevel: energyLevels[n(18) % energyLevels.length],

    flirtPercent: context.flirtPercent,
    flirtStyle: context.flirtStyle,
    valentinesEager: context.valentinesEager,

    isChaos: context.isChaos,
    chaosType: context.isChaos ? (context.chaosType || chaosTypes[n(20) % chaosTypes.length]) : undefined,
  };

  return JSON.stringify(spec);
}

// ------------------------------------------------------------
// Profile generation config
// ------------------------------------------------------------
const PROFILE_BUFFER_TARGET = 45;
const PROFILE_GEN_BATCH_SIZE = 12;
const PROFILE_LOW_THRESHOLD = 15;

let isGeneratingProfiles = false;

// Tone down chaos
const CHAOS_OVERALL_RATE = 0.12;

// Flirt tuning
function generateFlirtPercent(): number {
  const roll = Math.random();
  if (roll < 0.70) return randInt(55, 95);
  if (roll < 0.90) return randInt(35, 55);
  return randInt(10, 35);
}

function pickFlirtStyle(flirtPercent: number): string {
  const high = flirtPercent >= 70;
  const mid = flirtPercent >= 50;

  const stylesHigh = ["coquettish", "bold", "teasing", "playful"];
  const stylesMid = ["playful", "coquettish", "teasing"];
  const stylesLow = ["shy", "awkward", "friendly", "guarded"];

  if (high) return pick(stylesHigh);
  if (mid) return pick(stylesMid);
  return pick(stylesLow);
}

// Quirk control: not every profile gets one
function pickQuirk(): string | null {
  // Only 35% of profiles get any quirk at all
  if (!chance(0.35)) return null;

  const mugColor = pick(["green", "orange", "black", "clear glass", "ceramic", "metal", "pink", "yellow", "white"]);
  const pool: { text: string; weight: number }[] = [
    { text: "I make playlists for every mood.", weight: 14 },
    { text: "I name all my houseplants.", weight: 12 },
    { text: "I have opinions about font kerning.", weight: 10 },
    { text: "I've memorized way too many movie quotes.", weight: 10 },
    { text: "I'm a semi-pro at GeoGuessr.", weight: 8 },
    { text: "I still have a flip phone for the aesthetic.", weight: 6 },
    { text: "I can't eat pizza without ranch.", weight: 10 },
    { text: "I sleep with a fan on, even in winter.", weight: 10 },
    { text: "I've never seen Star Wars. Be gentle.", weight: 8 },
    { text: "I have a notes app full of first-date ideas.", weight: 8 },
    { text: "I keep emergency snacks in every bag I own.", weight: 8 },

    // Ultra rare specifics
    { text: `I only drink coffee from one specific ${mugColor} mug. No exceptions.`, weight: 0.35 },
    { text: "I collect tiny spoons like it's an Olympic sport.", weight: 0.20 },
    { text: "I'm weirdly good at naming pets.", weight: 0.20 },
    { text: "I am weirdly into maps.", weight: 0.18 },
  ];

  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item.text;
  }
  return pool[0].text;
}

// ------------------------------------------------------------
// Background profile generation
// ------------------------------------------------------------
async function generateProfilesInBackground(
  genderPref: string,
  minAge: number,
  maxAge: number,
  count: number
): Promise<void> {
  if (isGeneratingProfiles) {
    console.log(`[BG Gen] Already generating, skipping`);
    return;
  }

  isGeneratingProfiles = true;
  const startTime = Date.now();
  console.log(`[BG Gen] Starting background generation of ${count} profiles for gender=${genderPref}`);

  try {
    const maleFirstNames = [
      "Alex", "Jordan", "Taylor", "Casey", "Riley", "Quinn", "Skyler", "Peyton",
      "Dakota", "Reese", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
      "Jamie", "Sam", "Cameron", "Drew", "Kai", "Logan", "Noah", "Remy",
      "Evan", "Owen", "Miles", "Eli", "Theo", "Max", "Jonah", "Isaac", "Leo", "Caleb",
      "Marcus", "Derek", "Jason", "Tyler", "Ryan", "Kevin", "Brandon", "Justin"
    ];

    const femaleFirstNames = [
      "Morgan", "Avery", "Hayden", "Emerson", "Sasha",
      "Leah", "Maya", "Nina", "Zoe", "Iris", "Lena", "Aria", "Jules", "Tessa", "Mina",
      "Sophie", "Emma", "Olivia", "Ava", "Isabella", "Mia", "Charlotte", "Amelia",
      "Harper", "Evelyn", "Luna", "Camila", "Gianna", "Penelope", "Riley", "Layla"
    ];

    const otherFirstNames = [
      "Alex", "Jordan", "Taylor", "Casey", "Riley", "Quinn", "Skyler", "Peyton",
      "Dakota", "Reese", "Parker", "Charlie", "Blake", "Sawyer", "Rowan", "Finley",
      "Jamie", "Sam", "Cameron", "Drew", "Kai", "Morgan", "Avery", "Hayden",
      "Emerson", "Sasha", "Jules", "Remy", "Phoenix", "River", "Sage", "Eden"
    ];

    const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    const batchSize = 5;
    for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push((async () => {
          const persona = pickTraitWithCap(PRIMARY_TRAITS);

          let gender: string;
          if (genderPref === "male") gender = "male";
          else if (genderPref === "female") gender = "female";
          else if (genderPref === "other") gender = "other";
          else {
            const r = Math.random();
            if (r < 0.4) gender = "male";
            else if (r < 0.8) gender = "female";
            else gender = "other";
          }

          const age = generateAge(minAge, maxAge);
          const firstNames = gender === "male" ? maleFirstNames : gender === "female" ? femaleFirstNames : otherFirstNames;
          const name = generateUniqueName(firstNames, lastInitials);

          // Record the primary trait after selection
          recordTrait(persona.label);

          const flirtBase = generateFlirtPercent();
          const flirtPercent = clamp(flirtBase + (persona.flirtBias || 0), 0, 100);
          const flirtStyle = pickFlirtStyle(flirtPercent);

          // Low chaos, and only if persona nudges it
          const chaosChance = clamp(CHAOS_OVERALL_RATE + (persona.chaosBias || 0), 0, 0.35);
          const isChaos = chance(chaosChance);

          // Looking for line in 5% of bios
          const lookingForLine = chance(0.05) ? pick(LOOKING_FOR_LINES) : null;

          // Interests: keep it simple, 2 max
          const interests = pickN(persona.interests, Math.min(2, persona.interests.length));

          // Quirk: optional
          const quirk = persona.quirkHint && chance(0.25) ? persona.quirkHint : pickQuirk();

          const bio = await generateUniqueBio({
            name,
            age,
            gender,
            archetypeLabel: persona.label,
            interests,
            quirk,
            flirtPercent,
            valentinesEager: false,
            lookingForLine,
          });

          const charSpec = generateCharacterSpec({
            name,
            age,
            gender,
            archetypeLabel: persona.label,
            interests,
            quirk: quirk || "No weird quirks. Just vibes.",
            flirtPercent,
            flirtStyle,
            valentinesEager: false,
            isChaos,
          });

          const imageId = storage.getUniqueImageId(gender as "male" | "female" | "other");

          // Create profile first so we have the real profile.id for the image URL
          const profile = await storage.createProfile({
            name,
            age,
            bio,
            gender,
            imageUrl: "",
            isAI: true,
            characterSpec: charSpec,
          });

          const imageUrl = buildImageUrl(imageId, profile.id);

          // Prefer an explicit storage update method if it exists
          if (typeof (storage as any).updateProfileImageUrl === "function") {
            await (storage as any).updateProfileImageUrl(profile.id, imageUrl);
          } else if (typeof (storage as any).updateProfile === "function") {
            await (storage as any).updateProfile(profile.id, { imageUrl });
          } else {
            // Fallback: mutate if storage returns live object references
            (profile as any).imageUrl = imageUrl;
          }

          console.log(`[BG Gen] Created profile: ${name} (${gender}, ${age}) trait=${persona.label}`);
          return profile;
        })());
      }

      await Promise.all(batchPromises);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[BG Gen] Completed ${count} profiles in ${elapsed}ms`);
  } catch (error) {
    console.error(`[BG Gen] Error:`, error);
  } finally {
    isGeneratingProfiles = false;
  }
}

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------
export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/profiles", async (req, res) => {
    const requestStart = Date.now();
    const userId = 1;

    const rawGender = (req.query.gender as string) || "all";
    const genderPref = ["male", "female", "other", "all"].includes(rawGender) ? rawGender : "all";
    const rawMinAge = parseInt(req.query.minAge as string) || 21;
    const rawMaxAge = parseInt(req.query.maxAge as string) || 99;
    const minAge = Math.max(21, Math.min(99, rawMinAge));
    const maxAge = Math.max(21, Math.min(99, rawMaxAge));

    console.log(`[Profiles] Request start gender=${genderPref}, age=${minAge}-${maxAge}`);

    const fetchStart = Date.now();
    let unseen = await storage.getUnseenProfiles(userId);
    console.log(`[Profiles] getUnseenProfiles took ${Date.now() - fetchStart}ms, found ${unseen.length}`);

    if (genderPref !== "all") unseen = unseen.filter(p => p.gender === genderPref);
    unseen = unseen.filter(p => p.age >= minAge && p.age <= maxAge);
    console.log(`[Profiles] After filtering: ${unseen.length} profiles`);

    if (unseen.length < PROFILE_LOW_THRESHOLD) {
      const needed = PROFILE_BUFFER_TARGET - unseen.length;
      const toGen = Math.max(0, Math.min(needed, PROFILE_GEN_BATCH_SIZE));
      console.log(`[Profiles] Low buffer (${unseen.length}), triggering background generation of ${toGen}`);
      if (toGen > 0) {
        generateProfilesInBackground(genderPref, minAge, maxAge, toGen)
          .catch(err => console.error("[BG Gen] Unhandled error:", err));
      }
    }

    const elapsed = Date.now() - requestStart;
    console.log(`[Profiles] Request completed in ${elapsed}ms, returning ${unseen.length} profiles`);

    res.json(shuffle(unseen));
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });

      const profile = await storage.getProfile(id);
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      res.json(profile);
    } catch {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/profiles/:id/bad-image", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid profile ID" });

      console.log(`[Bad Image] Profile ${id} reported as having broken image`);
      const deleted = await storage.deleteProfile(id);
      if (deleted) console.log(`[Bad Image] Profile ${id} deleted successfully`);

      res.json({ success: true });
    } catch (error) {
      console.error("[Bad Image] Error:", error);
      res.status(500).json({ error: "Failed to mark bad image" });
    }
  });

  app.post("/api/matches", async (req, res) => {
    try {
      console.log(`[POST /api/matches] Incoming body:`, req.body);
      const match = insertMatchSchema.parse(req.body);
      const createdMatch = await storage.createMatch(match);
      console.log(`[POST /api/matches] Created match.id=${createdMatch.id}, userId=${createdMatch.userId}, profileId=${createdMatch.profileId}`);
      res.json(createdMatch);
    } catch (error) {
      console.error("[POST /api/matches] Error:", error);
      res.status(400).json({ error: "Invalid match data" });
    }
  });

  app.post("/api/reject", async (req, res) => {
    try {
      const { userId, profileId } = req.body;
      if (!userId || !profileId) return res.status(400).json({ error: "Missing userId or profileId" });
      storage.rejectProfile(userId, profileId);
      res.json({ success: true });
    } catch (error) {
      console.error("[POST /api/reject] Error:", error);
      res.status(400).json({ error: "Failed to reject profile" });
    }
  });

  app.get("/api/matches/by-id/:matchId", async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      if (isNaN(matchId)) {
        console.log(`[GET /api/matches/by-id/${req.params.matchId}] Invalid matchId`);
        return res.status(400).json({ error: "Invalid match ID" });
      }

      const allMatches = await storage.getMatches(1);
      const match = allMatches.find(m => m.id === matchId);

      if (!match) {
        console.log(`[GET /api/matches/by-id/${matchId}] Match NOT found. Available matches: [${allMatches.map(m => m.id).join(", ")}]`);
        return res.status(404).json({ error: "Match not found" });
      }

      const profile = await storage.getProfile(match.profileId);
      if (!profile) {
        console.log(`[GET /api/matches/by-id/${matchId}] Match found but profile ${match.profileId} NOT found`);
        return res.status(404).json({ error: "Profile not found" });
      }

      console.log(`[GET /api/matches/by-id/${matchId}] Success match.id=${match.id}, profile.id=${profile.id}, profile.name=${profile.name}`);
      res.json({ match, profile });
    } catch (error) {
      console.error("[GET /api/matches/by-id] Error:", error);
      res.status(500).json({ error: "Failed to fetch match" });
    }
  });

  app.get("/api/matches/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const matches = await storage.getMatches(userId);
      console.log(`[GET /api/matches/${userId}] Returning ${matches.length} matches`);
      res.json(matches);
    } catch (error) {
      console.error("[GET /api/matches] Error:", error);
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

  app.get("/api/inbox/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });

      const matches = await storage.getMatches(userId);

      const inboxItems = await Promise.all(
        matches.map(async (match) => {
          const profile = await storage.getProfile(match.profileId);
          const messages = await storage.getMessages(match.id);
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

          return {
            matchId: match.id,
            profileId: match.profileId,
            createdAt: match.createdAt,
            profile: profile ? {
              name: profile.name,
              age: profile.age,
              imageUrl: profile.imageUrl,
            } : null,
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              isAI: lastMessage.isAI,
              createdAt: lastMessage.createdAt,
            } : null,
          };
        })
      );

      inboxItems.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.createdAt;
        const bTime = b.lastMessage?.createdAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      res.json(inboxItems);
    } catch (error) {
      console.error("Inbox error:", error);
      res.status(500).json({ error: "Failed to fetch inbox" });
    }
  });

  async function resolveMatchId(incomingId: number, userId: number = 1): Promise<{ match: Match; matchId: number } | null> {
    const matches = await storage.getMatches(userId);

    let match = matches.find(m => m.id === incomingId);
    if (match) {
      console.log(`[Resolver] ID ${incomingId} resolved as matchId match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }

    match = matches.find(m => m.profileId === incomingId);
    if (match) {
      console.log(`[Resolver] ID ${incomingId} resolved as profileId match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }

    console.log(`[Resolver] ID ${incomingId} could not be resolved to any match`);
    return null;
  }

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const incoming = parseInt(req.params.id);
      if (isNaN(incoming)) return res.status(400).json({ error: "Invalid id" });

      console.log(`[GET /api/messages/${incoming}] Resolving ID`);
      const resolved = await resolveMatchId(incoming);

      if (!resolved) {
        console.log(`[GET /api/messages/${incoming}] No match found, returning empty array`);
        return res.json([]);
      }

      const messages = await storage.getMessages(resolved.matchId);
      console.log(`[GET /api/messages/${incoming}] Found ${messages.length} messages for matchId=${resolved.matchId}`);
      res.json(messages);
    } catch (error) {
      console.error("[GET /api/messages] Error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      console.log(`[POST /api/messages] Incoming matchId: ${message.matchId}`);

      const resolved = await resolveMatchId(message.matchId);
      if (!resolved) {
        console.log(`[POST /api/messages] Match not found for id=${message.matchId}`);
        return res.status(404).json({ error: "Match not found" });
      }

      const createdMessage = await storage.createMessage({
        ...message,
        matchId: resolved.matchId
      });

      if (!message.isAI) {
        const match = resolved.match;
        const profile = await storage.getProfile(match.profileId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const currentMessages = await storage.getMessages(resolved.matchId);

        generateAIResponse(
          {
            profileName: profile.name,
            profileBio: profile.bio,
            characterSpec: profile.characterSpec,
            messageHistory: currentMessages.map((m) => ({
              content: m.content,
              isAI: m.isAI,
            })),
          },
          message.content
        )
          .then(async (aiResponse) => {
            try {
              await new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
              await new Promise((r) => setTimeout(r, aiResponse.typingDelay));

              await storage.createMessage({
                matchId: resolved.matchId,
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

  // Admin image tagging stays the same
  app.get("/api/admin/images", async (_req, res) => {
    try {
      const allImages: { id: string; gender: "male" | "female" | "other" }[] = [];
      const seen = new Set<string>();

      for (const id of MEN_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "male" });
          seen.add(id);
        }
      }
      for (const id of WOMEN_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "female" });
          seen.add(id);
        }
      }
      for (const id of ANDROGYNOUS_PORTRAIT_IDS) {
        if (!seen.has(id)) {
          allImages.push({ id, gender: "other" });
          seen.add(id);
        }
      }

      console.log(`[Admin] Returning ${allImages.length} unique images`);
      res.json(allImages);
    } catch (error) {
      console.error("[Admin] Error fetching images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  app.post("/api/admin/images/tags", async (req, res) => {
    try {
      const { tags } = req.body as { tags: Record<string, "male" | "female" | "other" | "broken"> };

      const changes = {
        toMale: [] as string[],
        toFemale: [] as string[],
        toOther: [] as string[],
        broken: [] as string[],
      };

      for (const [id, newTag] of Object.entries(tags)) {
        if (newTag === "male") changes.toMale.push(id);
        else if (newTag === "female") changes.toFemale.push(id);
        else if (newTag === "other") changes.toOther.push(id);
        else if (newTag === "broken") changes.broken.push(id);
      }

      console.log("[Admin] Image tag changes:", {
        toMale: changes.toMale.length,
        toFemale: changes.toFemale.length,
        toOther: changes.toOther.length,
        broken: changes.broken.length,
      });

      console.log("\n=== COPY THESE CHANGES TO portrait-library.ts ===");
      if (changes.toMale.length > 0) {
        console.log("\nMove to MEN_PORTRAIT_IDS:");
        changes.toMale.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.toFemale.length > 0) {
        console.log("\nMove to WOMEN_PORTRAIT_IDS:");
        changes.toFemale.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.toOther.length > 0) {
        console.log("\nRemove from both arrays (other/ambiguous):");
        changes.toOther.forEach(id => console.log(`  "${id}",`));
      }
      if (changes.broken.length > 0) {
        console.log("\nBROKEN remove from all arrays:");
        changes.broken.forEach(id => console.log(`  "${id}",`));
      }
      console.log("\n=== END CHANGES ===\n");

      res.json({
        success: true,
        message: "Changes logged to console. Update portrait-library.ts manually.",
        changes
      });
    } catch (error) {
      console.error("[Admin] Error saving tags:", error);
      res.status(500).json({ error: "Failed to save tags" });
    }
  });

  const httpServer = createServer(app);

  // Pre-generate profiles at startup so users do not wait
  console.log(`[Startup] Triggering initial profile generation of ${PROFILE_GEN_BATCH_SIZE} profiles`);
  generateProfilesInBackground("all", 21, 99, PROFILE_GEN_BATCH_SIZE)
    .catch(err => console.error("[Startup Gen] Error:", err));

  return httpServer;
}
