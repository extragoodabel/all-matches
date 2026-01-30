import { useMemo } from "react";
import { type Profile } from "@shared/schema";
import { Heart, Loader2, Sparkles, X } from "lucide-react";
import { getProfileTheme } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";
import { DopamineConfetti } from "./dopamine-confetti";

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
  const theme = useMemo(() => getProfileTheme(profile.id), [profile.id]);
  const patternStyle = useMemo(
    () => getPatternStyle(theme.patternName),
    [theme.patternName]
  );

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
        onClick={onClose}
      />
      
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative eg-modal-content max-w-sm w-full animate-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
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
            <button
              onClick={onClose}
              className="eg-button-white flex-1 rounded-full"
            >
              Keep Swiping
            </button>
            <button
              onClick={onStartChat}
              disabled={isPending}
              className="eg-button flex-1 rounded-full disabled:opacity-50"
              style={{ background: theme.palette.primary }}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Start Chat"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
