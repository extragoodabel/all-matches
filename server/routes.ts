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

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[0];
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
// Persona expansion
// We generate MANY personas by combining role + vibe + obsession,
// while also including specific hard-coded archetypes you requested.
// ------------------------------------------------------------
type PersonaTemplate = {
  label: string;
  interests: string[];
  quirkHints?: string[];
  flirtBias?: number;           // additive to flirtPercent
  chaosBias?: number;           // increases chance of chaos flag
  paranoidBucket?: boolean;     // counts toward the 10% combined cap
  valentinesBias?: boolean;     // nudges valentinesEager
};

const ROLE_ARCHETYPES: PersonaTemplate[] = [
  { label: "Sports Guy", interests: ["fantasy leagues", "stadium nachos", "arguing about refs"], flirtBias: 10 },
  { label: "Sports Girl", interests: ["WNBA hot takes", "tailgates", "jersey collecting"], flirtBias: 10 },
  { label: "Anti-Sports Person", interests: ["bookstores", "quiet restaurants", "not knowing who anyone is"], flirtBias: 0 },

  { label: "Animal Lover", interests: ["fostering pets", "pet costumes", "animal facts"], flirtBias: 10 },
  { label: "Lizard Person (Literal)", interests: ["gecko tanks", "heat lamps", "feeding crickets"], flirtBias: 5, chaosBias: 0.1 },
  { label: "Bird Watcher", interests: ["binoculars", "rare sightings", "bird call apps"], flirtBias: 5 },

  { label: "Keto and CrossFit", interests: ["macros", "PRs", "cold plunges"], flirtBias: 5 },
  { label: "Aggro Gym Rat", interests: ["preworkout", "lifting straps", "mirror selfies"], flirtBias: 15 },
  { label: "Aerobics Dance Goblin", interests: ["80s cardio", "sweatbands", "dance breaks"], flirtBias: 10, chaosBias: 0.15 },

  { label: "Geologist", interests: ["cool rocks", "fault lines", "national parks"], flirtBias: 5 },
  { label: "Architect", interests: ["weird buildings", "models", "design arguments"], flirtBias: 5 },
  { label: "Mechanic", interests: ["engine swaps", "tool organization", "fixing anything"], flirtBias: 10 },
  { label: "Pilot", interests: ["airport lounges", "cloud photos", "clean checklists"], flirtBias: 10 },
  { label: "Engineer", interests: ["over-optimizing", "spreadsheets", "problem solving"], flirtBias: 5 },

  { label: "Cop", interests: ["night shifts", "coffee", "true crime avoidance"], flirtBias: 0 },
  { label: "Soldier", interests: ["discipline", "boots", "structured routines"], flirtBias: 0 },

  { label: "Timid and Shy", interests: ["soft playlists", "quiet bars", "texts over calls"], flirtBias: -10 },
  { label: "Opera Singer", interests: ["rehearsals", "dramatic entrances", "applause"], flirtBias: 10 },
  { label: "Orchestra Musician", interests: ["practice rooms", "concert black fits", "nerding out"], flirtBias: 5 },

  { label: "Delusional Actor", interests: ["auditions", "self tapes", "being discovered"], flirtBias: 15, chaosBias: 0.2 },
  { label: "Historian", interests: ["archives", "long walks", "very specific opinions"], flirtBias: 0 },
  { label: "Linguist Who Corrects You", interests: ["syntax", "phonetics", "being right"], flirtBias: 0, chaosBias: 0.1 },

  { label: "Sloth Mode", interests: ["naps", "delivery apps", "soft clothes"], flirtBias: 0 },
  { label: "Greedy Great Gatsby Type", interests: ["status", "champagne", "exclusive invites"], flirtBias: 10, chaosBias: 0.1 },

  { label: "Religious", interests: ["Sunday routines", "values", "community events"], flirtBias: 0 },
  { label: "Punk", interests: ["shows", "patched jackets", "anti-establishment jokes"], flirtBias: 10, chaosBias: 0.1 },
  { label: "Goth", interests: ["black eyeliner", "graveyard walks", "dark playlists"], flirtBias: 10, chaosBias: 0.1 },
  { label: "Witchy", interests: ["tarot", "candles", "moon phases"], flirtBias: 10, chaosBias: 0.15 },

  { label: "Superhero Nerd", interests: ["comics", "lore debates", "collectibles"], flirtBias: 5 },
  { label: "Hustle Bro", interests: ["grindset quotes", "cold emails", "side hustles"], flirtBias: 10, chaosBias: 0.1 },
  { label: "Basic", interests: ["brunch", "espresso martinis", "group trips"], flirtBias: 10 },
  { label: "Boss", interests: ["boundaries", "wins", "not tolerating nonsense"], flirtBias: 10 },

  { label: "Comedian", interests: ["bits", "crowd work", "banter"], flirtBias: 15 },
  { label: "Art Film Lover", interests: ["A24 arguments", "slow cinema", "film festivals"], flirtBias: 5, chaosBias: 0.1 },

  { label: "Does Drag On Weekends", interests: ["stage looks", "lip syncs", "afterparties"], flirtBias: 15, chaosBias: 0.1 },
  { label: "Gardening Obsessed", interests: ["soil", "tomatoes", "propagating cuttings"], flirtBias: 5 },

  { label: "Fashionista", interests: ["runway clips", "thrifting", "fit checks"], flirtBias: 10 },
  { label: "Designer", interests: ["typefaces", "moodboards", "color fights"], flirtBias: 5 },

  { label: "Chronically Unemployed", interests: ["daytime errands", "big plans", "mysterious income"], flirtBias: 5, chaosBias: 0.2 },
  { label: "Serial Dater", interests: ["first date spots", "exit strategies", "banter"], flirtBias: 15, chaosBias: 0.1 },
  { label: "Playboy or Playgirl", interests: ["flirting", "late nights", "being a problem"], flirtBias: 20, chaosBias: 0.15 },

  // Required: hypochondriac
  { label: "Hypochondriac", interests: ["symptom checking", "vitamins", "air purifiers"], flirtBias: 0, chaosBias: 0.1 },

  // Required: fish guy
  { label: "Fish Holding Boat Guy", interests: ["boats", "holding fish", "bigger fish"], flirtBias: 10, chaosBias: 0.1 },

  // Whimsical paranoia bucket (cap combined around 10%)
  { label: "Whimsical Conspiracy Theorist", interests: ["string boards", "vibes-based evidence", "mysterious coincidences"], chaosBias: 0.35, paranoidBucket: true },
  { label: "Suspicious Doomsday Prep (Cute)", interests: ["flashlights", "go-bags", "emergency snacks"], chaosBias: 0.25, paranoidBucket: true },
];

