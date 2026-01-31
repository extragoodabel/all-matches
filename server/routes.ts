// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse } from "./openai";
import { insertMatchSchema, insertMessageSchema, type Match } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";
import { 
  buildImageUrl, 
  MEN_PORTRAIT_IDS, 
  WOMEN_PORTRAIT_IDS, 
  ANDROGYNOUS_PORTRAIT_IDS,
  MEN_PORTRAIT_ASSETS,
  WOMEN_PORTRAIT_ASSETS,
  ANDROGYNOUS_PORTRAIT_ASSETS,
  getAssetKey,
  type PortraitAsset
} from "./portrait-library";
import { BURST_MEN, BURST_WOMEN, BURST_OTHER } from "./burst-library";

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

// ------------------------------------------------------------
// Topic Rate Limiting - HARD LIMITS on overused topics
// ------------------------------------------------------------
interface TopicLimit {
  pattern: RegExp;
  maxRatio: number; // 1/N - e.g., 50 means 1 in 50 profiles can mention this
  count: number;
}

const TOPIC_LIMITS: Record<string, TopicLimit> = {
  pizza: { pattern: /pizza|🍕/i, maxRatio: 50, count: 0 },
  ranch_pizza: { pattern: /ranch.{0,20}pizza|pizza.{0,20}ranch/i, maxRatio: 150, count: 0 },
  pineapple_pizza: { pattern: /pineapple.{0,20}pizza|pizza.{0,20}pineapple/i, maxRatio: 150, count: 0 },
  three_five_stars: { pattern: /3\.5\s*star|three\s*and\s*a\s*half\s*star/i, maxRatio: 200, count: 0 },
  kerning: { pattern: /kerning/i, maxRatio: 200, count: 0 },
  coffee: { pattern: /coffee/i, maxRatio: 20, count: 0 },
  playlist: { pattern: /playlist/i, maxRatio: 30, count: 0 },
  geoguessr: { pattern: /geoguessr/i, maxRatio: 200, count: 0 },
  star_wars: { pattern: /star\s*wars/i, maxRatio: 100, count: 0 },
  plant_parent: { pattern: /plant\s*(parent|mom|dad)|houseplant/i, maxRatio: 50, count: 0 },
  naming_plants: { pattern: /nam(e|ing|ed).{0,15}plant/i, maxRatio: 50, count: 0 },
  fan_sleeping: { pattern: /fan.{0,20}(sleep|winter|on at night)|sleep.{0,20}fan/i, maxRatio: 300, count: 0 },
  princess_bride: { pattern: /princess\s*bride|inconceivable|as you wish/i, maxRatio: 100, count: 0 },
  dog: { pattern: /\bdog(s|go)?\b|\bpup(py|pies|s)?\b|\bcanine/i, maxRatio: 25, count: 0 },
  cat: { pattern: /\bcat(s)?\b|\bkitt(y|ies|en)/i, maxRatio: 40, count: 0 },
  fur_baby: { pattern: /fur\s*bab(y|ies)/i, maxRatio: 50, count: 0 },
  date_ideas_notes: { pattern: /date\s*(idea|spot|list).{0,15}note|notes?\s*app.{0,15}date/i, maxRatio: 200, count: 0 },
  fonts: { pattern: /\bfont(s)?\b|typography|typeface/i, maxRatio: 100, count: 0 },
  snacks: { pattern: /\bsnack(s|ing)?\b/i, maxRatio: 50, count: 0 },
  politics: { pattern: /politic(s|al)|democrat|republican|liberal|conservative|vote|voting|election/i, maxRatio: 50, count: 0 },
  flashlight: { pattern: /flashlight/i, maxRatio: 200, count: 0 },
  google: { pattern: /googl(e|ing|ed)/i, maxRatio: 75, count: 0 },
  deadlines: { pattern: /deadline/i, maxRatio: 100, count: 0 },
  spreadsheets: { pattern: /spreadsheet|excel|google\s*sheet/i, maxRatio: 100, count: 0 },
  flip_phone: { pattern: /flip\s*phone/i, maxRatio: 100, count: 0 },
  movie_quotes: { pattern: /you can't handle|i'll be back|here's looking at you|frankly.*don't give|may the force|life is like a box|you talking to me|i see dead people|show me the money|houston.*problem|bond.*james bond|i'm gonna make.*offer|there's no place like|we're gonna need a bigger|say hello to my|you had me at|nobody puts baby|i feel the need|to infinity and beyond|why so serious|i am your father/i, maxRatio: 20, count: 0 },
};

let totalProfilesGenerated = 0;

function isTopicAllowed(topicKey: string): boolean {
  const limit = TOPIC_LIMITS[topicKey];
  if (!limit) return true;
  
  // Calculate max allowed for current profile count
  const maxAllowed = Math.floor(totalProfilesGenerated / limit.maxRatio);
  return limit.count < maxAllowed + 1; // Allow one more if we're at the edge
}

function checkBioForBannedTopics(bio: string): string | null {
  // Check more specific patterns first (ranch_pizza, pineapple_pizza before pizza, fur_baby before dog/cat)
  const ordered = [
    'ranch_pizza', 'pineapple_pizza', 'pizza', 
    'three_five_stars',
    'kerning', 'fonts',
    'coffee', 'playlist', 'geoguessr', 'star_wars', 
    'plant_parent', 'naming_plants',
    'fan_sleeping', 'princess_bride',
    'fur_baby', 'dog', 'cat',
    'date_ideas_notes', 'snacks', 'politics', 'flashlight', 'google',
    'deadlines', 'spreadsheets', 'flip_phone', 'movie_quotes'
  ];
  
  for (const key of ordered) {
    const limit = TOPIC_LIMITS[key];
    if (limit.pattern.test(bio)) {
      if (!isTopicAllowed(key)) {
        return key;
      }
    }
  }
  return null;
}

function registerTopicsInBio(bio: string): void {
  // Check specific patterns first (more specific before general)
  if (TOPIC_LIMITS.ranch_pizza.pattern.test(bio)) TOPIC_LIMITS.ranch_pizza.count++;
  if (TOPIC_LIMITS.pineapple_pizza.pattern.test(bio)) TOPIC_LIMITS.pineapple_pizza.count++;
  // Only count general pizza if not already counted as ranch/pineapple
  if (TOPIC_LIMITS.pizza.pattern.test(bio) && 
      !TOPIC_LIMITS.ranch_pizza.pattern.test(bio) && 
      !TOPIC_LIMITS.pineapple_pizza.pattern.test(bio)) {
    TOPIC_LIMITS.pizza.count++;
  }
  
  // Standard topics
  if (TOPIC_LIMITS.kerning.pattern.test(bio)) TOPIC_LIMITS.kerning.count++;
  if (TOPIC_LIMITS.fonts.pattern.test(bio)) TOPIC_LIMITS.fonts.count++;
  if (TOPIC_LIMITS.coffee.pattern.test(bio)) TOPIC_LIMITS.coffee.count++;
  if (TOPIC_LIMITS.playlist.pattern.test(bio)) TOPIC_LIMITS.playlist.count++;
  if (TOPIC_LIMITS.geoguessr.pattern.test(bio)) TOPIC_LIMITS.geoguessr.count++;
  if (TOPIC_LIMITS.star_wars.pattern.test(bio)) TOPIC_LIMITS.star_wars.count++;
  if (TOPIC_LIMITS.plant_parent.pattern.test(bio)) TOPIC_LIMITS.plant_parent.count++;
  if (TOPIC_LIMITS.naming_plants.pattern.test(bio)) TOPIC_LIMITS.naming_plants.count++;
  if (TOPIC_LIMITS.fan_sleeping.pattern.test(bio)) TOPIC_LIMITS.fan_sleeping.count++;
  if (TOPIC_LIMITS.princess_bride.pattern.test(bio)) TOPIC_LIMITS.princess_bride.count++;
  
  // Pets: fur_baby counted separately, dog/cat are general
  if (TOPIC_LIMITS.fur_baby.pattern.test(bio)) TOPIC_LIMITS.fur_baby.count++;
  if (TOPIC_LIMITS.dog.pattern.test(bio)) TOPIC_LIMITS.dog.count++;
  if (TOPIC_LIMITS.cat.pattern.test(bio)) TOPIC_LIMITS.cat.count++;
  
  // Other topics
  if (TOPIC_LIMITS.date_ideas_notes.pattern.test(bio)) TOPIC_LIMITS.date_ideas_notes.count++;
  if (TOPIC_LIMITS.snacks.pattern.test(bio)) TOPIC_LIMITS.snacks.count++;
  if (TOPIC_LIMITS.politics.pattern.test(bio)) TOPIC_LIMITS.politics.count++;
  if (TOPIC_LIMITS.flashlight.pattern.test(bio)) TOPIC_LIMITS.flashlight.count++;
  if (TOPIC_LIMITS.google.pattern.test(bio)) TOPIC_LIMITS.google.count++;
  if (TOPIC_LIMITS.three_five_stars.pattern.test(bio)) TOPIC_LIMITS.three_five_stars.count++;
  if (TOPIC_LIMITS.deadlines.pattern.test(bio)) TOPIC_LIMITS.deadlines.count++;
  if (TOPIC_LIMITS.spreadsheets.pattern.test(bio)) TOPIC_LIMITS.spreadsheets.count++;
  if (TOPIC_LIMITS.flip_phone.pattern.test(bio)) TOPIC_LIMITS.flip_phone.count++;
  if (TOPIC_LIMITS.movie_quotes.pattern.test(bio)) TOPIC_LIMITS.movie_quotes.count++;
  
  totalProfilesGenerated++;
}

function getBannedTopicsForPrompt(): string[] {
  const banned: string[] = [];
  if (!isTopicAllowed('pizza')) banned.push('pizza');
  if (!isTopicAllowed('ranch_pizza')) banned.push('ranch on pizza');
  if (!isTopicAllowed('pineapple_pizza')) banned.push('pineapple on pizza');
  if (!isTopicAllowed('kerning')) banned.push('kerning');
  if (!isTopicAllowed('fonts')) banned.push('fonts', 'typography', 'typefaces');
  if (!isTopicAllowed('coffee')) banned.push('coffee');
  if (!isTopicAllowed('playlist')) banned.push('playlists');
  if (!isTopicAllowed('geoguessr')) banned.push('GeoGuessr');
  if (!isTopicAllowed('star_wars')) banned.push('Star Wars');
  if (!isTopicAllowed('plant_parent')) banned.push('houseplants', 'plant parent');
  if (!isTopicAllowed('naming_plants')) banned.push('naming plants');
  if (!isTopicAllowed('fan_sleeping')) banned.push('sleeping with fan on', 'fan at night');
  if (!isTopicAllowed('princess_bride')) banned.push('Princess Bride', 'inconceivable', 'as you wish');
  if (!isTopicAllowed('dog')) banned.push('dogs', 'puppies');
  if (!isTopicAllowed('cat')) banned.push('cats', 'kittens');
  if (!isTopicAllowed('fur_baby')) banned.push('fur baby', 'fur babies');
  if (!isTopicAllowed('date_ideas_notes')) banned.push('date ideas in notes app', 'date spots list');
  if (!isTopicAllowed('snacks')) banned.push('snacks', 'snacking');
  if (!isTopicAllowed('politics')) banned.push('politics', 'voting', 'elections');
  if (!isTopicAllowed('flashlight')) banned.push('flashlight');
  if (!isTopicAllowed('google')) banned.push('googling', 'Google search');
  if (!isTopicAllowed('three_five_stars')) banned.push('3.5 stars', 'star ratings');
  if (!isTopicAllowed('deadlines')) banned.push('deadlines');
  if (!isTopicAllowed('spreadsheets')) banned.push('spreadsheets', 'Excel');
  if (!isTopicAllowed('flip_phone')) banned.push('flip phone');
  if (!isTopicAllowed('movie_quotes')) banned.push('movie quotes', 'famous movie lines');
  return banned;
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

  // Expanded library - 100+ truly unique personas
  { label: "Coffee Snob", interests: ["espresso", "coffee walks"], flirtBias: 5 },
  { label: "Museum Person", interests: ["exhibits", "weekend wandering"], flirtBias: 4 },
  { label: "Runner", interests: ["running", "podcasts"], flirtBias: 6 },
  { label: "Hiker", interests: ["trails", "views"], flirtBias: 7 },
  { label: "Beach Person", interests: ["sun", "ocean sounds"], flirtBias: 8 },
  { label: "City Planner", interests: ["neighborhoods", "walkability"], flirtBias: 3 },
  { label: "Accountant", interests: ["spreadsheets", "small treats"], flirtBias: 4 },
  { label: "Therapist", interests: ["communication", "boundaries"], flirtBias: 5 },
  { label: "Tattoo Artist", interests: ["art", "late nights"], flirtBias: 9 },
  { label: "UX Researcher", interests: ["people watching", "asking why"], flirtBias: 4 },
  { label: "Data Analyst", interests: ["patterns", "charts"], flirtBias: 3 },
  { label: "Product Manager", interests: ["planning", "roadmaps"], flirtBias: 5 },
  { label: "Set Designer", interests: ["visuals", "making things"], flirtBias: 6 },
  { label: "Sound Engineer", interests: ["music", "tiny details"], flirtBias: 5 },
  { label: "Flight Attendant", interests: ["travel", "people stories"], flirtBias: 8 },
  { label: "Librarian", interests: ["books", "quiet spaces"], flirtBias: 4 },
  { label: "Park Ranger", interests: ["parks", "wildlife"], flirtBias: 6 },
  { label: "Biologist", interests: ["nature facts", "field work"], flirtBias: 4 },
  { label: "Chemist", interests: ["experiments", "lab life"], flirtBias: 3 },
  { label: "Translator", interests: ["languages", "travel"], flirtBias: 5 },
  { label: "Real Estate Agent", interests: ["neighborhoods", "open houses"], flirtBias: 7 },
  { label: "Sommelier", interests: ["wine", "pairings"], flirtBias: 8 },
  { label: "Coffee Roaster", interests: ["beans", "mornings"], flirtBias: 5 },
  { label: "Wedding Planner", interests: ["events", "details"], flirtBias: 7 },
  { label: "Event Producer", interests: ["parties", "logistics"], flirtBias: 8 },
  { label: "Pastry Chef", interests: ["baking", "desserts"], flirtBias: 7 },
  { label: "Yoga Instructor", interests: ["stretching", "calm mornings"], flirtBias: 6 },
  { label: "Firefighter", interests: ["shift life", "cooking for the crew"], flirtBias: 9 },
  { label: "Public Defender", interests: ["justice", "strong opinions"], flirtBias: 5 },
  { label: "Plumber", interests: ["fixing things", "problem solving"], flirtBias: 6 },
  { label: "Electrician", interests: ["wiring", "tools"], flirtBias: 6 },
  { label: "Stunt Performer", interests: ["adrenaline", "action movies"], flirtBias: 10 },
  { label: "Geologist", interests: ["rocks", "national parks"], flirtBias: 4 },
  { label: "Orchestra Musician", interests: ["practice", "performances"], flirtBias: 5 },
  { label: "Opera Singer", interests: ["rehearsals", "dramatic moments"], flirtBias: 7 },
  { label: "Fashionista", interests: ["outfits", "thrifting"], flirtBias: 8 },
  { label: "Graphic Designer", interests: ["typography", "colors"], flirtBias: 5 },
  { label: "Veterinarian", interests: ["animals", "clinic stories"], flirtBias: 6 },
  { label: "Dentist", interests: ["dental facts", "weekend golf"], flirtBias: 4 },
  { label: "Pharmacist", interests: ["wellness", "advice giving"], flirtBias: 4 },
  { label: "DJ", interests: ["sets", "nightlife"], flirtBias: 10 },
  { label: "Podcast Host", interests: ["conversations", "hot takes"], flirtBias: 7 },
  { label: "Journalist", interests: ["stories", "asking questions"], flirtBias: 6 },
  { label: "Photographer", interests: ["lighting", "moments"], flirtBias: 7 },
  { label: "Sculptor", interests: ["clay", "installations"], flirtBias: 5 },
  { label: "Painter", interests: ["studios", "colors"], flirtBias: 6 },
  { label: "Novelist", interests: ["writing", "coffee shops"], flirtBias: 4 },
  { label: "Screenwriter", interests: ["scripts", "movie nights"], flirtBias: 6 },
  { label: "Stand-up Comic", interests: ["open mics", "people watching"], flirtBias: 9 },
  { label: "Improv Person", interests: ["shows", "yes-and"], flirtBias: 8, chaosBias: 0.04 },
  { label: "Documentary Maker", interests: ["true stories", "interviews"], flirtBias: 5 },
  { label: "Animator", interests: ["drawing", "cartoons"], flirtBias: 5 },
  { label: "Game Developer", interests: ["games", "game nights"], flirtBias: 6 },
  { label: "Startup Founder", interests: ["ideas", "hustle"], flirtBias: 7, chaosBias: 0.02 },
  { label: "VC Person", interests: ["deals", "networking"], flirtBias: 6 },
  { label: "Consultant", interests: ["travel", "PowerPoints"], flirtBias: 5 },
  { label: "Lawyer", interests: ["arguments", "wine"], flirtBias: 6 },
  { label: "Judge", interests: ["fairness", "routine"], flirtBias: 3 },
  { label: "Politician", interests: ["policy", "shaking hands"], flirtBias: 5, chaosBias: 0.02 },
  { label: "Lobbyist", interests: ["dinners", "networking"], flirtBias: 6 },
  { label: "Activist", interests: ["causes", "organizing"], flirtBias: 7 },
  { label: "Social Worker", interests: ["helping", "boundaries"], flirtBias: 5 },
  { label: "Paramedic", interests: ["shift life", "adrenaline"], flirtBias: 7 },
  { label: "Surgeon", interests: ["precision", "early mornings"], flirtBias: 5 },
  { label: "Psychiatrist", interests: ["understanding people", "calm energy"], flirtBias: 5 },
  { label: "Physical Therapist", interests: ["movement", "helping people heal"], flirtBias: 6 },
  { label: "Personal Trainer", interests: ["workouts", "motivation"], flirtBias: 9 },
  { label: "Nutritionist", interests: ["food", "wellness"], flirtBias: 5 },
  { label: "Life Coach", interests: ["goals", "journaling"], flirtBias: 7, chaosBias: 0.02 },
  { label: "Astrologer", interests: ["charts", "vibes"], flirtBias: 8, chaosBias: 0.05 },
  { label: "Tarot Reader", interests: ["cards", "intuition"], flirtBias: 7, chaosBias: 0.05 },
  { label: "Meditation Teacher", interests: ["stillness", "retreats"], flirtBias: 5 },
  { label: "Sailor", interests: ["boats", "the ocean"], flirtBias: 8 },
  { label: "Rock Climber", interests: ["climbing", "outdoor trips"], flirtBias: 8 },
  { label: "Surfer", interests: ["waves", "beach life"], flirtBias: 9 },
  { label: "Skier", interests: ["mountains", "lodge vibes"], flirtBias: 7 },
  { label: "Snowboarder", interests: ["powder", "apres ski"], flirtBias: 8 },
  { label: "Cyclist", interests: ["rides", "gear"], flirtBias: 6 },
  { label: "Triathlete", interests: ["training", "race days"], flirtBias: 7 },
  { label: "Martial Artist", interests: ["practice", "discipline"], flirtBias: 7 },
  { label: "Boxer", interests: ["training", "focus"], flirtBias: 8 },
  { label: "Dancer", interests: ["movement", "music"], flirtBias: 9 },
  { label: "Ballet Dancer", interests: ["rehearsals", "discipline"], flirtBias: 6 },
  { label: "Ballroom Dancer", interests: ["dancing", "partner work"], flirtBias: 9 },
  { label: "Florist", interests: ["flowers", "arrangements"], flirtBias: 6 },
  { label: "Beekeeper", interests: ["bees", "honey"], flirtBias: 5, chaosBias: 0.02 },
  { label: "Farmer", interests: ["land", "early mornings"], flirtBias: 6 },
  { label: "Rancher", interests: ["animals", "wide open spaces"], flirtBias: 6 },
  { label: "Winemaker", interests: ["grapes", "tastings"], flirtBias: 8 },
  { label: "Brewer", interests: ["beer", "craft"], flirtBias: 7 },
  { label: "Distiller", interests: ["spirits", "tastings"], flirtBias: 7 },
  { label: "Baker", interests: ["bread", "early mornings"], flirtBias: 6 },
  { label: "Butcher", interests: ["meat", "craft"], flirtBias: 5 },
  { label: "Fisherman", interests: ["boats", "patience"], flirtBias: 6 },
  { label: "Woodworker", interests: ["making things", "sawdust"], flirtBias: 6 },
  { label: "Blacksmith", interests: ["fire", "metalwork"], flirtBias: 7, chaosBias: 0.02 },
  { label: "Jeweler", interests: ["gems", "detail work"], flirtBias: 6 },
  { label: "Watchmaker", interests: ["tiny parts", "precision"], flirtBias: 4 },
  { label: "Antique Dealer", interests: ["old things", "stories"], flirtBias: 5 },
  { label: "Collector", interests: ["finding things", "organizing"], flirtBias: 4 },
  { label: "Archivist", interests: ["history", "preservation"], flirtBias: 3 },
  { label: "Curator", interests: ["art", "exhibitions"], flirtBias: 5 },
  { label: "Art Critic", interests: ["opinions", "gallery openings"], flirtBias: 5, chaosBias: 0.02 },
  { label: "Food Critic", interests: ["restaurants", "strong opinions"], flirtBias: 6, chaosBias: 0.02 },
  { label: "Music Producer", interests: ["beats", "studio sessions"], flirtBias: 8 },
  { label: "Band Member", interests: ["practice", "shows"], flirtBias: 9 },
  { label: "Solo Artist", interests: ["songwriting", "performing"], flirtBias: 8 },
  { label: "Music Teacher", interests: ["lessons", "patience"], flirtBias: 5 },
  { label: "Voice Actor", interests: ["characters", "recording"], flirtBias: 7 },
  { label: "Theater Actor", interests: ["rehearsals", "opening nights"], flirtBias: 8 },
  { label: "Film Actor", interests: ["sets", "auditions"], flirtBias: 8 },
  { label: "Model", interests: ["shoots", "travel"], flirtBias: 9 },
  { label: "Makeup Artist", interests: ["looks", "transformations"], flirtBias: 7 },
  { label: "Hair Stylist", interests: ["cuts", "salon talk"], flirtBias: 8 },
  { label: "Esthetician", interests: ["skincare", "self-care"], flirtBias: 7 },
  { label: "Massage Therapist", interests: ["wellness", "helping people relax"], flirtBias: 7 },
  { label: "Acupuncturist", interests: ["healing", "energy"], flirtBias: 5 },
  { label: "Chiropractor", interests: ["adjustments", "wellness"], flirtBias: 6 },
  { label: "Optometrist", interests: ["eyes", "glasses shopping"], flirtBias: 4 },
  { label: "Audiologist", interests: ["hearing", "music"], flirtBias: 4 },
  { label: "Speech Therapist", interests: ["communication", "patience"], flirtBias: 5 },
  { label: "Occupational Therapist", interests: ["daily life", "helping people adapt"], flirtBias: 5 },
  { label: "School Counselor", interests: ["listening", "advice"], flirtBias: 5 },
  { label: "College Professor", interests: ["teaching", "research"], flirtBias: 4 },
  { label: "Grad Student", interests: ["studying", "coffee"], flirtBias: 5 },
  { label: "Research Scientist", interests: ["experiments", "papers"], flirtBias: 3 },
  { label: "Astronomer", interests: ["stars", "late nights"], flirtBias: 5 },
  { label: "Physicist", interests: ["equations", "big questions"], flirtBias: 3 },
  { label: "Mathematician", interests: ["proofs", "puzzles"], flirtBias: 2, chaosBias: 0.02 },
  { label: "Economist", interests: ["markets", "opinions"], flirtBias: 4 },
  { label: "Anthropologist", interests: ["cultures", "travel"], flirtBias: 5 },
  { label: "Archaeologist", interests: ["digs", "history"], flirtBias: 5 },
  { label: "Marine Biologist", interests: ["ocean", "field work"], flirtBias: 6 },
  { label: "Zoologist", interests: ["animals", "conservation"], flirtBias: 5 },
  { label: "Botanist", interests: ["plants", "greenhouses"], flirtBias: 4 },
  { label: "Ecologist", interests: ["ecosystems", "fieldwork"], flirtBias: 5 },
  { label: "Environmental Scientist", interests: ["climate", "outdoors"], flirtBias: 5 },
  { label: "Urban Farmer", interests: ["growing things", "community"], flirtBias: 6 },
  { label: "Food Truck Owner", interests: ["cooking", "hustle"], flirtBias: 7 },
  { label: "Restaurant Owner", interests: ["hospitality", "long hours"], flirtBias: 7 },
  { label: "Cafe Owner", interests: ["coffee", "regulars"], flirtBias: 6 },
  { label: "Bookstore Owner", interests: ["books", "quiet moments"], flirtBias: 5 },
  { label: "Gallery Owner", interests: ["art", "openings"], flirtBias: 6 },
  { label: "Boutique Owner", interests: ["fashion", "curation"], flirtBias: 7 },
  { label: "Record Store Person", interests: ["vinyl", "music knowledge"], flirtBias: 6 },
  { label: "Vintage Seller", interests: ["thrifting", "finds"], flirtBias: 6 },
  { label: "Interior Designer", interests: ["spaces", "color"], flirtBias: 7 },
  { label: "Landscape Architect", interests: ["outdoor spaces", "plants"], flirtBias: 5 },
  { label: "Industrial Designer", interests: ["products", "how things work"], flirtBias: 5 },
  { label: "Fashion Designer", interests: ["fabric", "runway"], flirtBias: 7 },
  { label: "Costume Designer", interests: ["theater", "period pieces"], flirtBias: 6 },
  { label: "Prop Maker", interests: ["crafting", "movies"], flirtBias: 6 },
  { label: "Special Effects Artist", interests: ["explosions", "movie magic"], flirtBias: 7 },
  { label: "Video Editor", interests: ["cuts", "deadlines"], flirtBias: 5 },
  { label: "Cinematographer", interests: ["lighting", "shots"], flirtBias: 6 },
  { label: "Director", interests: ["vision", "sets"], flirtBias: 7 },
  { label: "Casting Director", interests: ["people watching", "auditions"], flirtBias: 6 },
  { label: "Talent Agent", interests: ["networking", "deals"], flirtBias: 7 },
  { label: "Publicist", interests: ["press", "events"], flirtBias: 7 },
  { label: "Marketing Person", interests: ["campaigns", "trends"], flirtBias: 6 },
  { label: "Copywriter", interests: ["words", "deadlines"], flirtBias: 5 },
  { label: "Technical Writer", interests: ["explaining things", "clarity"], flirtBias: 3 },
  { label: "Grant Writer", interests: ["nonprofits", "funding"], flirtBias: 4 },
  { label: "Speechwriter", interests: ["words", "politicians"], flirtBias: 5 },
  { label: "Editor", interests: ["manuscripts", "grammar"], flirtBias: 4 },
  { label: "Publisher", interests: ["books", "launches"], flirtBias: 5 },
  { label: "Literary Agent", interests: ["manuscripts", "deals"], flirtBias: 6 },
  { label: "Bookseller", interests: ["recommendations", "quiet days"], flirtBias: 5 },
  { label: "Comic Book Artist", interests: ["panels", "stories"], flirtBias: 6 },
  { label: "Cartoonist", interests: ["drawing", "humor"], flirtBias: 6 },
  { label: "Illustrator", interests: ["visuals", "commissions"], flirtBias: 5 },
  { label: "Muralist", interests: ["big walls", "public art"], flirtBias: 7 },
  { label: "Street Artist", interests: ["city walks", "expression"], flirtBias: 8, chaosBias: 0.03 },
  { label: "Ceramicist", interests: ["clay", "kilns"], flirtBias: 5 },
  { label: "Glassblower", interests: ["fire", "shapes"], flirtBias: 6 },
  { label: "Weaver", interests: ["textiles", "patterns"], flirtBias: 4 },
  { label: "Quilter", interests: ["fabric", "patience"], flirtBias: 4 },
  { label: "Knitter", interests: ["yarn", "cozy things"], flirtBias: 4 },
  { label: "Leatherworker", interests: ["craft", "tools"], flirtBias: 5 },
  { label: "Shoemaker", interests: ["shoes", "craftsmanship"], flirtBias: 4 },
  { label: "Tailor", interests: ["fit", "details"], flirtBias: 5 },
  { label: "Seamstress", interests: ["sewing", "alterations"], flirtBias: 5 },
  { label: "Upholsterer", interests: ["furniture", "fabric"], flirtBias: 4 },
  { label: "Furniture Maker", interests: ["wood", "design"], flirtBias: 5 },
  { label: "Luthier", interests: ["instruments", "sound"], flirtBias: 5 },
  { label: "Piano Tuner", interests: ["music", "precision"], flirtBias: 3 },
  { label: "Vinyl Collector", interests: ["records", "crate digging"], flirtBias: 6 },
  { label: "Film Buff", interests: ["movies", "opinions"], flirtBias: 5 },
  { label: "True Crime Fan", interests: ["podcasts", "theories"], flirtBias: 5, chaosBias: 0.02 },
  { label: "Reality TV Fan", interests: ["drama", "hot takes"], flirtBias: 7 },
  { label: "Anime Fan", interests: ["shows", "conventions"], flirtBias: 6 },
  { label: "Gaming Streamer", interests: ["games", "chat"], flirtBias: 7 },
  { label: "Board Game Person", interests: ["game nights", "strategy"], flirtBias: 6 },
  { label: "Trivia Person", interests: ["facts", "bar trivia"], flirtBias: 6 },
  { label: "Crossword Person", interests: ["puzzles", "morning coffee"], flirtBias: 4 },
  { label: "Chess Player", interests: ["strategy", "focus"], flirtBias: 4 },
  { label: "Poker Player", interests: ["reading people", "stakes"], flirtBias: 8 },
  { label: "Sports Bettor", interests: ["games", "odds"], flirtBias: 7, chaosBias: 0.02 },
  { label: "Fantasy Sports Person", interests: ["stats", "trash talk"], flirtBias: 7 },
  { label: "Golf Person", interests: ["courses", "weekend rounds"], flirtBias: 5 },
  { label: "Tennis Player", interests: ["matches", "court time"], flirtBias: 6 },
  { label: "Pickleball Person", interests: ["games", "court banter"], flirtBias: 7 },
  { label: "Swimmer", interests: ["laps", "pool time"], flirtBias: 6 },
  { label: "Rower", interests: ["early mornings", "water"], flirtBias: 6 },
  { label: "Kayaker", interests: ["water", "adventure"], flirtBias: 7 },
  { label: "Scuba Diver", interests: ["ocean", "underwater worlds"], flirtBias: 7 },
  { label: "Skydiver", interests: ["jumping", "adrenaline"], flirtBias: 9, chaosBias: 0.03 },
  { label: "Backpacker", interests: ["travel", "hostels"], flirtBias: 7 },
  { label: "Road Tripper", interests: ["driving", "playlists"], flirtBias: 7 },
  { label: "Camper", interests: ["outdoors", "campfires"], flirtBias: 6 },
  { label: "Van Life Person", interests: ["freedom", "road"], flirtBias: 8, chaosBias: 0.02 },
  { label: "Tiny House Person", interests: ["minimalism", "design"], flirtBias: 5 },
  { label: "Minimalist", interests: ["less stuff", "intentionality"], flirtBias: 4 },
  { label: "Maximalist", interests: ["more is more", "collections"], flirtBias: 6, chaosBias: 0.02 },
  { label: "Plant Parent", interests: ["plants", "watering schedules"], flirtBias: 5 },
  { label: "Dog Person", interests: ["dogs", "walks"], flirtBias: 8 },
  { label: "Cat Person", interests: ["cats", "cozy nights"], flirtBias: 6 },
  { label: "Reptile Person", interests: ["reptiles", "unusual pets"], flirtBias: 5, chaosBias: 0.03 },
  { label: "Bird Person", interests: ["birds", "songs"], flirtBias: 5, chaosBias: 0.02 },
  { label: "Equestrian", interests: ["horses", "riding"], flirtBias: 6 },
  { label: "Home Cook", interests: ["recipes", "dinner parties"], flirtBias: 7 },
  { label: "Grill Master", interests: ["barbecue", "backyards"], flirtBias: 7 },
  { label: "Foodie", interests: ["restaurants", "new spots"], flirtBias: 7 },
  { label: "Picky Eater", interests: ["familiar foods", "specific preferences"], flirtBias: 4 },
  { label: "Health Nut", interests: ["wellness", "smoothies"], flirtBias: 6 },
  { label: "Night Owl", interests: ["late nights", "quiet hours"], flirtBias: 7 },
  { label: "Early Bird", interests: ["mornings", "sunrises"], flirtBias: 5 },
  { label: "Homebody", interests: ["staying in", "comfort"], flirtBias: 5 },
  { label: "Social Butterfly", interests: ["parties", "meeting people"], flirtBias: 9 },
  { label: "Introvert", interests: ["quiet time", "small groups"], flirtBias: 4 },
  { label: "Extrovert", interests: ["crowds", "energy"], flirtBias: 9 },
  { label: "Ambivert", interests: ["balance", "reading the room"], flirtBias: 6 },
  { label: "Old Soul", interests: ["classics", "nostalgia"], flirtBias: 5 },
  { label: "Free Spirit", interests: ["spontaneity", "adventure"], flirtBias: 8, chaosBias: 0.03 },
  { label: "Overthinker", interests: ["planning", "what-ifs"], flirtBias: 4 },
  { label: "Spontaneous Type", interests: ["last minute plans", "surprises"], flirtBias: 8 },
  { label: "Planner", interests: ["calendars", "itineraries"], flirtBias: 4 },
  { label: "Go-With-The-Flow", interests: ["vibes", "no agenda"], flirtBias: 7 },
  { label: "Workaholic", interests: ["hustle", "goals"], flirtBias: 5 },
  { label: "Work-Life Balance Person", interests: ["boundaries", "weekends"], flirtBias: 6 },
  { label: "Career Changer", interests: ["new beginnings", "figuring it out"], flirtBias: 6 },
  { label: "Grad School Survivor", interests: ["degrees", "finally done"], flirtBias: 5 },
  { label: "Self-Taught", interests: ["learning", "curiosity"], flirtBias: 6 },
  { label: "Autodidact", interests: ["books", "deep dives"], flirtBias: 4 },
  { label: "Polyglot", interests: ["languages", "travel"], flirtBias: 6 },
  { label: "Expat", interests: ["living abroad", "cultures"], flirtBias: 7 },
  { label: "Immigrant", interests: ["two worlds", "family"], flirtBias: 6 },
  { label: "First Gen", interests: ["family", "building"], flirtBias: 6 },
  { label: "Only Child", interests: ["independence", "solitude comfort"], flirtBias: 5 },
  { label: "Oldest Sibling", interests: ["responsibility", "leading"], flirtBias: 5 },
  { label: "Middle Child", interests: ["diplomacy", "independence"], flirtBias: 6 },
  { label: "Youngest Sibling", interests: ["charm", "getting away with things"], flirtBias: 8 },
  { label: "Twin", interests: ["sharing", "identity"], flirtBias: 6 },
  { label: "Single Parent", interests: ["balance", "kid stuff"], flirtBias: 5 },
  { label: "Empty Nester", interests: ["new chapter", "travel"], flirtBias: 6 },
  { label: "Newly Divorced", interests: ["starting over", "figuring things out"], flirtBias: 6 },
  { label: "Widowed", interests: ["moving forward", "memories"], flirtBias: 4 },
  { label: "Long Distance Expert", interests: ["texting", "visits"], flirtBias: 6 },
  { label: "Commitment Ready", interests: ["partnership", "building together"], flirtBias: 7 },
  { label: "Taking It Slow", interests: ["no rush", "seeing what happens"], flirtBias: 5 },
  { label: "Just Looking", interests: ["curiosity", "no pressure"], flirtBias: 6 },
  { label: "Hopeful Cynic", interests: ["skepticism", "hoping to be wrong"], flirtBias: 5 },
  { label: "Eternal Optimist", interests: ["good vibes", "silver linings"], flirtBias: 8 },
  { label: "Realist", interests: ["practicality", "no games"], flirtBias: 5 },
  { label: "Romantic Realist", interests: ["love", "but also pragmatism"], flirtBias: 7 },
  { label: "Skeptic", interests: ["questions", "proof"], flirtBias: 3 },
  { label: "Believer", interests: ["faith", "trust"], flirtBias: 6 },
  { label: "Spiritual Not Religious", interests: ["meaning", "exploration"], flirtBias: 6 },
  { label: "Devout", interests: ["faith", "community"], flirtBias: 5 },
  { label: "Atheist", interests: ["science", "philosophy"], flirtBias: 4 },
  { label: "Agnostic", interests: ["questions", "openness"], flirtBias: 5 },
  { label: "Philosophy Nerd", interests: ["big questions", "debates"], flirtBias: 4, chaosBias: 0.02 },
  { label: "Psych Nerd", interests: ["behavior", "patterns"], flirtBias: 5 },
  { label: "True Neutral", interests: ["balance", "not picking sides"], flirtBias: 4 },
  { label: "Chaotic Good", interests: ["doing right", "unconventionally"], flirtBias: 7, chaosBias: 0.05 }
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

  // Only reject truly surreal/broken bios
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
  "humor",           // a joke or witty observation
  "vibe",            // energy or aesthetic
  "interest",        // one specific passion
  "quirk",           // something quirky
  "question",        // ask or challenge the reader
  "hot_take",        // unpopular opinion
  "random_fact",     // one weird fact
  "dealbreaker",     // something non-negotiable
  "brag",            // humble brag or flex
  "warning",         // playful warning
  "confession",      // something they're slightly embarrassed about
  "contradiction",   // two things about them that don't seem to fit
  "obsession",       // something they're way too into
  "pet_peeve",       // something that annoys them
  "secret",          // something most people don't know
  "challenge",       // daring the reader to do something
  "memory",          // a specific moment or story hint
  "goal",            // something they're working toward
  "fear",            // something they're scared of (playfully)
  "talent",          // something they're good at
  "flaw",            // something they're bad at
  "routine",         // a specific habit or ritual
  "taste",           // a strong preference (food, music, etc.)
  "story_hook",      // start of a story that makes you want more
  "self_roast",      // making fun of themselves
  "philosophy",      // a life motto or principle
  "nostalgia",       // something from their past
  "prediction",      // something they think will happen
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
      case "humor": return "a joke, dry observation, or something genuinely funny";
      case "vibe": return "your energy or aesthetic (show, don't label)";
      case "interest": return `a genuine passion for ${featuredInterest}`;
      case "quirk": return context.quirk ? `this quirk: ${context.quirk}` : "something unusual you do";
      case "question": return "a question or playful challenge to the reader";
      case "hot_take": return "an unpopular opinion you stand by";
      case "random_fact": return "one weird or surprising fact about yourself";
      case "dealbreaker": return "something you won't compromise on";
      case "brag": return "something you're genuinely good at";
      case "warning": return "a playful warning about dating you";
      case "confession": return "something you're slightly embarrassed about";
      case "contradiction": return "two things about you that seem contradictory";
      case "obsession": return "something you're way too into";
      case "pet_peeve": return "something that irrationally annoys you";
      case "secret": return "something most people don't know about you";
      case "challenge": return "a dare or challenge for the reader";
      case "memory": return "a hint at a specific moment or story";
      case "goal": return "something you're actively working toward";
      case "fear": return "something you're scared of (can be silly)";
      case "talent": return "something you're weirdly good at";
      case "flaw": return "something you're terrible at";
      case "routine": return "a specific habit or ritual you have";
      case "taste": return "a strong preference (food, music, movies, etc.)";
      case "story_hook": return "the start of a story that makes them want more";
      case "self_roast": return "making fun of yourself";
      case "philosophy": return "a life motto or guiding principle";
      case "nostalgia": return "something from your past you miss";
      case "prediction": return "something you think will happen";
      default: return "something distinctive about yourself";
    }
  };

  const leadInstruction = numHighlights === 1
    ? `Lead with ${getLeadInstruction(leadTypes[0])}.`
    : `Weave together: ${getLeadInstruction(leadTypes[0])} AND ${getLeadInstruction(leadTypes[1])}.`;

  // Pick a random structure style
  const structures = [
    "Single punchy statement.",
    "Two unrelated thoughts, no transition.",
    "A question followed by context.",
    "Statement then punchline.",
    "List of 2-3 things (no labels).",
    "Stream of consciousness fragment.",
    "Bold claim, then softening it.",
    "Third person observation about yourself.",
    "Direct address to the reader.",
    "If/then conditional.",
    "Comparison (I'm like X but Y).",
    "Timeline (past vs now).",
    "Contradiction setup.",
    "Rhetorical question, no answer.",
    "Mini dialogue or quote.",
    "Rating or ranking something.",
    "Warning label format.",
    "Cause and effect.",
    "Confession then pivot.",
    "Fragmented phrases, no full sentences.",
    "One long run-on thought.",
    "Dry deadpan delivery.",
    "Enthusiastic and exclamatory.",
    "Mysterious and vague.",
    "Open with a cringy famous quote, then your actual vibe.",
    "Reluctant first-timer energy: skeptical about apps but here anyway.",
    "Recently single, ready to mingle tone.",
    "Here for a good time, not a long time energy.",
    "Humble brag disguised as self-deprecation.",
    "Series of increasingly specific preferences.",
    "Backhanded compliment to yourself.",
    "Very specific hypothetical scenario.",
    "Unpopular opinion stated as fact.",
    "A review of yourself (3.5 stars, etc.).",
    "Resume bullet point energy, but for dating.",
    "Fake testimonial from a friend or ex.",
    "Red flag presented as a green flag.",
    "Overly honest disclaimer.",
    "Very specific 'looking for' that's actually about you.",
    "Weird flex, fully owned.",
    "Domestic fantasy (specific date scenario).",
    "Anti-bio energy: refusing to sell yourself.",
    "One word repeated with variations.",
    "Song lyric energy (but not actual lyrics).",
    "Text-to-friend style, casual and half-finished.",
  ];
  const structureHint = pick(structures);

  // Get list of topics that have hit their rate limit
  const bannedTopics = getBannedTopicsForPrompt();
  const bannedLine = bannedTopics.length > 0 
    ? `\nDO NOT MENTION: ${bannedTopics.join(', ')} - these topics are overused.` 
    : '';

  const prompt = `Write a dating app bio for a FICTIONAL person (adult 21+).

APPROACH: ${leadInstruction}
STRUCTURE: ${structureHint}

Character seed (use ONE element, weave naturally):
- Personality: ${context.archetypeLabel}
- Interest: ${featuredInterest}
${context.quirk ? `- Quirk: ${context.quirk}` : ""}
- Flirt energy: ${context.flirtPercent}/100

${context.lookingForLine ? `What they want: ${context.lookingForLine}\n` : ""}

FORMAT: STRICT ${targetLines} line(s) max. Short punchy lines. 0-2 emojis. No em dashes.

VARIETY IS KEY:
Be original. Don't default to common dating app topics. Surprise the reader with something they haven't seen before.
Pick unexpected details, niche interests, specific memories, unusual opinions.
Write like a real person with a unique perspective.${bannedLine}
Output ONLY the bio text.`;

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.65,
        presence_penalty: 0.7,
        frequency_penalty: 0.6,
      });

      let text = response.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      
      // Enforce 4 line max by truncating
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 4) {
        text = lines.slice(0, 4).join('\n');
      }
      
      // Check for rate-limited topics
      const bannedTopic = checkBioForBannedTopics(text);
      if (bannedTopic) {
        console.log(`[Bio] Rejected: contains rate-limited topic '${bannedTopic}'`);
        continue;
      }
      
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
        // Register topics for rate limiting
        registerTopicsInBio(bio);
        return bio;
      }
    }
  }

  const fallback = generateFallbackBio(context.interests, context.quirk, context.lookingForLine || null);
  storage.usedBioHashes.add(hashBio(fallback));
  // Register topics for rate limiting
  registerTopicsInBio(fallback);
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

  // WRITING STYLE VARIABILITY
  const slangProfiles = [
    "no slang / formal",
    "light casual slang",
    "heavy internet slang (lol, tbh, ngl, idk, rn)",
    "text shorthand (u, ur, bc, omg)",
    "chronically-online tone",
    "regional casual",
    "professional / jargon-heavy",
    "slightly outdated slang (rad, dope, sick)"
  ];
  
  const capsStyles = [
    "proper capitalization",
    "all lowercase",
    "occasional ALL CAPS for emphasis",
    "frequent ALL CAPS",
    "inconsistent capitalization"
  ];
  
  const typoFrequencies = [
    "none",
    "rare (1 in 10 messages)",
    "occasional (1 in 5 messages)",
    "frequent (most messages have small imperfections)"
  ];
  
  const emojiProfiles = [
    "no emojis at all",
    "rare emojis (1-2 per convo)",
    "occasional emojis",
    "frequent emojis",
    "emoticons only (:-) :/ <3)",
    "emoji-heavy but context-aware"
  ];
  
  const messageLengthStyles = [
    "very short, clipped",
    "short and punchy",
    "medium, conversational",
    "slightly rambly",
    "varies wildly"
  ];

  // LANGUAGE & ORIGIN DIVERSITY (~20% non-native speakers)
  const originProfiles = [
    { type: "native", desc: "native English speaker" },
    { type: "native", desc: "native English speaker" },
    { type: "native", desc: "native English speaker" },
    { type: "native", desc: "native English speaker" },
    { type: "esl_light", desc: "English as second language (light accent in writing, fully fluent)" },
    { type: "code_switch", desc: "bilingual, occasionally drops words in native language" },
    { type: "immigrant", desc: "immigrated to the U.S., American but connected to heritage" },
    { type: "dual_citizen", desc: "dual citizenship, travels between countries" },
    { type: "tourist", desc: "visiting/traveling through, curious about locals" },
    { type: "expat", desc: "American living abroad, currently visiting home" }
  ];

  // NON-MONOGAMY (~1 in 30) - use random sampling for better distribution
  const isNonMonogamous = Math.random() < (1/30);
  const nonMonogamyStyles = ["open relationship", "polyamorous", "ENM (ethically non-monogamous)", "relationship anarchist"];

  const bits = [
    "teasing the user (lightly)",
    "asking a specific question about the user",
    "being blunt in a funny way",
    "turning things into a playful challenge",
    "showing genuine curiosity about user's life",
    "giving a sincere compliment",
    "asking what they're looking for on here"
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
  const signatureBits = [bits[n(8) % bits.length], bits[n(10) % bits.length]];
  const origin = originProfiles[n(24) % originProfiles.length];

  // Build detailed texting style
  const textingStyle = {
    slang: slangProfiles[n(6) % slangProfiles.length],
    caps: capsStyles[n(26) % capsStyles.length],
    typos: typoFrequencies[n(28) % typoFrequencies.length],
    emojis: emojiProfiles[n(30) % emojiProfiles.length],
    messageLength: messageLengthStyles[n(32) % messageLengthStyles.length]
  };

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
    textingStyle,
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
    
    // New diversity fields
    origin: origin.desc,
    originType: origin.type,
    isNonMonogamous,
    nonMonogamyStyle: isNonMonogamous ? nonMonogamyStyles[n(34) % nonMonogamyStyles.length] : undefined,
  };

  return JSON.stringify(spec);
}

