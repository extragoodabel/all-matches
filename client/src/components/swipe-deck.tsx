import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

function LoadingCard({ message, submessage }: { message: string; submessage?: string }) {
  const palette = getSessionPalette();
  const patternStyle = getPatternStyle('confetti');
  
  return (
    <div 
      className="flex flex-col items-center justify-center h-[600px] relative"
      style={{
        '--eg-primary': palette.primary,
        '--eg-secondary': palette.secondary,
        '--eg-accent': palette.accent,
      } as React.CSSProperties}
    >
      <div 
        className="absolute inset-0 rounded-2xl opacity-40"
        style={patternStyle}
      />
      
      <div className="relative eg-card p-8 text-center max-w-sm w-full">
        <div className="flex justify-center gap-2 mb-6">
          <Sparkles 
            className="w-8 h-8 eg-bounce" 
            style={{ color: palette.primary, animationDelay: '0ms' }} 
          />
          <Heart 
            className="w-8 h-8 eg-bounce" 
            style={{ color: palette.secondary, animationDelay: '150ms' }} 
          />
          <Sparkles 
            className="w-8 h-8 eg-bounce" 
            style={{ color: palette.primary, animationDelay: '300ms' }} 
          />
        </div>
        
        <h2 
          className="text-2xl md:text-3xl font-black tracking-tight mb-2"
          style={{ color: palette.text }}
        >
          {message}
          <br />
          <span>matches<span className="eg-loading-dots" /></span>
        </h2>
        
        {submessage && (
          <p className="text-gray-600 font-medium">{submessage}</p>
        )}
      </div>
    </div>
  );
}

export function SwipeDeck({ profiles, onSwipe }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [seenProfileIds, setSeenProfileIds] = useState<Set<number>>(new Set());
  const [badImageIds, setBadImageIds] = useState<Set<number>>(new Set());

  const currentProfile = profiles.find(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
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
    if (!currentProfile || direction) return;
    setDirection(swipeDirection);
    
    setSeenProfileIds(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(currentProfile.id);
      return newSet;
    });
    
    onSwipe(currentProfile, swipeDirection);

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setDirection(null);
    }, SWIPE_ANIMATION_MS);
  }, [currentProfile, direction, onSwipe]);

  const { cardRef, dragOffset, isDragging, rotation, opacity, handlers } = useSwipeGesture(handleSwipe);

  const swipeIndicator = dragOffset.x > INDICATOR_SHOW_PX 
    ? "like" 
    : dragOffset.x < -INDICATOR_SHOW_PX 
      ? "nope" 
      : null;

  if (profiles.length === 0) {
    return <LoadingCard message="Finding" />;
  }

  const remainingProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
  if (!currentProfile || remainingProfiles.length === 0) {
    return (
      <LoadingCard 
        message="Finding more" 
        submessage="New profiles are being loaded"
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-sm mb-6 relative">
        <AnimatePresence>
          <motion.div
            ref={cardRef}
            key={currentProfile.id}
            initial={{ scale: 1, opacity: 1 }}
            animate={{
              scale: 1,
              x: direction === "left" ? -EXIT_DISTANCE : direction === "right" ? EXIT_DISTANCE : dragOffset.x,
              y: direction ? 0 : dragOffset.y,
              rotate: direction === "left" ? -MAX_ROTATION : direction === "right" ? MAX_ROTATION : rotation,
              opacity: direction ? 0 : opacity,
            }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ 
              duration: direction ? SWIPE_ANIMATION_MS / 1000 : 0,
              type: direction ? "tween" : "spring",
              ease: "easeOut",
            }}
            className="select-none"
            style={{ 
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              WebkitUserDrag: "none",
              userSelect: "none",
            } as React.CSSProperties}
            {...handlers}
          >
            <div className="relative pointer-events-none">
              <ProfileCard 
                key={currentProfile.id}
                profile={currentProfile} 
                onImageError={() => handleImageError(currentProfile.id)}
              />
              
              {swipeIndicator === "like" && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                  <div className="bg-[#00D9A5] text-[#1A1A1A] px-8 py-3 rounded-full text-3xl font-black rotate-[-15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Like!
                  </div>
                </div>
              )}
              
              {swipeIndicator === "nope" && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                  <div className="bg-[#FF4136] text-white px-8 py-3 rounded-full text-3xl font-black rotate-[15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Nope
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-6 mt-4">
        <button
          onClick={() => handleSwipe("left")}
          className="p-5 bg-white rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          aria-label="Dislike profile"
        >
          <X className="w-8 h-8 text-[#FF4136]" />
        </button>
        <button
          onClick={() => handleSwipe("right")}
          className="p-5 bg-[#00D9A5] rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#1A1A1A] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          aria-label="Like profile"
        >
          <Heart className="w-8 h-8 text-[#1A1A1A]" />
        </button>
      </div>
    </div>
  );
}
