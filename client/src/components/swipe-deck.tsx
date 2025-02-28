import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileCard } from "./profile-card";
import type { Profile } from "@shared/schema";
import { Heart, X } from "lucide-react";

interface SwipeDeckProps {
  profiles: Profile[];
  onSwipe: (profile: Profile, direction: "left" | "right") => void;
}

export function SwipeDeck({ profiles, onSwipe }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  const currentProfile = profiles[currentIndex];

  const handleSwipe = (swipeDirection: "left" | "right") => {
    setDirection(swipeDirection);
    onSwipe(currentProfile, swipeDirection);
    
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setDirection(null);
    }, 300);
  };

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <h2 className="text-2xl font-bold text-gray-700">No more profiles!</h2>
        <p className="mt-2 text-gray-600">Check back later for more matches</p>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] w-full max-w-sm mx-auto">
      <AnimatePresence>
        <motion.div
          key={currentProfile.id}
          initial={{ scale: 1 }}
          animate={{
            scale: 1,
            x: direction === "left" ? -300 : direction === "right" ? 300 : 0,
            rotate: direction === "left" ? -20 : direction === "right" ? 20 : 0,
          }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute w-full"
        >
          <ProfileCard profile={currentProfile} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
        <button
          onClick={() => handleSwipe("left")}
          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100"
        >
          <X className="w-8 h-8 text-red-500" />
        </button>
        <button
          onClick={() => handleSwipe("right")}
          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100"
        >
          <Heart className="w-8 h-8 text-green-500" />
        </button>
      </div>
    </div>
  );
}
