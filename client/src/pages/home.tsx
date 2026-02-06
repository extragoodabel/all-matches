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
import { AllMatchesLogo } from "@/components/all-matches-logo";
import { Slider } from "@/components/ui/slider";
import { usePreferences } from "@/hooks/use-preferences";
import { getSessionPalette, getAccessibilityTextColor } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";
import { injectAdCards, isAdProfile, AD_CARD_BRAND } from "@/lib/ad-cards";

export default function Home() {
  const [, setLocation] = useLocation();
  const [currentMatch, setCurrentMatch] = useState<{ profile: Profile; matchId: number | null } | null>(null);
  const [bgPatternIndex] = useState(() => getRandomPatternIndex());
  
  const { preferences, setPreferences, resetPreferences, DEFAULT_PREFERENCES } = usePreferences();
  const palette = getSessionPalette();
  const appBackground = palette.background;
  const patternStyle = getPatternStyle('stripes');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [draftAgeRange, setDraftAgeRange] = useState<[number, number]>([
    preferences.minAge,
    preferences.maxAge,
  ]);
  const [secretText, setSecretText] = useState(false);
    const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [draftGenderPref, setDraftGenderPref] = useState<"male" | "female" | "other" | "all">(
    preferences.genderPreference
  );
  const [draftAccessibilityMode, setDraftAccessibilityMode] = useState(
    preferences.accessibilityMode
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

  // Filter out swiped profiles and apply preferences, then inject ad cards
  const filteredProfiles = useMemo(() => {
    const baseProfiles = profiles.filter((p) => {
      if (swipedIds.has(p.id)) return false;
      
      const ageMatch = p.age >= preferences.minAge && p.age <= preferences.maxAge;
      const genderMatch =
        preferences.genderPreference === "all" || p.gender === preferences.genderPreference;
      return ageMatch && genderMatch;
    });
    
    return injectAdCards(baseProfiles, swipedIds.size);
  }, [profiles, preferences, swipedIds]);

  const handleSwipe = async (profile: Profile, direction: "left" | "right") => {
    // Immediately mark as swiped so it never shows again
    setSwipedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(profile.id);
      return newSet;
    });
    
    // Handle ad cards differently - no server-side match creation
    if (isAdProfile(profile)) {
      if (direction === "right") {
        setCurrentMatch({ profile, matchId: -1 }); // -1 indicates ad match
      }
      return;
    }
    
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
    setDraftAccessibilityMode(preferences.accessibilityMode);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setPreferences({
      minAge: draftAgeRange[0],
      maxAge: draftAgeRange[1],
      genderPreference: draftGenderPref,
      accessibilityMode: draftAccessibilityMode,
    });
    setIsModalOpen(false);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleReset = () => {
    setDraftAgeRange([DEFAULT_PREFERENCES.minAge, DEFAULT_PREFERENCES.maxAge]);
    setDraftGenderPref(DEFAULT_PREFERENCES.genderPreference);
    setDraftAccessibilityMode(DEFAULT_PREFERENCES.accessibilityMode);
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
    <PatternBackground baseColor={appBackground} patternIndex={bgPatternIndex}>
      <div 
        className="h-dvh flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+12px)] sm:pt-0"
        style={{
          '--eg-primary': palette.primary,
          '--eg-secondary': palette.secondary,
          '--eg-accent': palette.accent,
          '--eg-background': appBackground,
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
              <button 
                className="relative p-2 select-none cursor-pointer flex items-center justify-center transition-transform duration-75 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ 
                  '--tw-ring-color': palette.primary,
                } as React.CSSProperties}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                <AllMatchesLogo 
                  variant="reactive"
                  primaryColor={palette.primary}
                  secondaryColor={palette.secondary}
                  accentColor={palette.accent}
                  className="h-10 sm:h-16 md:h-20 lg:h-24 w-auto"
                />
              </button>
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
              
              <div className="p-6 space-y-8" style={{ background: appBackground }}>
                <div className="space-y-4">
                  <label className="eg-label block" style={{ color: '#1a1a1a' }}>
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
                          color: draftGenderPref === opt.value && preferences.accessibilityMode
                            ? getAccessibilityTextColor(palette.primary)
                            : '#1a1a1a',
                          border: `3px solid #1a1a1a`,
                          boxShadow: draftGenderPref === opt.value ? `4px 4px 0 #1a1a1a` : 'none',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="eg-label block" style={{ color: '#1a1a1a' }}>
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
                
                <div className="space-y-4">
                  <label className="eg-label block" style={{ color: '#1a1a1a' }}>
                    Accessibility
                  </label>
                  <button
                    onClick={() => setDraftAccessibilityMode(!draftAccessibilityMode)}
                    className="w-full flex items-center justify-between px-5 py-3 rounded-full font-bold text-sm uppercase tracking-wide transition-all"
                    style={{
                      background: draftAccessibilityMode ? palette.primary : 'white',
                      color: '#1a1a1a',
                      border: `3px solid #1a1a1a`,
                      boxShadow: draftAccessibilityMode ? `4px 4px 0 #1a1a1a` : 'none',
                    }}
                  >
                    <span>Accessibility Mode</span>
                    <span className="text-xs">{draftAccessibilityMode ? 'ON' : 'OFF'}</span>
                  </button>
                  <p className="text-xs opacity-70" style={{ color: '#1a1a1a' }}>
                    Enables grayscale display with increased contrast for better visibility.
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleReset}
                    className="eg-button-white rounded-full flex-1 flex items-center justify-center gap-2"
                    style={{ color: '#1a1a1a' }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isValid}
                    className="eg-button rounded-full flex-1 disabled:opacity-50"
                    style={{ background: palette.primary, color: '#1a1a1a' }}
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
