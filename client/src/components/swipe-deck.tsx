import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileCard } from "./profile-card";
import type { Profile } from "@shared/schema";
import { Heart, X } from "lucide-react";

interface SwipeDeckProps {
  profiles: Profile[];
  onSwipe: (profile: Profile, direction: "left" | "right") => void;
}

// Hook to handle drag-to-swipe gesture
function useSwipeGesture(onSwipeComplete: (direction: "left" | "right") => void) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  // Swipe threshold: 25% of card width triggers a swipe
  const SWIPE_THRESHOLD_PERCENT = 0.25;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    // Capture pointer for smooth tracking outside element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.current.x;
    const deltaY = e.clientY - startPos.current.y;
    setDragOffset({ x: deltaX, y: deltaY * 0.1 }); // Minimal vertical movement
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Calculate threshold based on card width
    const cardWidth = cardRef.current?.offsetWidth || 300;
    const threshold = cardWidth * SWIPE_THRESHOLD_PERCENT;

    if (dragOffset.x > threshold) {
      // Swiped right - Like
      onSwipeComplete("right");
    } else if (dragOffset.x < -threshold) {
      // Swiped left - Dislike
      onSwipeComplete("left");
    }
    
    // Reset offset (snap back if threshold not met)
    setDragOffset({ x: 0, y: 0 });
  }, [isDragging, dragOffset.x, onSwipeComplete]);

  // Calculate visual feedback values
  const rotation = dragOffset.x * 0.05; // Subtle rotation during drag
  const opacity = Math.max(0.6, 1 - Math.abs(dragOffset.x) / 500); // Slight fade

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
      onPointerCancel: handlePointerUp, // Handle cancel same as up
    },
  };
}

export function SwipeDeck({ profiles, onSwipe }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const currentProfile = profiles[currentIndex];

  const handleSwipe = useCallback((swipeDirection: "left" | "right") => {
    if (!currentProfile || direction) return; // Prevent double-swipe
    setDirection(swipeDirection);
    onSwipe(currentProfile, swipeDirection);

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setDirection(null);
    }, 300);
  }, [currentProfile, direction, onSwipe]);

  // Initialize swipe gesture hook
  const { cardRef, dragOffset, isDragging, rotation, handlers } = useSwipeGesture(handleSwipe);

  // Determine swipe direction indicator for visual feedback
  const swipeIndicator = dragOffset.x > 50 ? "like" : dragOffset.x < -50 ? "nope" : null;

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Finding matches...</h2>
      </div>
    );
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <h2 className="text-2xl font-bold text-gray-700">No more profiles!</h2>
        <p className="mt-2 text-gray-600">Check back later for more matches</p>
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
            initial={{ scale: 1 }}
            animate={{
              scale: 1,
              // If animating out, use direction; otherwise use drag offset
              x: direction === "left" ? -300 : direction === "right" ? 300 : dragOffset.x,
              rotate: direction === "left" ? -20 : direction === "right" ? 20 : rotation,
            }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ 
              duration: direction ? 0.3 : 0, // Instant during drag, animated on swipe
              type: direction ? "tween" : "spring",
            }}
            style={{ 
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none", // Prevent scroll interference on touch
            }}
            {...handlers}
          >
            {/* Visual feedback overlay during drag */}
            <div className="relative">
              <ProfileCard profile={currentProfile} />
              
              {/* Like indicator (shown when dragging right) */}
              {swipeIndicator === "like" && (
                <div className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center pointer-events-none">
                  <div className="bg-green-500 text-white px-6 py-2 rounded-full text-2xl font-bold rotate-[-15deg] border-4 border-white shadow-lg">
                    LIKE
                  </div>
                </div>
              )}
              
              {/* Nope indicator (shown when dragging left) */}
              {swipeIndicator === "nope" && (
                <div className="absolute inset-0 bg-red-500/20 rounded-2xl flex items-center justify-center pointer-events-none">
                  <div className="bg-red-500 text-white px-6 py-2 rounded-full text-2xl font-bold rotate-[15deg] border-4 border-white shadow-lg">
                    NOPE
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Existing buttons - unchanged functionality */}
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