// ------------------------------------------------------------
// Profile generation config
// ------------------------------------------------------------
const PROFILE_BUFFER_TARGET = 45;
const PROFILE_GEN_BATCH_SIZE = 20;
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
  
  // Build pool with topic-gated quirks
  const pool: { text: string; weight: number; topicKey?: string }[] = [
    { text: "I make playlists for every mood.", weight: 14, topicKey: 'playlist' },
    { text: "I name all my houseplants.", weight: 12, topicKey: 'plant_parent' },
    { text: "I have opinions about font kerning.", weight: 10, topicKey: 'kerning' },
    { text: "I've memorized way too many movie quotes.", weight: 10 },
    { text: "I'm a semi-pro at GeoGuessr.", weight: 8, topicKey: 'geoguessr' },
    { text: "I still have a flip phone for the aesthetic.", weight: 6 },
    { text: "I can't eat pizza without ranch.", weight: 10, topicKey: 'ranch_pizza' },
    { text: "I sleep with a fan on, even in winter.", weight: 10 },
    { text: "I've never seen Star Wars. Be gentle.", weight: 8, topicKey: 'star_wars' },
    { text: "I have a notes app full of first-date ideas.", weight: 8 },
    { text: "I keep emergency snacks in every bag I own.", weight: 8 },

    // Ultra rare specifics
    { text: `I only drink coffee from one specific ${mugColor} mug. No exceptions.`, weight: 0.35, topicKey: 'coffee' },
    { text: "I collect tiny spoons like it's an Olympic sport.", weight: 0.20 },
    { text: "I'm weirdly good at naming pets.", weight: 0.20 },
    { text: "I am weirdly into maps.", weight: 0.18 },
  ];

  // Filter out quirks for topics that have hit their rate limit
  const allowed = pool.filter(item => {
    if (!item.topicKey) return true;
    return isTopicAllowed(item.topicKey);
  });
  
  if (allowed.length === 0) return null;

  const total = allowed.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const item of allowed) {
    r -= item.weight;
    if (r <= 0) return item.text;
  }
  return allowed[0].text;
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

    const batchSize = 8;
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

          const imageAsset = storage.getUniqueImageAsset(gender as "male" | "female" | "other");

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

          const imageUrl = buildImageUrl(imageAsset, profile.id);

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

  // Admin endpoint to validate Burst image URLs
  app.get("/api/admin/images/validate", async (req, res) => {
    const source = req.query.source as string;
    
    if (source !== "burst") {
      return res.status(400).json({ error: "Only 'source=burst' is supported" });
    }
    
    const allBurstUrls = [...BURST_MEN, ...BURST_WOMEN, ...BURST_OTHER];
    const results: { url: string; status: number | string; gender: string }[] = [];
    
    console.log(`[Admin] Validating ${allBurstUrls.length} Burst URLs...`);
    
    for (const url of allBurstUrls) {
      const gender = BURST_MEN.includes(url) ? "male" : 
                     BURST_WOMEN.includes(url) ? "female" : "other";
      try {
        const response = await fetch(url, { method: "HEAD" });
        results.push({ url, status: response.status, gender });
        if (response.status !== 200) {
          console.log(`[Admin] BROKEN: ${url} (${response.status})`);
        }
      } catch (error) {
        results.push({ url, status: "error", gender });
        console.log(`[Admin] ERROR: ${url} (${error})`);
      }
    }
    
    const broken = results.filter(r => r.status !== 200);
    console.log(`[Admin] Validation complete: ${broken.length}/${allBurstUrls.length} broken`);
    
    res.json({
      total: allBurstUrls.length,
      valid: results.filter(r => r.status === 200).length,
      broken: broken.length,
      brokenUrls: broken
    });
  });

  const httpServer = createServer(app);

  // Pre-generate profiles at startup so users do not wait
  console.log(`[Startup] Triggering initial profile generation of ${PROFILE_GEN_BATCH_SIZE} profiles`);
  generateProfilesInBackground("all", 21, 99, PROFILE_GEN_BATCH_SIZE)
    .catch(err => console.error("[Startup Gen] Error:", err));

  return httpServer;
}
