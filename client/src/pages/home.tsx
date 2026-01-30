import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile, Match } from "@shared/schema";
import { Heart, Settings2, MessageCircle, RotateCcw } from "lucide-react";
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
import { usePreferences } from "@/hooks/use-preferences";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<{ profile: Profile; matchId: number | null } | null>(null);
  
  const { preferences, setPreferences, resetPreferences, DEFAULT_PREFERENCES } = usePreferences();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [draftAgeRange, setDraftAgeRange] = useState<[number, number]>([
    preferences.minAge,
    preferences.maxAge,
  ]);
  const [draftGenderPref, setDraftGenderPref] = useState<"male" | "female" | "other" | "all">(
    preferences.genderPreference
  );

  const { data: profiles = [], refetch } = useQuery<Profile[]>({
    queryKey: [
      "/api/profiles",
      preferences.genderPreference,
      preferences.minAge,
      preferences.maxAge,
    ],
    queryFn: async () => {
      const startTime = Date.now();
      const res = await fetch(
        `/api/profiles?gender=${preferences.genderPreference}&minAge=${preferences.minAge}&maxAge=${preferences.maxAge}`
      );
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      
      // Ensure spinner shows for at least 3 seconds so users can read it
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 3000;
      if (elapsed < minDisplayTime) {
        await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
      }
      
      return data;
    },
    staleTime: 1000 * 60 * 2,      // Data stays fresh for 2 minutes
    gcTime: 1000 * 60 * 10,        // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,   // Don't refetch when tab regains focus
    refetchOnMount: "always",      // Always refetch on mount to get latest profiles
    refetchOnReconnect: false,     // Don't refetch on network reconnect
    refetchInterval: 30000,        // Auto-refetch every 30 seconds to pick up new background-generated profiles
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
      const ageMatch = p.age >= preferences.minAge && p.age <= preferences.maxAge;
      const genderMatch =
        preferences.genderPreference === "all" || p.gender === preferences.genderPreference;
      return ageMatch && genderMatch;
    });
  }, [shuffledProfiles, profiles, preferences]);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    if (direction === "right") {
      // Show match modal immediately with pending state
      setCurrentMatch({ profile, matchId: null });
      
      try {
        console.log(`[Swipe] Creating match for profile.id=${profile.id}`);
        const response = await apiRequest("POST", "/api/matches", {
          userId: 1,
          profileId: profile.id,
        });
        const createdMatch: Match = await response.json();
        console.log(`[Swipe] Match created: match.id=${createdMatch.id}, profile.id=${profile.id}`);
        // Update with actual matchId
        setCurrentMatch({ profile, matchId: createdMatch.id });
        // Invalidate inbox cache so new match appears immediately
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/1"] });
      } catch (error) {
        console.error("[Swipe] Failed to create match:", error);
        // Keep showing modal but matchId will remain null (Start Chat stays disabled)
      }
    }
    
    // Trigger refetch when running low on profiles to load more from server
    if (filteredProfiles.length < 5) {
      refetch();
    }
  };

  const openModal = () => {
    setDraftAgeRange([preferences.minAge, preferences.maxAge]);
    setDraftGenderPref(preferences.genderPreference);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setPreferences({
      minAge: draftAgeRange[0],
      maxAge: draftAgeRange[1],
      genderPreference: draftGenderPref,
    });
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleReset = () => {
    setDraftAgeRange([DEFAULT_PREFERENCES.minAge, DEFAULT_PREFERENCES.maxAge]);
    setDraftGenderPref(DEFAULT_PREFERENCES.genderPreference);
    resetPreferences();
  };

  const isValid = draftAgeRange[0] >= 21 && draftAgeRange[1] <= 99 && draftAgeRange[0] <= draftAgeRange[1];

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
                max={99}
                step={1}
                value={draftAgeRange}
                onValueChange={(val) => setDraftAgeRange(val as [number, number])}
                minStepsBetweenThumbs={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Show me</Label>
              <Select value={draftGenderPref} onValueChange={(v) => setDraftGenderPref(v as "male" | "female" | "other" | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="male">Men</SelectItem>
                  <SelectItem value="female">Women</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleReset} className="mr-auto">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SwipeDeck 
        key={`${preferences.minAge}-${preferences.maxAge}-${preferences.genderPreference}`} 
        profiles={filteredProfiles} 
        onSwipe={handleSwipe} 
      />
      
      {currentMatch && (
        <MatchNotification
          profile={currentMatch.profile}
          onClose={() => setCurrentMatch(null)}
          onStartChat={() => {
            if (currentMatch.matchId) {
              console.log(`[StartChat] Navigating to chat with matchId=${currentMatch.matchId}`);
              setLocation(`/chat/${currentMatch.matchId}`);
            }
          }}
          isPending={currentMatch.matchId === null}
        />
      )}
    </div>
  );
}
