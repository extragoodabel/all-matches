import { useState, useMemo, useEffect } from "react";
import { type Profile } from "@shared/schema";
import { getProfileTheme } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";
import { Sparkles } from "lucide-react";

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

  const theme = useMemo(() => getProfileTheme(profile.id), [profile.id]);
  const patternStyle = useMemo(
    () => getPatternStyle(theme.patternName),
    [theme.patternName]
  );

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImageSrc(FALLBACK_IMAGE);
      onImageError?.();
    }
  };

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
              style={{ background: theme.palette.secondary }}
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
        </div>
        
        <div 
          className="p-3 md:p-4 flex-shrink-0"
          style={{ background: theme.palette.background }}
        >
          <h2 
            className="text-2xl md:text-3xl font-black tracking-tight"
            style={{ color: theme.palette.text }}
          >
            {profile.name}, {profile.age}
          </h2>
        </div>
        
        <div 
          className="eg-caption-block flex-shrink min-h-0 overflow-y-auto"
          style={{ 
            background: theme.palette.secondary,
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
