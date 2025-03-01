import { useState } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { mockProfiles } from "@/lib/mock-profiles";
import { apiRequest } from "@/lib/queryClient";
import type { Profile } from "@shared/schema";
import { Heart } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<Profile | null>(null);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    if (direction === "right") {
      try {
        const match = await apiRequest("POST", "/api/matches", {
          userId: 1, // TODO: Replace with actual user ID
          profileId: profile.id,
        });
        setCurrentMatch(profile);
      } catch (error) {
        console.error("Failed to create match:", error);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-5xl font-extrabold text-center mb-8">
        <div className="flex items-center justify-center gap-2">
          <Heart className="w-6 h-6 text-red-500" />
          <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text animate-gradient">
            All Matches!
          </span>
          <Heart className="w-6 h-6 text-red-500" />
        </div>
      </h1>
      <SwipeDeck profiles={mockProfiles} onSwipe={handleSwipe} />
      {currentMatch && (
        <MatchNotification
          profile={currentMatch}
          onClose={() => setCurrentMatch(null)}
          onStartChat={() => setLocation(`/chat/${currentMatch.id}`)}
        />
      )}
    </div>
  );
}