const JOB_ROLES = [
  "Newscaster", "Beat Reporter", "Teacher", "Gym Teacher", "Construction Worker",
  "Day Trader", "Drop Shipper", "Rancher", "Oil Tycoon", "Beef Tycoon",
  "College Professor", "Bartender", "Nurse", "Paramedic", "Yoga Instructor",
  "Chef", "Pastry Chef", "Tattoo Artist", "Firefighter", "Public Defender",
  "Real Estate Agent", "Flight Attendant", "Museum Docent", "Librarian",
  "Wedding Planner", "Event Producer", "Accountant", "Therapist", "Plumber",
  "Electrician", "Sound Engineer", "Set Designer", "Stunt Performer", "Park Ranger",
  "Biologist", "Chemist", "Data Analyst", "Product Manager", "Sales Closer",
  "Car Salesperson", "Sommelier", "Coffee Roaster", "Local Politician",
  "City Planner", "Translator", "Interpreter", "UX Researcher",
  "Disgraced Tech Founder", "30 Under 30 To Prison Pipeline",
];

const WEIRD_OBSESSIONS = [
  "rollerblading", "kombucha brewing", "urban foraging", "competitive karaoke",
  "ant farms", "handwriting analysis", "perfume sampling", "mushroom IDs",
  "maps", "train schedules", "airport codes", "microplastics rants",
  "facial hair grooming", "mustache wax", "collecting keychains",
  "unreasonably specific ramen opinions", "making spreadsheets for fun",
  "whale facts", "volcano documentaries", "weather radar",
  "haunted hotels", "escape rooms", "lockpicking (legal, hobby)",
  "tiny spoons", "architecture tours", "medieval history",
];

