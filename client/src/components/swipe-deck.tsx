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

function LoadingCard({ message, submessage }: { message: string; submessage?: string }) {
  const palette = getSessionPalette();
  const patternStyle = getPatternStyle('confetti');
  
  return (
    <div 
      className="flex-1 flex flex-col items-center justify-center relative min-h-0"
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

export function SwipeDeck({ profiles, onSwipe, onNeedsMore }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [seenProfileIds, setSeenProfileIds] = useState<Set<number>>(new Set());
  const [badImageIds, setBadImageIds] = useState<Set<number>>(new Set());
  const [lastProfileIds, setLastProfileIds] = useState<string>("");

  const currentProfile = profiles.find(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
  // Reset seen profiles when we get a fresh batch from the server
  useEffect(() => {
    const currentIds = profiles.map(p => p.id).sort().join(',');
    if (currentIds !== lastProfileIds && profiles.length > 0) {
      // New profiles arrived - only keep seen IDs that are still in the new batch
      setSeenProfileIds(prev => {
        const profileIdSet = new Set(profiles.map(p => p.id));
        const newSet = new Set<number>();
        prev.forEach(id => {
          if (profileIdSet.has(id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
      setLastProfileIds(currentIds);
      setCurrentIndex(0);
    }
  }, [profiles, lastProfileIds]);
  
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

  const remainingProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  const needsMore = profiles.length === 0 || !currentProfile || remainingProfiles.length === 0;
  
  // Poll for more profiles when showing loading screen
  useEffect(() => {
    if (needsMore && onNeedsMore) {
      const interval = setInterval(() => {
        onNeedsMore();
      }, 2000);
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
          style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
          aria-hidden="true"
        >
          {[3, 2, 1].map((i) => {
            const stackPatterns = ['checker', 'stripes', 'dots'];
            const stackColors = [
              { primary: '#B388FF', secondary: '#FFDC00' },
              { primary: '#00D9A5', secondary: '#FFF8E7' },
              { primary: '#FF6B6B', secondary: '#FFDC00' },
            ];
            const patternIdx = (currentProfile.id + i) % stackPatterns.length;
            const colorIdx = (currentProfile.id + i) % stackColors.length;
            // Subtle height variation: 0.58 to 0.62 ratio (base is 0.6 for 3:5)
            const heightVariation = 0.60 + ((currentProfile.id * i) % 5 - 2) * 0.01;
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
                      background: stackPatterns[patternIdx] === 'checker' 
                        ? `repeating-conic-gradient(var(--eg-primary) 0% 25%, var(--eg-secondary) 0% 50%) 50% / 40px 40px`
                        : stackPatterns[patternIdx] === 'stripes'
                        ? `repeating-linear-gradient(-45deg, var(--eg-primary), var(--eg-primary) 10px, var(--eg-secondary) 10px, var(--eg-secondary) 20px)`
                        : `radial-gradient(circle, var(--eg-primary) 8px, transparent 8px) 0 0 / 32px 32px, var(--eg-secondary)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
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
            className="select-none w-full"
            style={{ 
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              WebkitUserDrag: "none",
              userSelect: "none",
            } as React.CSSProperties}
            {...handlers}
          >
            <div className="relative pointer-events-none pb-12">
              <ProfileCard 
                key={currentProfile.id}
                profile={currentProfile} 
                onImageError={() => handleImageError(currentProfile.id)}
              />
              
              {swipeIndicator === "like" && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ bottom: '48px' }}>
                  <div className="bg-[#00D9A5] text-[#1A1A1A] px-8 py-3 rounded-full text-3xl font-black rotate-[-15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Like!
                  </div>
                </div>
              )}
              
              {swipeIndicator === "nope" && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ bottom: '48px' }}>
                  <div className="bg-[#FF4136] text-white px-8 py-3 rounded-full text-3xl font-black rotate-[15deg] border-4 border-[#1A1A1A] shadow-[4px_4px_0_#1A1A1A] uppercase tracking-wide">
                    Nope
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
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
