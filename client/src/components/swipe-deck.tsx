import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileCard } from "./profile-card";
import type { Profile } from "@shared/schema";
import { Heart, X } from "lucide-react";

// ============ SWIPE TUNING CONSTANTS ============
// Adjust these values to tune the swipe feel

const SWIPE_THRESHOLD_PX = 80;           // Minimum px to trigger swipe (or use percentage below)
const SWIPE_THRESHOLD_PERCENT = 0.18;    // Alternate: 18% of card width
const USE_PERCENT_THRESHOLD = false;     // Set true to use percentage instead of fixed px

const ROTATION_MULTIPLIER = 0.08;        // How much the card rotates while dragging (deg per px)
const MAX_ROTATION = 25;                 // Maximum rotation angle in degrees
const OPACITY_DECAY = 400;               // Higher = slower opacity fade during drag
const MIN_OPACITY = 0.7;                 // Minimum opacity when dragging far

const INTENT_RATIO = 1.2;                // abs(dx) must be > abs(dy) * this to count as horizontal swipe
const VERTICAL_DAMPING = 0.15;           // How much vertical movement is allowed (0 = none, 1 = full)

const INDICATOR_SHOW_PX = 40;            // Show LIKE/NOPE indicator after this many px
const EXIT_DISTANCE = 400;               // How far card flies off screen on swipe
const SWIPE_ANIMATION_MS = 300;          // Duration of exit animation

// ================================================

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
    
    // Detect swipe intent on first significant movement
    if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * INTENT_RATIO;
      setIsHorizontalSwipe(isHorizontal);
    }
    
    // Only move card if horizontal swipe intent detected (or not yet determined)
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

    // Calculate threshold
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

  // Calculate visual feedback
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

// Report bad image to server (fire and forget)
function reportBadImage(profileId: number) {
  fetch(`/api/profiles/${profileId}/bad-image`, { method: "POST" })
    .catch(() => {}); // Ignore errors
}

export function SwipeDeck({ profiles, onSwipe }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [seenProfileIds, setSeenProfileIds] = useState<Set<number>>(new Set());
  const [badImageIds, setBadImageIds] = useState<Set<number>>(new Set());

  // Find the first unseen profile that doesn't have a bad image
  const currentProfile = profiles.find(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
  // Reset index if we've gone past the end but new profiles arrived
  useEffect(() => {
    if (currentIndex >= profiles.length && profiles.length > 0) {
      // Check if there are any unseen profiles without bad images
      const unseenProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
      if (unseenProfiles.length > 0) {
        setCurrentIndex(0);
      }
    }
  }, [profiles.length, currentIndex, seenProfileIds, badImageIds]);

  const handleImageError = useCallback((profileId: number) => {
    console.log(`[SwipeDeck] Image error for profile ${profileId}, skipping...`);
    // Mark this profile as having a bad image
    setBadImageIds(prev => {
      const newSet = new Set(Array.from(prev));
      newSet.add(profileId);
      return newSet;
    });
    // Report to server
    reportBadImage(profileId);
  }, []);

  const handleSwipe = useCallback((swipeDirection: "left" | "right") => {
    if (!currentProfile || direction) return;
    setDirection(swipeDirection);
    
    // Mark this profile as seen
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

  // Show indicator after threshold
  const swipeIndicator = dragOffset.x > INDICATOR_SHOW_PX 
    ? "like" 
    : dragOffset.x < -INDICATOR_SHOW_PX 
      ? "nope" 
      : null;

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Finding matches...</h2>
      </div>
    );
  }

  // Check if there are any unseen profiles without bad images
  const remainingProfiles = profiles.filter(p => !seenProfileIds.has(p.id) && !badImageIds.has(p.id));
  
  if (!currentProfile || remainingProfiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Finding more matches...</h2>
        <p className="mt-2 text-gray-600">New profiles are being loaded</p>
      </div>
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
                profile={currentProfile} 
                onImageError={() => handleImageError(currentProfile.id)}
              />
              
              {swipeIndicator === "like" && (
                <div className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center">
                  <div className="bg-green-500 text-white px-6 py-2 rounded-full text-2xl font-bold rotate-[-15deg] border-4 border-white shadow-lg">
                    LIKE
                  </div>
                </div>
              )}
              
              {swipeIndicator === "nope" && (
                <div className="absolute inset-0 bg-red-500/20 rounded-2xl flex items-center justify-center">
                  <div className="bg-red-500 text-white px-6 py-2 rounded-full text-2xl font-bold rotate-[15deg] border-4 border-white shadow-lg">
                    NOPE
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
          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Dislike profile"
        >
          <X className="w-8 h-8 text-red-500" />
        </button>
        <button
          onClick={() => handleSwipe("right")}
          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400"
          aria-label="Like profile"
        >
          <Heart className="w-8 h-8 text-green-500" />
        </button>
      </div>
    </div>
  );
}
