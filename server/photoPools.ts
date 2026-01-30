// Use RandomUser.me portraits - guaranteed to work
// Men: https://randomuser.me/api/portraits/men/{0-99}.jpg
// Women: https://randomuser.me/api/portraits/women/{0-99}.jpg

// Local custom portrait images (served from /portraits/)
export const LOCAL_MALE_PORTRAITS: string[] = [
  '/portraits/burger-guy.jpg',
  '/portraits/glasses-guy.jpg',
];

export const LOCAL_FEMALE_PORTRAITS: string[] = [];
export const LOCAL_OTHER_PORTRAITS: string[] = [];

// Generate arrays of numbers 0-99 for portrait indices
export const MALE_PHOTO_POOL: number[] = Array.from({ length: 100 }, (_, i) => i);
export const FEMALE_PHOTO_POOL: number[] = Array.from({ length: 100 }, (_, i) => i);

export function shufflePool<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Helper to generate the actual image URL
export function getImageUrl(gender: 'male' | 'female', index: number): string {
  const genderPath = gender === 'male' ? 'men' : 'women';
  return `https://randomuser.me/api/portraits/${genderPath}/${index}.jpg`;
}

// Get a random local portrait for a gender, or null if none available
export function getRandomLocalPortrait(gender: 'male' | 'female' | 'other'): string | null {
  const pool = gender === 'male' ? LOCAL_MALE_PORTRAITS 
    : gender === 'female' ? LOCAL_FEMALE_PORTRAITS 
    : LOCAL_OTHER_PORTRAITS;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
