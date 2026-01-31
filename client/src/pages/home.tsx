import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchNotification } from "@/components/match-notification";
import { PatternBackground, getRandomPatternIndex } from "@/components/pattern-background";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Profile, Match } from "@shared/schema";
import { Settings2, MessageCircle, RotateCcw, X, Heart } from "lucide-react";
import { HeartKiss, StarFirework } from "@/components/easter-eggs";
import { Slider } from "@/components/ui/slider";
import { usePreferences } from "@/hooks/use-preferences";
import { getSessionPalette } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<{ profile: Profile; matchId: number | null } | null>(null);
  const [bgPatternIndex] = useState(() => getRandomPatternIndex());
  
  const { preferences, setPreferences, resetPreferences, DEFAULT_PREFERENCES } = usePreferences();
  const palette = getSessionPalette();
  const patternStyle = getPatternStyle('stripes');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [draftAgeRange, setDraftAgeRange] = useState<[number, number]>([
    preferences.minAge,
    preferences.maxAge,
  ]);
  const [secretText, setSecretText] = useState(false);
  const [headerPressed, setHeaderPressed] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [draftGenderPref, setDraftGenderPref] = useState<"male" | "female" | "other" | "all">(
    preferences.genderPreference
  );

  // Track swiped profile IDs to never show them again
  const [swipedIds, setSwipedIds] = useState<Set<number>>(new Set());
  
  const isInitialLoadRef = useRef(true);
  
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
      
      // Only show loading animation on initial load, not on refetches
      if (isInitialLoadRef.current && data.length > 0) {
        const elapsed = Date.now() - startTime;
        const minDisplayTime = 2000;
        if (elapsed < minDisplayTime) {
          await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
        }
        isInitialLoadRef.current = false;
      }
      
      return data;
    },
    staleTime: 0, // Always refetch when called
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });

  // Filter out swiped profiles and apply preferences
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Never show swiped profiles again
      if (swipedIds.has(p.id)) return false;
      
      const ageMatch = p.age >= preferences.minAge && p.age <= preferences.maxAge;
      const genderMatch =
        preferences.genderPreference === "all" || p.gender === preferences.genderPreference;
      return ageMatch && genderMatch;
    });
  }, [profiles, preferences, swipedIds]);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    // Immediately mark as swiped so it never shows again
    setSwipedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(profile.id);
      return newSet;
    });
    
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
    } else {
      try {
        await apiRequest("POST", "/api/reject", {
          userId: 1,
          profileId: profile.id,
        });
      } catch (error) {
        console.error("[Swipe] Failed to record rejection:", error);
      }
    }
    
    // Only refetch when running very low on profiles
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
    <PatternBackground baseColor={palette.background} patternIndex={bgPatternIndex}>
      <div 
        className="h-dvh flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+12px)] sm:pt-0"
        style={{
          '--eg-primary': palette.primary,
          '--eg-secondary': palette.secondary,
          '--eg-accent': palette.accent,
          '--eg-background': palette.background,
        } as React.CSSProperties}
      >
        {/* Centered easter egg overlay */}
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-300"
          style={{ opacity: secretText ? 1 : 0 }}
        >
          <span 
            className="px-4 sm:px-6 py-2 sm:py-3 text-xl sm:text-3xl md:text-4xl font-black tracking-wider uppercase"
            style={{ 
              color: palette.background,
              background: palette.primary,
              boxShadow: `6px 6px 0 ${palette.accent}`,
              transform: secretText ? 'scale(1)' : 'scale(0.8)',
              transition: 'transform 0.3s ease-out',
            }}
          >
            Dopamine Vending Machine
          </span>
        </div>
        <div className="flex-shrink-0 px-4 sm:px-4 pt-3 pb-2">
        <div className="flex justify-between items-center relative z-50 gap-3">
          <button 
            onClick={() => setLocation("/inbox")}
            className="flex-shrink-0 p-3 bg-white rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--eg-accent)] transition-all"
          >
            <MessageCircle className="w-6 h-6" style={{ color: palette.primary }} />
          </button>
          
          <div className="flex-1 text-center min-w-0">
            <h1 className="eg-hero-title inline-flex items-center gap-1 sm:gap-3 whitespace-nowrap !text-xl sm:!text-4xl md:!text-5xl lg:!text-6xl">
              <HeartKiss color={palette.primary} accentColor={palette.accent} />
              <span 
                className="relative px-2 sm:px-4 py-0.5 sm:py-1 select-none cursor-pointer transition-transform duration-75"
                style={{ 
                  color: palette.background,
                  background: palette.primary,
                  boxShadow: headerPressed ? `2px 2px 0 ${palette.accent}` : `4px 4px 0 ${palette.accent}`,
                  transform: headerPressed ? 'translate(2px, 2px)' : 'translate(0, 0)',
                }}
                onMouseDown={() => setHeaderPressed(true)}
                onMouseUp={() => setHeaderPressed(false)}
                onMouseLeave={() => setHeaderPressed(false)}
                onTouchStart={() => setHeaderPressed(true)}
                onTouchEnd={() => setHeaderPressed(false)}
                onClick={() => {
                  if (secretText) return;
                  tapCountRef.current += 1;
                  if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
                  tapTimeoutRef.current = setTimeout(() => {
                    tapCountRef.current = 0;
                  }, 1000);
                  if (tapCountRef.current >= 5) {
                    setSecretText(true);
                    tapCountRef.current = 0;
                    setTimeout(() => setSecretText(false), 1500);
                  }
                }}
              >
                All Matches!
              </span>
              <StarFirework color={palette.primary} secondaryColor={palette.secondary} />
            </h1>
            <a 
              href="https://extragood.studio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block mt-2 text-sm md:text-base opacity-60 hover:opacity-100 hover:underline transition-opacity"
              style={{ 
                fontFamily: "var(--font-display)", 
                letterSpacing: '0.08em',
                color: palette.accent,
              }}
            >
              an extragood.studio production
            </a>
          </div>
          
          <button 
            onClick={openModal}
            className="flex-shrink-0 p-3 bg-white rounded-full eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--eg-accent)] transition-all"
          >
            <Settings2 className="w-6 h-6" style={{ color: palette.primary }} />
          </button>
        </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-4 pt-2 sm:pt-0">
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
          onNeedsMore={refetch}
        />
        </div>
        
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
    </PatternBackground>
  );
}
