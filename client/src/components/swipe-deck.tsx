import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ProfileCard } from "./profile-card";
import type { Profile } from "@shared/schema";
import { Heart, X, Sparkles } from "lucide-react";
import { getSessionPalette } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";

const SWIPE_THRESHOLD_PX = 80;
const SWIPE_THRESHOLD_PERCENT = 0.18;
const USE_PERCENT_THRESHOLD = false;
const ROTATION_MULTIPLIER = 0.08;
const MAX_ROTATION = 25;
const OPACITY_DECAY = 400;
const MIN_OPACITY = 0.7;
const INTENT_RATIO = 1.2;
const VERTICAL_DAMPING = 0.15;
const INDICATOR_SHOW_PX = 40;
const EXIT_DISTANCE = 400;
const SWIPE_ANIMATION_MS = 300;

interface SwipeDeckProps {
  profiles: Profile[];
  onSwipe: (profile: Profile, direction: "left" | "right") => void;
  onNeedsMore?: () => void;
}

function useSwipeGesture(onSwipeComplete: (direction: "left" | "right") => void) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState<boolean | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setIsHorizontalSwipe(null);
    startPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;
    
    if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * INTENT_RATIO;
      setIsHorizontalSwipe(isHorizontal);
    }
    
    if (isHorizontalSwipe !== false) {
      setDragOffset({ 
        x: deltaX, 
        y: deltaY * VERTICAL_DAMPING 
      });
    }
  }, [isDragging, isHorizontalSwipe]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setIsHorizontalSwipe(null);
    
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer may already be released
    }

    const cardWidth = cardRef.current?.offsetWidth || 300;
    const threshold = USE_PERCENT_THRESHOLD 
      ? cardWidth * SWIPE_THRESHOLD_PERCENT 
      : SWIPE_THRESHOLD_PX;

    if (dragOffset.x > threshold) {
      onSwipeComplete("right");
    } else if (dragOffset.x < -threshold) {
      onSwipeComplete("left");
    }
    
    setDragOffset({ x: 0, y: 0 });
  }, [isDragging, dragOffset.x, onSwipeComplete]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    setIsHorizontalSwipe(null);
    setDragOffset({ x: 0, y: 0 });
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer may already be released
    }
  }, []);

  const rawRotation = dragOffset.x * ROTATION_MULTIPLIER;
  const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, rawRotation));
  const opacity = Math.max(MIN_OPACITY, 1 - Math.abs(dragOffset.x) / OPACITY_DECAY);

  return {
    cardRef,
    dragOffset,
    isDragging,
    rotation,
    opacity,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}

function reportBadImage(profileId: number) {
  fetch(`/api/profiles/${profileId}/bad-image`, { method: "POST" })
    .catch(() => {});
}

function SkeletonCard({ index }: { index: number }) {
  const palette = getSessionPalette();
  const patterns = ['checker', 'stripes', 'dots'] as const;
  const patternStyle = getPatternStyle(patterns[index % 3]);
  
  return (
    <div 
      className="absolute w-full pointer-events-none animate-pulse"
      style={{
        transform: `translateX(${index * 4}px) translateY(${index * 5}px)`,
        zIndex: -index,
        '--eg-primary': palette.primary,
        '--eg-secondary': palette.secondary,
      } as React.CSSProperties}
    >
      <div className="relative pb-12">
        <div 
          className="w-full max-w-sm mx-auto rounded-2xl border-[3px] border-[#1A1A1A] overflow-hidden"
          style={{
            aspectRatio: '3/4.5',
            ...patternStyle,
          }}
        />
      </div>
    </div>
  );
}

