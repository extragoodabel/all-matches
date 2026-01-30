import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile, Match } from "@shared/schema";
import { Heart, Settings2, MessageCircle, RotateCcw, X, Sparkles } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePreferences } from "@/hooks/use-preferences";
import { getSessionPalette } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<{ profile: Profile; matchId: number | null } | null>(null);
  
  const { preferences, setPreferences, resetPreferences, DEFAULT_PREFERENCES } = usePreferences();
  const palette = getSessionPalette();
  const patternStyle = getPatternStyle('stripes');
  
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
      
      const elapsed = Date.now() - startTime;
      const minDisplayTime = 3000;
      if (elapsed < minDisplayTime) {
        await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
      }
      
      return data;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchInterval: 30000,
  });

  const shuffledProfiles = useMemo(() => {
    if (profiles.length === 0) return [];
    const arr = [...profiles];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [profiles]);

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
      setCurrentMatch({ profile, matchId: null });
      
      try {
        console.log(`[Swipe] Creating match for profile.id=${profile.id}`);
        const response = await apiRequest("POST", "/api/matches", {
          userId: 1,
          profileId: profile.id,
        });
        const createdMatch: Match = await response.json();
        console.log(`[Swipe] Match created: match.id=${createdMatch.id}, profile.id=${profile.id}`);
        setCurrentMatch({ profile, matchId: createdMatch.id });
        queryClient.invalidateQueries({ queryKey: ["/api/inbox/1"] });
      } catch (error) {
        console.error("[Swipe] Failed to create match:", error);
      }
    }
    
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

  const genderOptions = [
    { value: "all", label: "Everyone" },
    { value: "male", label: "Men" },
    { value: "female", label: "Women" },
    { value: "other", label: "Other" },
  ];

  const isValid = draftAgeRange[0] >= 21 && draftAgeRange[1] <= 99 && draftAgeRange[0] <= draftAgeRange[1];

  return (
    <div 
      className="min-h-screen"
      style={{
        '--eg-primary': palette.primary,
        '--eg-secondary': palette.secondary,
        '--eg-accent': palette.accent,
        '--eg-background': palette.background,
        background: palette.background,
      } as React.CSSProperties}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-8 relative z-50">
          <button 
            onClick={() => setLocation("/inbox")}
            className="p-3 bg-white rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--eg-accent)] transition-all"
          >
            <MessageCircle className="w-6 h-6" style={{ color: palette.primary }} />
          </button>
          
          <div className="flex-1 text-center">
            <h1 className="eg-hero-title inline-flex items-center gap-3">
              <Heart className="w-8 h-8 md:w-10 md:h-10" style={{ color: palette.primary }} />
              <span 
                className="relative px-4 py-1"
                style={{ 
                  color: palette.background,
                  background: palette.primary,
                  boxShadow: `4px 4px 0 ${palette.accent}`,
                }}
              >
                All Matches!
              </span>
              <Sparkles className="w-7 h-7 md:w-9 md:h-9" style={{ color: palette.secondary }} />
            </h1>
            <a 
              href="https://extragood.studio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block mt-2 text-xs opacity-60 hover:opacity-100 hover:underline transition-opacity"
              style={{ 
                fontFamily: "var(--font-display)", 
                letterSpacing: '0.05em',
                color: palette.accent,
              }}
            >
              an extragood.studio production
            </a>
          </div>
          
          <button 
            onClick={openModal}
            className="p-3 bg-white rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--eg-accent)] transition-all"
          >
            <Settings2 className="w-6 h-6" style={{ color: palette.primary }} />
          </button>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
            
            <div className="relative eg-modal-content max-w-md w-full animate-in zoom-in-95">
              <div 
                className="relative overflow-hidden p-6"
                style={{ background: palette.primary }}
              >
                <div 
                  className="absolute inset-0 opacity-20"
                  style={patternStyle}
                />
                <div className="relative flex justify-between items-center">
                  <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                    Preferences
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-8" style={{ background: palette.background }}>
                <div className="space-y-4">
                  <label className="eg-label block" style={{ color: palette.accent }}>
                    Show Me
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {genderOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDraftGenderPref(opt.value as any)}
                        className={`px-5 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide transition-all ${
                          draftGenderPref === opt.value
                            ? "eg-shadow-offset-sm translate-x-0 translate-y-0"
                            : "hover:translate-x-[2px] hover:translate-y-[2px]"
                        }`}
                        style={{
                          background: draftGenderPref === opt.value ? palette.primary : 'white',
                          color: palette.accent,
                          border: `3px solid ${palette.accent}`,
                          boxShadow: draftGenderPref === opt.value ? `4px 4px 0 ${palette.accent}` : 'none',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="eg-label block" style={{ color: palette.accent }}>
                    Age Range: {draftAgeRange[0]} - {draftAgeRange[1]}
                  </label>
                  <div className="px-2">
                    <Slider
                      min={21}
                      max={99}
                      step={1}
                      value={draftAgeRange}
                      onValueChange={(val) => setDraftAgeRange(val as [number, number])}
                      minStepsBetweenThumbs={0}
                      className="py-4"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleReset}
                    className="eg-button-white rounded-full flex-1 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isValid}
                    className="eg-button rounded-full flex-1 disabled:opacity-50"
                    style={{ background: palette.primary }}
                  >
                    Save & Go
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
}
