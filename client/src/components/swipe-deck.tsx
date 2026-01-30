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
  const pointerIdRef = useRef<number | null>(null);
  const currentOffsetRef = useRef({ x: 0, y: 0 });

  const resetDragState = useCallback(() => {
    setIsDragging(false);
    setIsHorizontalSwipe(null);
    setDragOffset({ x: 0, y: 0 });
    currentOffsetRef.current = { x: 0, y: 0 };
    pointerIdRef.current = null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    
    pointerIdRef.current = e.pointerId;
    setIsDragging(true);
    setIsHorizontalSwipe(null);
    startPos.current = { x: e.clientX, y: e.clientY };
    currentOffsetRef.current = { x: 0, y: 0 };
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || e.pointerId !== pointerIdRef.current) return;
    
    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;
    
    if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * INTENT_RATIO;
      setIsHorizontalSwipe(isHorizontal);
    }
    
    if (isHorizontalSwipe !== false) {
      const newOffset = { x: deltaX, y: deltaY * VERTICAL_DAMPING };
      currentOffsetRef.current = newOffset;
      setDragOffset(newOffset);
    }
  }, [isDragging, isHorizontalSwipe]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const finalOffsetX = currentOffsetRef.current.x;
    const cardWidth = cardRef.current?.offsetWidth || 300;
    const threshold = USE_PERCENT_THRESHOLD 
      ? cardWidth * SWIPE_THRESHOLD_PERCENT 
      : SWIPE_THRESHOLD_PX;

    if (finalOffsetX > threshold) {
      onSwipeComplete("right");
    } else if (finalOffsetX < -threshold) {
      onSwipeComplete("left");
    }
    
    resetDragState();
  }, [onSwipeComplete, resetDragState]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    resetDragState();
  }, [resetDragState]);

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

  const stackPalette = getSessionPalette();
  const stackPatternStyle = getPatternStyle('confetti');

  return (
    <div className="flex-1 flex flex-col items-center min-h-0 relative">
      <div className="flex-1 w-full max-w-sm relative flex items-center justify-center min-h-0 py-2 pb-12 sm:pb-16">
        
        {/* Static back cards - the deck underneath */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
          {/* Card 3 - deepest */}
          <div 
            className="absolute w-[calc(100%-32px)] aspect-[3/4] rounded-2xl border-4 border-[#1A1A1A]"
            style={{
              transform: 'translate(12px, 12px)',
              background: stackPalette.background,
              zIndex: 1,
              ...stackPatternStyle,
            }}
          />
          {/* Card 2 - middle */}
          <div 
            className="absolute w-[calc(100%-32px)] aspect-[3/4] rounded-2xl border-4 border-[#1A1A1A]"
            style={{
              transform: 'translate(6px, 6px)',
              background: stackPalette.background,
              zIndex: 2,
              ...stackPatternStyle,
            }}
          />
        </div>

        {/* Top card - the active profile that moves */}
        <AnimatePresence mode="wait">
          <motion.div
            ref={cardRef}
            key={currentProfile.id}
            initial={{ scale: 0.95, opacity: 0, rotateY: -8 }}
            animate={{
              scale: 1,
              rotateY: 0,
              x: direction === "left" ? -EXIT_DISTANCE : direction === "right" ? EXIT_DISTANCE : dragOffset.x,
              y: direction ? 0 : dragOffset.y,
              rotate: direction === "left" ? -MAX_ROTATION : direction === "right" ? MAX_ROTATION : rotation,
              opacity: direction ? 0 : opacity,
            }}
            exit={{ 
              x: direction === "left" ? -EXIT_DISTANCE : EXIT_DISTANCE,
              rotate: direction === "left" ? -MAX_ROTATION : MAX_ROTATION,
              opacity: 0,
            }}
            transition={{ 
              duration: direction ? SWIPE_ANIMATION_MS / 1000 : 0.25,
              type: direction ? "tween" : "spring",
              ease: "easeOut",
            }}
            className="select-none w-full relative"
            style={{ 
              zIndex: 10,
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              WebkitUserDrag: "none",
              userSelect: "none",
              transformStyle: 'preserve-3d',
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