function LoadingCard({ message, submessage }: { message: string; submessage?: string }) {
  const palette = getSessionPalette();
  
  return (
    <div 
      className="flex-1 flex flex-col items-center justify-center relative min-h-0"
      style={{
        '--eg-primary': palette.primary,
        '--eg-secondary': palette.secondary,
        '--eg-accent': palette.accent,
      } as React.CSSProperties}
    >
      {/* Skeleton card stack */}
      <div className="relative w-full max-w-sm flex items-center justify-center">
        {[3, 2, 1, 0].map((i) => (
          <SkeletonCard key={i} index={i} />
        ))}
        
        {/* Overlay message */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white rounded-xl px-6 py-4 text-center border-2 border-[#1A1A1A] shadow-lg">
            <div className="flex justify-center gap-2 mb-3">
              <Sparkles 
                className="w-6 h-6 eg-bounce" 
                style={{ color: palette.primary, animationDelay: '0ms' }} 
              />
              <Heart 
                className="w-6 h-6 eg-bounce" 
                style={{ color: palette.secondary, animationDelay: '150ms' }} 
              />
            </div>
            <h2 
              className="text-lg font-black tracking-tight"
              style={{ color: palette.text }}
            >
              {message} matches<span className="eg-loading-dots" />
            </h2>
            {submessage && (
              <p className="text-sm text-gray-600 mt-1">{submessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SwipeDeck({ profiles, onSwipe, onNeedsMore }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [exitingProfile, setExitingProfile] = useState<Profile | null>(null);
  const [seenProfileIds, setSeenProfileIds] = useState<Set<number>>(new Set());
  const [badImageIds, setBadImageIds] = useState<Set<number>>(new Set());
  const [lastProfileIds, setLastProfileIds] = useState<string>("");
  const lastPrefetchRef = useRef<number>(0);

  const currentProfile = profiles.find(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
  // Track profile IDs for stability - don't reset seen profiles when new ones arrive
  useEffect(() => {
    const currentIds = profiles.map(p => p.id).sort().join(',');
    if (currentIds !== lastProfileIds && profiles.length > 0) {
      setLastProfileIds(currentIds);
      // Don't reset seen profiles or currentIndex - just update the lastProfileIds tracker
    }
  }, [profiles, lastProfileIds]);

  // Preload images for upcoming profiles to eliminate loading delay
  useEffect(() => {
    const unseenProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
    // Preload next 5 profiles' images
    unseenProfiles.slice(0, 5).forEach(profile => {
      const img = new Image();
      img.src = profile.imageUrl;
    });
  }, [profiles, seenProfileIds, badImageIds]);
  
  useEffect(() => {
    if (currentIndex >= profiles.length && profiles.length > 0) {
      const unseenProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
      if (unseenProfiles.length > 0) {
        setCurrentIndex(0);
      }
    }
  }, [profiles.length, currentIndex, seenProfileIds, badImageIds]);

  const handleImageError = useCallback((profileId: number) => {
    console.log(`[SwipeDeck] Image error for profile ${profileId}, skipping...`);
    setBadImageIds(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(profileId);
      return newSet;
    });
    reportBadImage(profileId);
  }, []);

  const handleSwipe = useCallback((swipeDirection: "left" | "right") => {
    if (!currentProfile || exitingProfile) return;
    
    const profileToSwipe = currentProfile;
    setExitingProfile(profileToSwipe);
    setDirection(swipeDirection);
    
    // Mark as seen immediately so next profile is ready
    setSeenProfileIds(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(profileToSwipe.id);
      return newSet;
    });
    
    onSwipe(profileToSwipe, swipeDirection);

    setTimeout(() => {
      setExitingProfile(null);
      setDirection(null);
      setCurrentIndex((prev) => prev + 1);
    }, SWIPE_ANIMATION_MS);
  }, [currentProfile, exitingProfile, onSwipe]);

  const { cardRef, dragOffset, isDragging, rotation, opacity, handlers } = useSwipeGesture(handleSwipe);

  const swipeIndicator = dragOffset.x > INDICATOR_SHOW_PX 
    ? "like" 
    : dragOffset.x < -INDICATOR_SHOW_PX 
      ? "nope" 
      : null;

  const remainingProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  const needsMore = profiles.length === 0 || !currentProfile || remainingProfiles.length === 0;
  
  // Prefetch more profiles when running low (before we hit the loading screen)
  useEffect(() => {
    const now = Date.now();
    // Debounce: only prefetch if at least 3 seconds since last prefetch
    if (remainingProfiles.length < 5 && remainingProfiles.length > 0 && onNeedsMore && now - lastPrefetchRef.current > 3000) {
      lastPrefetchRef.current = now;
      console.log(`[SwipeDeck] Running low (${remainingProfiles.length} remaining), prefetching...`);
      onNeedsMore();
    }
  }, [remainingProfiles.length, onNeedsMore]);
  
  // Poll for more profiles when showing loading screen
  useEffect(() => {
    if (needsMore && onNeedsMore) {
      const interval = setInterval(() => {
        onNeedsMore();
      }, 1500); // Poll faster (1.5s instead of 2s)
      onNeedsMore(); // Call immediately too
      return () => clearInterval(interval);
    }
  }, [needsMore, onNeedsMore]);
  
  if (profiles.length === 0) {
    return <LoadingCard message="Finding" />;
  }
  
  if (needsMore) {
    return (
      <LoadingCard 
        message="Finding more" 
        submessage="New profiles are being loaded"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center min-h-0 relative">
      <div className="flex-1 w-full max-w-sm relative flex items-center justify-center min-h-0 py-2 pb-12 sm:pb-16">
        {/* Visual card stack - purely decorative, no interaction */}
        <div 
          className="absolute inset-0 pointer-events-none select-none flex items-center justify-center"
          style={{ userSelect: 'none', WebkitUserDrag: 'none', transform: 'translateY(-12px)' } as React.CSSProperties}
          aria-hidden="true"
        >
          {[3, 2, 1].map((i) => {
            const stackPatternStyles = [
              // checker
              { bg: `repeating-conic-gradient(var(--eg-primary) 0% 25%, var(--eg-secondary) 0% 50%) 50% / 40px 40px`, size: undefined },
              // stripes diagonal
              { bg: `repeating-linear-gradient(-45deg, var(--eg-primary), var(--eg-primary) 10px, var(--eg-secondary) 10px, var(--eg-secondary) 20px)`, size: undefined },
              // stripes horizontal
              { bg: `repeating-linear-gradient(0deg, var(--eg-primary), var(--eg-primary) 8px, var(--eg-secondary) 8px, var(--eg-secondary) 16px)`, size: undefined },
              // stripes vertical
              { bg: `repeating-linear-gradient(90deg, var(--eg-primary), var(--eg-primary) 12px, var(--eg-secondary) 12px, var(--eg-secondary) 24px)`, size: undefined },
              // chevrons
              { bg: `repeating-linear-gradient(90deg, var(--eg-secondary), var(--eg-secondary) 10px, transparent 10px, transparent 20px), repeating-linear-gradient(45deg, var(--eg-primary), var(--eg-primary) 5px, var(--eg-secondary) 5px, var(--eg-secondary) 10px)`, size: undefined },
              // halftone dense
              { bg: `radial-gradient(circle, var(--eg-primary) 3px, var(--eg-secondary) 3px) 0 0 / 10px 10px`, size: '10px 10px' },
              // halftone large
              { bg: `radial-gradient(circle, var(--eg-primary) 6px, var(--eg-secondary) 6px) 0 0 / 20px 20px`, size: '20px 20px' },
              // grid
              { bg: `linear-gradient(var(--eg-primary) 2px, var(--eg-secondary) 2px) 0 0 / 24px 24px, linear-gradient(90deg, var(--eg-primary) 2px, var(--eg-secondary) 2px) 0 0 / 24px 24px`, size: '24px 24px' },
              // diamonds small
              { bg: `linear-gradient(45deg, var(--eg-primary) 25%, var(--eg-secondary) 25%, var(--eg-secondary) 50%, var(--eg-primary) 50%, var(--eg-primary) 75%, var(--eg-secondary) 75%)`, size: '20px 20px' },
              // diamonds large
              { bg: `linear-gradient(45deg, var(--eg-primary) 25%, var(--eg-secondary) 25%, var(--eg-secondary) 50%, var(--eg-primary) 50%, var(--eg-primary) 75%, var(--eg-secondary) 75%)`, size: '40px 40px' },
              // zigzag
              { bg: `linear-gradient(135deg, var(--eg-primary) 25%, transparent 25%) -20px 0, linear-gradient(225deg, var(--eg-primary) 25%, transparent 25%) -20px 0, linear-gradient(315deg, var(--eg-primary) 25%, transparent 25%), linear-gradient(45deg, var(--eg-primary) 25%, transparent 25%)`, size: '40px 40px' },
              // triangles
              { bg: `linear-gradient(45deg, var(--eg-primary) 50%, var(--eg-secondary) 50%)`, size: '30px 30px' },
              // waves
              { bg: `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='20' fill='%23FFDC00'/%3E%3Cpath d='M0 10c5.5 0 5.5-5 11-5s5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5 5.5 5 11 5 5.5-5 11-5v10H0z' fill='%23FF1493'/%3E%3C/svg%3E")`, size: undefined },
              // hearts
              { bg: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='%23FFF8E7'/%3E%3Cpath d='M20 30l-1.5-1.4C12 22.7 8 19.2 8 15c0-3.3 2.7-6 6-6 1.9 0 3.7.9 4.8 2.3L20 12.5l1.2-1.2C22.3 9.9 24.1 9 26 9c3.3 0 6 2.7 6 6 0 4.2-4 7.7-10.5 13.6L20 30z' fill='%23FF1493'/%3E%3C/svg%3E")`, size: undefined },
              // confetti
              { bg: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='60' fill='%23FFF8E7'/%3E%3Crect x='5' y='5' width='8' height='8' fill='%23FF1493' transform='rotate(15 9 9)'/%3E%3Crect x='35' y='25' width='6' height='6' fill='%23FFDC00' transform='rotate(-20 38 28)'/%3E%3Crect x='15' y='40' width='7' height='7' fill='%2300D9A5' transform='rotate(45 18.5 43.5)'/%3E%3Ccircle cx='45' cy='10' r='4' fill='%23B388FF'/%3E%3Crect x='48' y='42' width='5' height='5' fill='%23FF4136' transform='rotate(30 50 44)'/%3E%3C/svg%3E")`, size: undefined },
              // pills
              { bg: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='60' fill='%23FFF8E7'/%3E%3Crect x='10' y='20' width='16' height='8' rx='4' fill='%23FF1493'/%3E%3Crect x='18' y='20' width='8' height='8' rx='0' fill='%23B388FF'/%3E%3Crect x='35' y='35' width='16' height='8' rx='4' fill='%2300D9A5'/%3E%3Crect x='43' y='35' width='8' height='8' rx='0' fill='%23FFDC00'/%3E%3C/svg%3E")`, size: undefined },
              // syringes
              { bg: `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='50' height='50' fill='%23FFF8E7'/%3E%3Crect x='15' y='8' width='4' height='30' rx='1' fill='%23B388FF'/%3E%3Crect x='13' y='8' width='8' height='6' rx='1' fill='%23FF1493'/%3E%3Crect x='15' y='38' width='4' height='6' rx='0' fill='%231A1A1A'/%3E%3Crect x='35' y='12' width='4' height='25' rx='1' fill='%2300D9A5'/%3E%3Crect x='33' y='12' width='8' height='5' rx='1' fill='%23FFDC00'/%3E%3Crect x='35' y='37' width='4' height='5' rx='0' fill='%231A1A1A'/%3E%3C/svg%3E")`, size: undefined },
              // stars
              { bg: `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='50' height='50' fill='%23FFF8E7'/%3E%3Cpolygon points='25,5 29,18 43,18 32,27 36,40 25,31 14,40 18,27 7,18 21,18' fill='%23FFDC00'/%3E%3C/svg%3E")`, size: undefined },
              // sparkles
              { bg: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='%23FFF8E7'/%3E%3Cpath d='M20 5 L22 15 L30 17 L22 19 L20 30 L18 19 L10 17 L18 15 Z' fill='%23FF1493'/%3E%3C/svg%3E")`, size: undefined },
              // crosses/plus
              { bg: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='40' fill='%23FFF8E7'/%3E%3Crect x='17' y='5' width='6' height='30' fill='%23FF1493'/%3E%3Crect x='5' y='17' width='30' height='6' fill='%23FF1493'/%3E%3C/svg%3E")`, size: undefined },
              // circles/bubbles
              { bg: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='60' fill='%23FFF8E7'/%3E%3Ccircle cx='15' cy='15' r='10' fill='%23B388FF'/%3E%3Ccircle cx='45' cy='25' r='8' fill='%23FF1493'/%3E%3Ccircle cx='25' cy='45' r='12' fill='%2300D9A5'/%3E%3C/svg%3E")`, size: undefined },
              // squiggles
              { bg: `url("data:image/svg+xml,%3Csvg width='60' height='30' viewBox='0 0 60 30' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='30' fill='%23FFF8E7'/%3E%3Cpath d='M0 15 Q15 0 30 15 T60 15' stroke='%23FF1493' stroke-width='4' fill='none'/%3E%3C/svg%3E")`, size: undefined },
              // lightning bolts
              { bg: `url("data:image/svg+xml,%3Csvg width='40' height='50' viewBox='0 0 40 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='50' fill='%23FFF8E7'/%3E%3Cpolygon points='22,5 10,25 18,25 14,45 30,20 22,20' fill='%23FFDC00'/%3E%3C/svg%3E")`, size: undefined },
              // flames
              { bg: `url("data:image/svg+xml,%3Csvg width='40' height='50' viewBox='0 0 40 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='50' fill='%23FFF8E7'/%3E%3Cpath d='M20 5 Q30 20 25 30 Q30 25 28 40 Q20 35 20 45 Q20 35 12 40 Q10 25 15 30 Q10 20 20 5Z' fill='%23FF6B6B'/%3E%3C/svg%3E")`, size: undefined },
              // lips/kisses
              { bg: `url("data:image/svg+xml,%3Csvg width='50' height='40' viewBox='0 0 50 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='50' height='40' fill='%23FFF8E7'/%3E%3Cellipse cx='18' cy='20' rx='12' ry='8' fill='%23FF1493'/%3E%3Cellipse cx='32' cy='20' rx='12' ry='8' fill='%23FF1493'/%3E%3Cellipse cx='25' cy='22' rx='4' ry='6' fill='%23FFF8E7'/%3E%3C/svg%3E")`, size: undefined },
              // eyes
              { bg: `url("data:image/svg+xml,%3Csvg width='60' height='40' viewBox='0 0 60 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='60' height='40' fill='%23FFF8E7'/%3E%3Cellipse cx='30' cy='20' rx='20' ry='12' fill='%23fff' stroke='%231A1A1A' stroke-width='2'/%3E%3Ccircle cx='30' cy='20' r='8' fill='%231A1A1A'/%3E%3Ccircle cx='33' cy='17' r='3' fill='%23fff'/%3E%3C/svg%3E")`, size: undefined },
              // arrows
              { bg: `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='50' height='50' fill='%23FFF8E7'/%3E%3Cpath d='M10 40 L25 10 L40 40 L25 30 Z' fill='%23FF1493'/%3E%3C/svg%3E")`, size: undefined },
            ];
            const stackColors = [
              { primary: '#B388FF', secondary: '#FFDC00' },
              { primary: '#00D9A5', secondary: '#FFF8E7' },
              { primary: '#FF6B6B', secondary: '#FFDC00' },
              { primary: '#00BFFF', secondary: '#FFF8E7' },
              { primary: '#FF1493', secondary: '#FFDC00' },
              { primary: '#FF4136', secondary: '#FFF8E7' },
              { primary: '#39CCCC', secondary: '#FFDC00' },
              { primary: '#01FF70', secondary: '#1A1A1A' },
            ];
            const safeId = Math.abs(currentProfile.id);
            const patternIdx = (safeId + i) % stackPatternStyles.length;
            const colorIdx = (safeId + i) % stackColors.length;
            const pattern = stackPatternStyles[patternIdx];
            const heightVariation = 0.72 - ((safeId * i) % 8) * 0.01;
            return (
              <div
                key={`stack-${i}-${currentProfile.id}`}
                className="absolute w-full pointer-events-none"
                style={{
                  transform: `translateX(${i * 4}px) translateY(${i * 5}px)`,
                  zIndex: -10 - i,
                  '--eg-primary': stackColors[colorIdx].primary,
                  '--eg-secondary': stackColors[colorIdx].secondary,
                } as React.CSSProperties}
              >
                <div className="relative pb-12">
                  <div 
                    className="w-full max-w-sm mx-auto rounded-2xl border-[3px] border-[#1A1A1A] overflow-hidden"
                    style={{
                      aspectRatio: `3/${3 / heightVariation}`,
                      background: pattern.bg,
                      backgroundSize: pattern.size,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Next card waiting underneath (only show when there's an exiting card) */}
        {exitingProfile && currentProfile && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
            <div className="w-full">
              <div className="relative pb-12">
                <ProfileCard 
                  key={currentProfile.id}
                  profile={currentProfile} 
                  onImageError={() => handleImageError(currentProfile.id)}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Active card (either the exiting one animating out, or the current one for interaction) */}
        <motion.div
            ref={cardRef}
            key={exitingProfile?.id ?? currentProfile.id}
            initial={false}
            animate={{
              scale: 1,
              x: direction === "left" ? -EXIT_DISTANCE : direction === "right" ? EXIT_DISTANCE : dragOffset.x,
              y: direction ? 0 : dragOffset.y,
              rotate: direction === "left" ? -MAX_ROTATION : direction === "right" ? MAX_ROTATION : rotation,
              opacity: direction ? 0 : 1,
            }}
            transition={{ 
              duration: direction ? SWIPE_ANIMATION_MS / 1000 : 0,
              type: direction ? "tween" : "spring",
              ease: "easeOut",
            }}
            className="select-none w-full"
            style={{ 
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              WebkitUserDrag: "none",
              userSelect: "none",
              zIndex: 2,
            } as React.CSSProperties}
            {...(exitingProfile ? {} : handlers)}
          >
            <div className="relative pointer-events-none pb-12">
              <ProfileCard 
                key={exitingProfile?.id ?? currentProfile.id}
                profile={exitingProfile ?? currentProfile} 
                onImageError={() => handleImageError((exitingProfile ?? currentProfile).id)}
              />
              
              {swipeIndicator === "like" && !exitingProfile && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ bottom: '48px' }}>
                  <div className="bg-[#00D9A5] text-[#1A1A1A] px-8 py-3 rounded-full text-3xl font-black rotate-[-15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Like!
                  </div>
                </div>
              )}
              
              {swipeIndicator === "nope" && !exitingProfile && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ bottom: '48px' }}>
                  <div className="bg-[#FF4136] text-white px-8 py-3 rounded-full text-3xl font-black rotate-[15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Nope
                  </div>
                </div>
              )}
            </div>
          </motion.div>
      </div>

      <div 
        className="absolute bottom-0 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-6 z-20 pointer-events-auto"
        style={{ animation: 'floatBob 4s ease-in-out infinite' }}
      >
        <button
          onClick={() => handleSwipe("left")}
          className="p-4 md:p-5 bg-white rounded-full eg-outline-thick shadow-lg hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-md transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-sm pointer-events-auto"
          style={{ 
            boxShadow: '0 8px 24px rgba(0,0,0,0.2), 4px 4px 0 #1A1A1A',
            animation: 'floatBob 4.2s ease-in-out infinite',
          }}
          aria-label="Dislike profile"
        >
          <X className="w-7 h-7 md:w-8 md:h-8 text-[#FF4136]" />
        </button>
        <button
          onClick={() => handleSwipe("right")}
          className="p-4 md:p-5 bg-[#00D9A5] rounded-full eg-outline-thick shadow-lg hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-md transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-sm pointer-events-auto"
          style={{ 
            boxShadow: '0 8px 24px rgba(0,0,0,0.2), 4px 4px 0 #1A1A1A',
            animation: 'floatBob 3.8s ease-in-out infinite',
            animationDelay: '0.3s',
          }}
          aria-label="Like profile"
        >
          <Heart className="w-7 h-7 md:w-8 md:h-8 text-[#1A1A1A]" />
        </button>
      </div>
      
      <style>{`
        @keyframes floatBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .absolute { animation: none !important; }
          button { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
