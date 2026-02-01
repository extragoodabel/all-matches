import { useState, useMemo, useEffect } from "react";
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
  const [imageSrc, setImageSrc] = useState(profile.imageUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset loading state when profile changes
  useEffect(() => {
    setImageSrc(profile.imageUrl);
    setIsLoaded(false);
    setHasError(false);
  }, [profile.id, profile.imageUrl]);

  const isAd = isAdProfile(profile);
  const theme = useMemo(() => getProfileTheme(profile.id), [profile.id]);
  const patternStyle = useMemo(
    () => getPatternStyle(theme.patternName),
    [theme.patternName]
  );
  
  const adTheme = isAd ? {
    primary: AD_CARD_BRAND.bgColor,
    secondary: '#FFFFFF',
    accent: '#1A1A1A',
    background: '#FFFFFF',
    text: '#1A1A1A',
  } : null;

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(FALLBACK_IMAGE);
      onImageError?.();
    }
  };

  const activeTheme = adTheme || theme.palette;
  
  return (
    <div
      className="relative"
      style={{
        '--eg-primary': activeTheme.primary,
        '--eg-secondary': activeTheme.secondary,
        '--eg-accent': activeTheme.accent,
        '--eg-background': activeTheme.background,
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
              style={{ background: isAd ? AD_CARD_BRAND.bgColor : activeTheme.secondary }}
            />
          )}
          
          {/* Green background for ad card images */}
          {isAd && (
            <div 
              className="absolute inset-0"
              style={{ background: AD_CARD_BRAND.bgColor }}
            />
          )}
          <img
            src={imageSrc}
            alt={profile.name}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover select-none transition-opacity duration-200"
            style={{
              WebkitUserDrag: "none",
              userSelect: "none",
              pointerEvents: "none",
              opacity: isLoaded ? 1 : 0,
            } as React.CSSProperties}
            onDragStart={(e) => e.preventDefault()}
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
          />
          
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
          style={{ background: isAd ? AD_CARD_BRAND.bgColor : activeTheme.background }}
        >
          <h2 
            className="text-2xl md:text-3xl font-black tracking-tight"
            style={{ color: activeTheme.text }}
          >
            {isAd ? profile.name : `${profile.name}, ${profile.age}`}
          </h2>
        </div>
        
        <div 
          className="eg-caption-block flex-shrink min-h-0 overflow-y-auto"
          style={{ 
            background: isAd ? '#FFFFFF' : activeTheme.secondary,
            borderColor: activeTheme.accent,
          }}
        >
          <p 
            className="text-sm font-medium leading-relaxed"
            style={{ color: activeTheme.text }}
          >
            {profile.bio}
          </p>
        </div>
      </div>
    </div>
  );
}