const VIBES = [
  "coquettish", "feral", "mysterious", "sweet", "menace-flirty",
  "golden retriever", "black cat", "chaotic good", "pseudo-intellectual",
  "sycophant (Bonfire of the Vanities)", "philosopher", "anarchist (cartoon)",
  "silly communist (jokes only)", "time traveler", "caveman", "nun (unhinged but harmless)",
];

function buildExpandedPersonaLibrary(): PersonaTemplate[] {
  const generated: PersonaTemplate[] = [];

  // Generate lots of combos to get variety without hand-writing 200 lines
  for (const job of JOB_ROLES) {
    const vibe = pick(VIBES);
    const obsession = pick(WEIRD_OBSESSIONS);

    generated.push({
      label: `${job} (${vibe})`,
      interests: [
        `${job.toLowerCase()} lore`,
        obsession,
        pick(["late-night texts", "first-date banter", "weird little treats", "people watching"])
      ],
      flirtBias: randInt(0, 12),
      chaosBias: chance(0.2) ? 0.1 : 0,
    });
  }

  // Add a few extra “anti” or “villain” flavors
  const extras: PersonaTemplate[] = [
    { label: "Organic Head", interests: ["farmers markets", "supplement stacks", "wild theories about seed oils"], chaosBias: 0.1, flirtBias: 5 },
    { label: "Vegan Evangelist (But Hot)", interests: ["vegan tasting menus", "animal rights", "calling you out (playfully)"], flirtBias: 10, chaosBias: 0.1 },
    { label: "Pseudo-Intellectual", interests: ["name-dropping authors", "debating definitions", "saying 'interesting' a lot"], flirtBias: 5, chaosBias: 0.15 },
    { label: "Hypocrite With Confidence", interests: ["rules for you", "exceptions for me", "still charming somehow"], flirtBias: 15, chaosBias: 0.15 },
    { label: "Sycophant Social Climber", interests: ["being seen", "networking", "VIP wristbands"], flirtBias: 10, chaosBias: 0.1 },
    { label: "Nun (Off-Duty)", interests: ["forbidden jokes", "wholesome chaos", "mysterious vows"], flirtBias: 5, chaosBias: 0.25 },
    { label: "Local Politician Seeking Side Quest", interests: ["handshakes", "damage control", "secrets"], flirtBias: 15, chaosBias: 0.15 },
  ];

  return [...ROLE_ARCHETYPES, ...generated, ...extras];
}

const EXPANDED_PERSONAS = buildExpandedPersonaLibrary();

// ------------------------------------------------------------
// Bio generation modes (expanded)
// Every character gets a bio. No "no intro at all" mode.
// ------------------------------------------------------------
const BIO_MODES = [
  { mode: "one_liner", weight: 12, desc: "Single punchy sentence, confident or mysterious" },
  { mode: "hot_takes", weight: 10, desc: "2-3 spicy opinions, punchy" },
  { mode: "micro_story", weight: 10, desc: "Tiny vivid scene like a movie moment" },
  { mode: "prompt_answers", weight: 12, desc: "Dating app prompt answers, natural tone" },
  { mode: "manifesto", weight: 6, desc: "Mini manifesto, intense but funny" },
  { mode: "requirements_list", weight: 7, desc: "Playful requirements but not mean" },
  { mode: "self_aware", weight: 10, desc: "Meta about dating apps and validation" },
  { mode: "sincere", weight: 10, desc: "Warm and genuine, wants connection" },
  { mode: "weird_flex", weight: 8, desc: "Odd accomplishment or strange brag" },
  { mode: "question", weight: 8, desc: "Ends with a question that sparks convo" },
  { mode: "scenario_invite", weight: 9, desc: "Invites you into a specific plan" },
  { mode: "red_flags_joke", weight: 8, desc: "Jokes about their own red flags" },
  { mode: "short_but_specific", weight: 10, desc: "2-3 short lines, dense specifics" },
];

