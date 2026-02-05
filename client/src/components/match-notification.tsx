import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { type Profile } from "@shared/schema";
import { Heart, Loader2, Sparkles, X, ExternalLink } from "lucide-react";
import { getProfileTheme, getContrastTextColor } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";
import { DopamineConfetti } from "./dopamine-confetti";
import { isAdProfile, AD_CARD_BRAND } from "@/lib/ad-cards";

const COUNTDOWN_DURATION = 5000;

interface MatchNotificationProps {
  profile: Profile;
  onClose: () => void;
  onStartChat: () => void;
  isPending?: boolean;
}

export function MatchNotification({
  profile,
  onClose,
  onStartChat,
  isPending = false,
}: MatchNotificationProps) {
  const isAd = isAdProfile(profile);
  const baseTheme = useMemo(() => getProfileTheme(Math.abs(profile.id)), [profile.id]);
  const [progress, setProgress] = useState(1);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerCancelledRef = useRef(false);
  
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

  const cancelTimer = useCallback(() => {
    timerCancelledRef.current = true;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    cancelTimer();
    onClose();
  }, [cancelTimer, onClose]);

  const handleStartChat = useCallback(() => {
    cancelTimer();
    onStartChat();
  }, [cancelTimer, onStartChat]);

  useEffect(() => {
    timerCancelledRef.current = false;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (timerCancelledRef.current || startTimeRef.current === null) return;

      const elapsed = currentTime - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / COUNTDOWN_DURATION);
      
      setProgress(remaining);

      if (remaining > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onClose();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelTimer();
    };
  }, [onClose, cancelTimer]);

  const ringRadius = 22;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progress);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        '--eg-primary': theme.palette.primary,
        '--eg-secondary': theme.palette.secondary,
        '--eg-accent': theme.palette.accent,
      } as React.CSSProperties}
    >
      <DopamineConfetti />
      
      <div 
        className="absolute inset-0"
        style={{
          ...patternStyle,
          opacity: 0.3,
        }}
        onClick={handleClose}
      />
      
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative eg-modal-content max-w-sm w-full animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors eg-outline"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div 
          className="p-8 text-center relative overflow-hidden"
          style={{ background: theme.palette.primary }}
        >
          <div 
            className="absolute inset-0 opacity-20"
            style={patternStyle}
          />
          
          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Heart className="w-8 h-8 text-white eg-bounce" style={{ animationDelay: '0ms' }} />
              <Sparkles className="w-6 h-6 text-white eg-bounce" style={{ animationDelay: '100ms' }} />
              <Heart className="w-8 h-8 text-white eg-bounce" style={{ animationDelay: '200ms' }} />
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
              It's a Match!
            </h2>
          </div>
        </div>
        
        <div className="p-6 flex flex-col items-center gap-6" style={{ background: theme.palette.background }}>
          <div className="relative">
            <img
              src={profile.imageUrl}
              alt={profile.name}
              className="w-28 h-28 rounded-full object-cover eg-outline-thick"
            />
            <div 
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full eg-outline text-sm font-bold uppercase"
              style={{ background: theme.palette.secondary }}
            >
              {profile.name}
            </div>
          </div>
          
          <p className="text-lg font-semibold text-center">
            You and <span className="font-bold">{profile.name}</span> liked each other!
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            {isAdProfile(profile) ? (
              <a
                href={AD_CARD_BRAND.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cancelTimer}
                className="flex-1 rounded-full flex items-center justify-center gap-2 px-6 py-3 font-bold uppercase tracking-wide eg-outline border-2 transition-colors hover:opacity-90"
                style={{ 
                  background: 'transparent',
                  borderColor: AD_CARD_BRAND.bgColor,
                  color: AD_CARD_BRAND.bgColor,
                }}
              >
                Connect
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button
                onClick={handleStartChat}
                disabled={isPending}
                className="flex-1 rounded-full px-6 py-3 font-bold uppercase tracking-wide border-2 transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ 
                  background: 'transparent',
                  borderColor: theme.palette.primary,
                  color: theme.palette.primary,
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Saving...
                  </>
                ) : (
                  "Start Chat"
                )}
              </button>
            )}
            <div className="flex-1 relative">
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 50"
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }}
              >
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="46"
                  rx="23"
                  ry="23"
                  fill="none"
                  stroke={getContrastTextColor(theme.palette.primary)}
                  strokeWidth="3"
                  strokeOpacity="0.3"
                />
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="46"
                  rx="23"
                  ry="23"
                  fill="none"
                  stroke={getContrastTextColor(theme.palette.primary)}
                  strokeWidth="3"
                  strokeDasharray={`${280 * progress} 280`}
                  style={{
                    transition: 'stroke-dasharray 16ms linear',
                  }}
                />
              </svg>
              <button
                onClick={handleClose}
                className="w-full rounded-full px-6 py-3 font-bold uppercase tracking-wide eg-outline transition-colors hover:opacity-90"
                style={{ 
                  background: theme.palette.primary,
                  color: getContrastTextColor(theme.palette.primary),
                }}
              >
                Keep Swiping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
