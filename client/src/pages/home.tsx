import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Profile } from "@shared/schema";
import { Heart, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<Profile | null>(null);
  const [ageRange, setAgeRange] = useState([21, 50]);
  const [genderPref, setGenderPref] = useState("all");

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
  });

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const ageMatch = p.age >= ageRange[0] && p.age <= ageRange[1];
      const genderMatch =
        genderPref === "all" || p.gender === genderPref;
      return ageMatch && genderMatch;
    });
  }, [profiles, ageRange, genderPref]);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    if (direction === "right") {
      try {
        await apiRequest("POST", "/api/matches", {
          userId: 1,
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
      <div className="flex justify-between items-center mb-8 relative z-50">
        <div className="w-10" /> {/* Spacer */}
        <h1 className="text-5xl font-extrabold flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-6 h-6 text-red-500" />
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text animate-gradient">
              All Matches!
            </span>
            <Heart className="w-6 h-6 text-red-500" />
          </div>
        </h1>
        <Dialog>
          <DialogTrigger asChild>
            <button className="p-3 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-gray-100 rounded-full transition-all group active:scale-95">
              <Settings2 className="w-6 h-6 text-gray-600 group-hover:text-pink-500 transition-colors" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Match Preferences</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Age Range: {ageRange[0]} - {ageRange[1]}</Label>
                <Slider
                  min={21}
                  max={60}
                  step={1}
                  value={ageRange}
                  onValueChange={setAgeRange}
                />
              </div>
              <div className="space-y-2">
                <Label>Show me</Label>
                <Select value={genderPref} onValueChange={setGenderPref}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="male">Men</SelectItem>
                    <SelectItem value="female">Women</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SwipeDeck key={`${ageRange.join("-")}-${genderPref}`} profiles={filteredProfiles} onSwipe={handleSwipe} />
      
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