function pickWeightedMode(): { mode: string; desc: string } {
  const total = BIO_MODES.reduce((sum, m) => sum + m.weight, 0);
  let r = Math.random() * total;
  for (const m of BIO_MODES) {
    r -= m.weight;
    if (r <= 0) return { mode: m.mode, desc: m.desc };
  }
  return { mode: BIO_MODES[0].mode, desc: BIO_MODES[0].desc };
}

function randomMugColor(): string {
  const colors = ["green", "orange", "black", "clear glass", "ceramic", "metal", "pink", "yellow", "white"];
  return pick(colors);
}

async function generateBioWithOpenAI(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
  flirtPercent: number;
  valentinesEager: boolean;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const modeInfo = pickWeightedMode();
  const valentinesLine = context.valentinesEager ? "They are actively looking for a Valentine's date (playful, not desperate)." : "No special holiday urgency.";

  const prompt = `Write a dating app bio for a FICTIONAL person (adult 21+, not a real person, not a celebrity).
Character:
- Name: ${context.name}
- Age: ${context.age} (must read 21+)
- Gender: ${context.gender}
- Archetype: ${context.archetypeLabel}
- Interests: ${context.interests.join(", ")}
- Quirk: ${context.quirk}
- Flirt intensity: ${context.flirtPercent}/100
- Valentine's urgency: ${valentinesLine}

Bio style: ${modeInfo.mode.replace(/_/g, " ")} - ${modeInfo.desc}

RULES:
- 1-5 lines max
- Make it feel like a real dating profile, not marketing copy
- Do NOT start with: "I'm a", "Usually found", "Secret talent"
- Do NOT use labels like "Interests:" or "About me:"
- 0-3 emojis max
- Include 2-4 specific details woven naturally
- Avoid repetitive templates and obvious structures
- Avoid copycat clichés unless it is intentionally funny
- Output ONLY the bio text, no quotes, no explanation`;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 170,
      temperature: 0.95,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("OpenAI bio generation failed:", error);
    return null;
  }
}

function generateFallbackBio(interests: string[], quirk: string): string {
  const templates = [
    `I get weird about ${pick(interests)}. ${quirk}`,
    `Two truths: ${pick(interests)} matters. ${pick(interests)} matters more. ${quirk}`,
    `If you bring opinions about ${pick(interests)}, I will respect you. ${quirk}`,
    `I will absolutely talk your ear off about ${pick(interests)}. ${quirk}`,
    `Come with me: ${pick(interests)} and then ${pick(interests)}. ${quirk}`,
  ];
  return pick(templates);
}

