import { useState, useMemo, useEffect, useRef } from "react";
import { type Profile } from "@shared/schema";
import { getProfileTheme } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";
import { Sparkles } from "lucide-react";
import { isAdProfile, AD_CARD_BRAND } from "@/lib/ad-cards";

interface ProfileCardProps {
  profile: Profile;
  onImageError?: () => void;
}

const FALLBACK_IMAGE = "/images/fallback.png";

export function ProfileCard({ profile, onImageError }: ProfileCardProps) {
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const onImageErrorRef = useRef(onImageError);
  onImageErrorRef.current = onImageError;

  // Preload image before displaying - keeps previous image visible until new one loads
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setDisplayedImage(profile.imageUrl);
      setHasError(false);
    };
    img.onerror = () => {
      setDisplayedImage(FALLBACK_IMAGE);
      setHasError(true);
      onImageErrorRef.current?.();
    };
    img.src = profile.imageUrl;
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [profile.id, profile.imageUrl]);
  
  const isLoaded = displayedImage !== null;

  const isAd = isAdProfile(profile);
  const baseTheme = useMemo(() => getProfileTheme(Math.abs(profile.id)), [profile.id]);
  
  const adPalette = {
    primary: AD_CARD_BRAND.bgColor,
    secondary: '#FFFFFF',
    accent: '#1A1A1A',
    background: '#FFFFFF',
    text: '#1A1A1A',
  };
  
  const theme = isAd 
    ? { palette: adPalette, patternName: 'checker' as const }
    : baseTheme;
    
  const patternStyle = useMemo(
    () => getPatternStyle(theme.patternName),
    [theme.patternName]
  );

  
  return (
    <div
      className="relative"
      style={{
        '--eg-primary': theme.palette.primary,
        '--eg-secondary': theme.palette.secondary,
        '--eg-accent': theme.palette.accent,
        '--eg-background': theme.palette.background,
      } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 -z-10 rounded-2xl"
        style={{
          ...patternStyle,
          transform: 'rotate(-2deg) scale(1.05)',
        }}
      />
      
      <div className="eg-card w-full max-w-sm mx-auto select-none flex flex-col max-h-full">
        <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: '3/4', maxHeight: 'min(55vh, 400px)' }}>
          {/* Loading placeholder */}
          {!isLoaded && (
            <div 
              className="absolute inset-0 animate-pulse"
              style={{ background: isAd ? AD_CARD_BRAND.bgColor : theme.palette.secondary }}
            />
          )}
          
          {/* Green background for ad card images */}
          {isAd && (
            <div 
              className="absolute inset-0"
              style={{ background: AD_CARD_BRAND.bgColor }}
            />
          )}
          {displayedImage && (
            <img
              src={displayedImage}
              alt={profile.name}
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover select-none"
              style={{
                WebkitUserDrag: "none",
                userSelect: "none",
                pointerEvents: "none",
              } as React.CSSProperties}
              onDragStart={(e) => e.preventDefault()}
            />
          )}
          
          {profile.isChaos && (
            <div 
              className="absolute top-3 right-3 px-3 py-1.5 rounded-full eg-outline-thick flex items-center gap-1.5 font-bold text-sm uppercase tracking-wide"
              style={{ background: theme.palette.secondary }}
            >
              <Sparkles className="w-4 h-4" />
              Chaos
            </div>
          )}
          
          {isAdProfile(profile) && (
            <div 
              className="absolute top-3 right-3 px-3 py-1 rounded-sm font-bold text-xs uppercase tracking-wider border-2 border-[#1A1A1A]"
              style={{ 
                background: 'rgba(255, 255, 255, 0.9)',
                fontFamily: "'Space Grotesk', sans-serif",
                transform: 'rotate(3deg)',
              }}
            >
              Ad
            </div>
          )}
        </div>
        
        <div 
          className="p-3 md:p-4 flex-shrink-0"
          style={{ background: isAd ? '#FFFFFF' : theme.palette.background }}
        >
          <h2 
            className="text-2xl md:text-3xl font-black tracking-tight"
            style={{ color: theme.palette.text }}
          >
            {isAd ? profile.name : `${profile.name}, ${profile.age}`}
          </h2>
        </div>
        
        <div 
          className="eg-caption-block flex-shrink min-h-0 overflow-y-auto"
          style={{ 
            background: isAd ? AD_CARD_BRAND.bgColor : theme.palette.secondary,
            borderColor: theme.palette.accent,
          }}
        >
          <p 
            className="text-sm font-medium leading-relaxed"
            style={{ color: theme.palette.text }}
          >
            {profile.bio}
          </p>
        </div>
      </div>
    </div>
  );
}
