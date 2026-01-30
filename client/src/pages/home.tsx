import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Profile, Match } from "@shared/schema";
import { Heart, Settings2, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<{ profile: Profile; matchId: number } | null>(null);
  
  // Saved preferences (persisted state)
  const [ageRange, setAgeRange] = useState<[number, number]>([21, 50]);
  const [genderPref, setGenderPref] = useState("all");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Draft state for modal (only persisted on Save)
  const [draftAgeRange, setDraftAgeRange] = useState<[number, number]>([21, 50]);
  const [draftGenderPref, setDraftGenderPref] = useState("all");

  const { data: profiles = [], refetch } = useQuery<Profile[]>({
    queryKey: [`/api/profiles?gender=${genderPref}&minAge=${ageRange[0]}&maxAge=${ageRange[1]}`],
  });

  const shuffledProfiles = useMemo(() => {
    if (profiles.length === 0) return [];
    const arr = [...profiles];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [profiles.length === 0]);

  const filteredProfiles = useMemo(() => {
    return (shuffledProfiles.length > 0 ? shuffledProfiles : profiles).filter((p) => {
      const ageMatch = p.age >= ageRange[0] && p.age <= ageRange[1];
      const genderMatch =
        genderPref === "all" || p.gender === genderPref;
      return ageMatch && genderMatch;
    });
  }, [shuffledProfiles, profiles, ageRange, genderPref]);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    if (direction === "right") {
      try {
        const response = await apiRequest("POST", "/api/matches", {
          userId: 1,
          profileId: profile.id,
        });
        const createdMatch: Match = await response.json();
        setCurrentMatch({ profile, matchId: createdMatch.id });
      } catch (error) {
        console.error("Failed to create match:", error);
      }
    }
    
    if (filteredProfiles.length < 10) {
      refetch();
    }
  };

  // Modal handlers
  const openModal = () => {
    // Initialize draft from saved state
    setDraftAgeRange([...ageRange] as [number, number]);
    setDraftGenderPref(genderPref);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    // Persist draft to saved state
    setAgeRange(draftAgeRange);
    setGenderPref(draftGenderPref);
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    // Discard draft changes
    setIsModalOpen(false);
  };

  // Validation
  const isValid = draftAgeRange[0] >= 21 && draftAgeRange[1] <= 50 && draftAgeRange[0] <= draftAgeRange[1];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8 relative z-50">
        <button 
          onClick={() => setLocation("/inbox")}
          className="p-3 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-gray-100 rounded-full transition-all group active:scale-95"
        >
          <MessageCircle className="w-6 h-6 text-gray-600 group-hover:text-pink-500 transition-colors" />
        </button>
        <h1 className="text-5xl font-extrabold flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-6 h-6 text-red-500" />
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text animate-gradient">
              All Matches!
            </span>
            <Heart className="w-6 h-6 text-red-500" />
          </div>
        </h1>
        <button 
          onClick={openModal}
          className="p-3 bg-white/80 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-gray-100 rounded-full transition-all group active:scale-95"
        >
          <Settings2 className="w-6 h-6 text-gray-600 group-hover:text-pink-500 transition-colors" />
        </button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Match Preferences</DialogTitle>
            <DialogDescription>Set your age range and gender preferences</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Age Range: {draftAgeRange[0]} - {draftAgeRange[1]}</Label>
              <Slider
                min={21}
                max={50}
                step={1}
                value={draftAgeRange}
                onValueChange={(val) => setDraftAgeRange(val as [number, number])}
                minStepsBetweenThumbs={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Show me</Label>
              <Select value={draftGenderPref} onValueChange={setDraftGenderPref}>
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
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SwipeDeck key={`${ageRange.join("-")}-${genderPref}`} profiles={filteredProfiles} onSwipe={handleSwipe} />
      
      {currentMatch && (
        <MatchNotification
          profile={currentMatch.profile}
          onClose={() => setCurrentMatch(null)}
          onStartChat={() => setLocation(`/chat/${currentMatch.matchId}`)}
        />
      )}
    </div>
  );
}
