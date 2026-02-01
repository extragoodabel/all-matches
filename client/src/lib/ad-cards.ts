import egPreview2 from "@/assets/images/eg_preview2.png";
import egMark from "@/assets/images/eg_mark.png";
import type { Profile } from "@shared/schema";

export const AD_CARD_BRAND = {
  name: "Extra Good Studio",
  bio: "A creative collective, specializing in branding, design, and marketing.",
  url: "https://extragood.studio/",
  bgColor: "#9AE033",
};

const AD_LOGOS = [egPreview2, egMark];

export function createAdProfile(position: number): Profile & { isAd: true } {
  const logoIndex = position === 10 ? 0 : (position % 2);
  
  return {
    id: -(position * 1000),
    name: AD_CARD_BRAND.name,
    age: 0,
    bio: AD_CARD_BRAND.bio,
    imageUrl: AD_LOGOS[logoIndex],
    gender: "other",
    isAI: false,
    isChaos: false,
    characterSpec: null,
    isAd: true,
  };
}

export function getAdCardPositions(swipedCount: number, deckSize: number): number[] {
  const positions: number[] = [];
  let pos = 10;
  const maxPosition = swipedCount + deckSize + 50;
  while (pos <= maxPosition) {
    positions.push(pos);
    pos += 15;
  }
  return positions;
}

export function isAdProfile(profile: Profile): profile is Profile & { isAd: true } {
  return 'isAd' in profile && (profile as any).isAd === true;
}

export function injectAdCards(profiles: Profile[], swipedCount: number): Profile[] {
  const result: Profile[] = [];
  let profileIndex = 0;
  let adPositions = getAdCardPositions(swipedCount, profiles.length);
  
  for (let deckPosition = 1; profileIndex < profiles.length || adPositions.length > 0; deckPosition++) {
    const adjustedPosition = deckPosition + swipedCount;
    
    if (adPositions.includes(adjustedPosition)) {
      result.push(createAdProfile(adjustedPosition));
      adPositions = adPositions.filter(p => p !== adjustedPosition);
    } else if (profileIndex < profiles.length) {
      result.push(profiles[profileIndex]);
      profileIndex++;
    } else {
      break;
    }
  }
  
  return result;
}