async function generateUniqueBio(context: {
  name: string;
  age: number;
  gender: string;
  archetypeLabel: string;
  interests: string[];
  quirk: string;
  flirtPercent: number;
  valentinesEager: boolean;
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
  const fallback = generateFallbackBio(context.interests, context.quirk);
  storage.usedBioHashes.add(hashBio(fallback));
  return fallback;
}

// ------------------------------------------------------------
// Character spec generation (now includes flirtPercent, flirtStyle, valentinesEager, chaos flags)
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

  const goals = ["flirt", "relationship", "validation", "debate", "chaos", "sincere", "making a friend", "vibes only"];
  const intelligenceVibes = ["academic", "street smart", "ditzy", "intense", "witty", "philosophical", "creative", "chill"];
  const moralityFlavors = ["kind", "neutral", "messy", "blunt", "slightly toxic", "overly honest", "wholesome", "chaotic good"];
  const attachmentStyles = ["secure", "anxious", "avoidant", "chaotic", "unknown"];
  const conflictStyles = ["direct", "avoidant", "joking", "stonewalling", "diplomatic"];
  const humorTypes = ["dry", "absurdist", "roast", "dad-jokes", "sardonic", "chaotic", "wholesome"];
  const energyLevels = ["low", "medium", "high", "unhinged"];

  const stylePool = [
    { emojis: "frequent", punctuation: "loose", slang: "high", caps: "minimal", length: "short" },
    { emojis: "rare", punctuation: "perfect", slang: "low", caps: "proper", length: "moderate" },
    { emojis: "moderate", punctuation: "none", slang: "moderate", caps: "lowercase", length: "punchy" },
    { emojis: "frequent", punctuation: "excessive!!!", slang: "internet speak", caps: "all caps for emphasis", length: "varied" },
    { emojis: "occasional", punctuation: "minimal", slang: "gen-z", caps: "no caps ever", length: "short bursts" },
    { emojis: "none", punctuation: "proper", slang: "none", caps: "normal", length: "thoughtful" }
  ];

  const bits = [
    "teasing the user relentlessly",
    "asking weird would-you-rather questions",
    "using overly dramatic metaphors",
    "sending one-word replies then a long follow-up",
    "constantly referencing a secret project",
    "predicting the user's future",
    "correcting the user's grammar as a joke",
    "describing imaginary voice notes",
    "making everything into a competition",
    "dropping random facts",
    "being suspiciously specific about niche topics",
    "using a signature catchphrase",
    "referencing obscure movies nobody knows",
    "replying in questions",
    "being mysteriously vague",
  ];

  const chaosTypes = [
    "cartoon villain energy",
    "main character syndrome",
    "harmless conspiracy brain",
    "time traveler logic",
    "dramatic opera monologue",
    "prophecy speaker",
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
const PROFILE_GEN_BATCH_SIZE = 12;      // smaller batch to keep UI feeling fast
const PROFILE_LOW_THRESHOLD = 15;

// Track if background generation is already running
let isGeneratingProfiles = false;

// Chaos tuning
const CHAOS_OVERALL_RATE = 0.30;        // ~30% chaos overall
const PARANOID_BUCKET_CAP = 0.10;       // combined paranoid/suspicious/doomsday around 10%

function generateFlirtPercent(): number {
  // Majority over 50%
  const roll = Math.random();
  if (roll < 0.70) return randInt(55, 95);
  if (roll < 0.90) return randInt(35, 55);
  return randInt(10, 35);
}

function pickFlirtStyle(flirtPercent: number): string {
  const high = flirtPercent >= 70;
  const mid = flirtPercent >= 50;

  const stylesHigh = ["coquettish", "horny", "feral", "menace-flirty", "playful"];
  const stylesMid = ["playful", "coquettish", "bold", "teasing"];
  const stylesLow = ["shy", "awkward", "friendly", "guarded"];

  if (high) return pick(stylesHigh);
  if (mid) return pick(stylesMid);
  return pick(stylesLow);
}

function pickPersonaWithCaps(): PersonaTemplate {
  // Keep paranoidBucket around cap by limiting selection probability
  const paranoid = EXPANDED_PERSONAS.filter(p => p.paranoidBucket);
  const normal = EXPANDED_PERSONAS.filter(p => !p.paranoidBucket);

  // Select paranoid only with capped chance
  if (chance(PARANOID_BUCKET_CAP) && paranoid.length > 0) return pick(paranoid);
  return pick(normal);
}

function pickQuirk(): string {
  const mugColor = randomMugColor();
  
  // Regular quirks (common)
  const commonQuirks = [
    "I make playlists for every mood.",
    "I name all my houseplants.",
    "I have opinions about font kerning.",
    "I've memorized way too many movie quotes.",
    "I'm weirdly good at naming pets.",
    "I'm a semi-pro at GeoGuessr.",
    "I still have a flip phone for the aesthetic.",
    "I can't eat pizza without ranch.",
    "I sleep with a fan on, even in winter.",
    "I've never seen Star Wars. Be gentle.",
    "I have a notes app full of first-date ideas.",
    "I will absolutely judge your grocery cart (lovingly).",
    "I keep emergency snacks in every bag I own.",
    "I take selfies like it's a hostage situation.",
    "I have a very intense opinion about fonts and will not apologize.",
  ];
  
  // Rare quirks (~3% each)
  const rareQuirks = [
    `I only drink coffee from one specific ${mugColor} mug. No exceptions.`,
    "I collect tiny spoons like it's an Olympic sport.",
  ];

  // 3% chance for each rare quirk
  if (chance(0.03)) return rareQuirks[0]; // mug
  if (chance(0.03)) return rareQuirks[1]; // spoons
  
  return pick(commonQuirks);
}

// Background profile generation
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

    // Generate profiles in parallel batches of 5
    const batchSize = 5;
    for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, count);
      const batchPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push((async () => {
          const persona = pickPersonaWithCaps();
          const age = generateAge(minAge, maxAge);

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

          const firstNames = gender === "male" ? maleFirstNames : gender === "female" ? femaleFirstNames : otherFirstNames;
          const name = generateUniqueName(firstNames, lastInitials);

          const flirtBase = generateFlirtPercent();
          const flirtPercent = clamp(flirtBase + (persona.flirtBias || 0), 0, 100);
          const flirtStyle = pickFlirtStyle(flirtPercent);

          const valentinesEager = chance(0.10) || Boolean(persona.valentinesBias);

          // Chaos selection
          const chaosChance = clamp(CHAOS_OVERALL_RATE + (persona.chaosBias || 0), 0, 0.85);
          const isChaos = chance(chaosChance);

          const quirk = pickQuirk();

          // Fish guy needs stronger quirk and interests
          const finalQuirk = persona.label === "Fish Holding Boat Guy"
            ? "If I am not holding a fish, assume I am about to be holding a fish."
            : quirk;

          const interests = persona.label === "Fish Holding Boat Guy"
            ? ["holding fish", "boats", "holding fish on boats", "telling you it was THIS big"]
            : persona.interests;

          const bio = await generateUniqueBio({
            name,
            age,
            gender,
            archetypeLabel: persona.label,
            interests,
            quirk: finalQuirk,
            flirtPercent,
            valentinesEager,
          });

          const charSpec = generateCharacterSpec({
            name,
            age,
            gender,
            archetypeLabel: persona.label,
            interests,
            quirk: finalQuirk,
            flirtPercent,
            flirtStyle,
            valentinesEager,
            isChaos,
          });

          const nextProfileId = storage["currentId"].profiles + i;
          const imageId = storage.getUniqueImageId(gender as "male" | "female" | "other");
          const imageUrl = buildImageUrl(imageId, nextProfileId);

          const profile = await storage.createProfile({
            name,
            age,
            bio,
            gender,
            imageUrl,
            isAI: true,
            characterSpec: charSpec,
          });

          console.log(`[BG Gen] Created profile ${i + 1}/${count}: ${name} (${gender}, ${age}) -> ${persona.label}`);
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

    console.log(`[Profiles] Request start - gender=${genderPref}, age=${minAge}-${maxAge}`);

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

      console.log(`[GET /api/matches/by-id/${matchId}] Success - match.id=${match.id}, profile.id=${profile.id}, profile.name=${profile.name}`);
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
      console.log(`[GET /api/matches/${userId}] Returning ${matches.length} matches: [${matches.map(m => `{id:${m.id},profileId:${m.profileId}}`).join(", ")}]`);
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
      console.log(`[Resolver] ID ${incomingId} resolved as matchId -> match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }

    match = matches.find(m => m.profileId === incomingId);
    if (match) {
      console.log(`[Resolver] ID ${incomingId} resolved as profileId -> match.id=${match.id}, profileId=${match.profileId}`);
      return { match, matchId: match.id };
    }

    console.log(`[Resolver] ID ${incomingId} could not be resolved to any match`);
    return null;
  }

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const incoming = parseInt(req.params.id);
      if (isNaN(incoming)) return res.status(400).json({ error: "Invalid id" });

      console.log(`[GET /api/messages/${incoming}] Resolving ID...`);
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
      console.log(`[POST /api/messages] Incoming matchId: ${message.matchId}, content: "${message.content.substring(0, 30)}..."`);

      const resolved = await resolveMatchId(message.matchId);
      if (!resolved) {
        console.log(`[POST /api/messages] Match not found for id=${message.matchId}`);
        return res.status(404).json({ error: "Match not found" });
      }

      console.log(`[POST /api/messages] Resolved to matchId=${resolved.matchId}`);

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

      console.log(`[Admin] Returning ${allImages.length} unique images (${MEN_PORTRAIT_IDS.length} male, ${WOMEN_PORTRAIT_IDS.length} female, ${ANDROGYNOUS_PORTRAIT_IDS.length} other)`);
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
        console.log("\nBROKEN - Remove from all arrays:");
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
