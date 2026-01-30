import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChatInterface } from "@/components/chat-interface";
import { PatternBackground } from "@/components/pattern-background";
import type { Message, Profile, Match } from "@shared/schema";
import { ArrowLeft, Sparkles, Heart } from "lucide-react";
import { getProfileTheme } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";

interface MatchWithProfile {
  match: Match;
  profile: Profile;
}

interface ChatProps {
  params: {
    id: string;
  };
}

export default function Chat({ params }: ChatProps) {
  const matchId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<MatchWithProfile>({
    queryKey: ["/api/matches/by-id", matchId],
    queryFn: async () => {
      console.log(`[Chat] Fetching match by id: ${matchId}`);
      const res = await fetch(`/api/matches/by-id/${matchId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Chat] Failed to fetch match ${matchId}:`, errorData);
        throw new Error(errorData.error || "Match not found");
      }
      const data = await res.json();
      console.log(`[Chat] Got match data:`, { matchId: data.match?.id, profileName: data.profile?.name });
      return data;
    },
    enabled: !isNaN(matchId),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 2000),
  });

  const match = data?.match;
  const profile = data?.profile;

  const theme = useMemo(
    () => profile ? getProfileTheme(profile.id) : null,
    [profile?.id]
  );
  
  const patternStyle = useMemo(
    () => theme ? getPatternStyle(theme.patternName) : {},
    [theme?.patternName]
  );

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/messages/${matchId}`],
    enabled: !!matchId && !!match,
  });

  const handleNewMessage = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/messages/${matchId}`] });
  };

  const handleBack = () => {
    setLocation("/inbox");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#FFF8E7' }}>
        <div className="flex gap-2">
          <Heart className="w-8 h-8 text-[#FF1493] eg-bounce" style={{ animationDelay: '0ms' }} />
          <Sparkles className="w-8 h-8 text-[#FFDC00] eg-bounce" style={{ animationDelay: '150ms' }} />
          <Heart className="w-8 h-8 text-[#FF1493] eg-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-xl font-bold">Loading chat<span className="eg-loading-dots" /></p>
      </div>
    );
  }

  if (error || !match || !profile || !theme) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: '#FFF8E7' }}
      >
        <div className="eg-card p-8 text-center max-w-sm">
          <p className="text-xl font-bold mb-6">Match not found</p>
          <button
            onClick={handleBack}
            className="eg-button rounded-full"
          >
            Back to Messages
          </button>
        </div>
      </div>
    );
  }

  return (
    <PatternBackground baseColor={theme.palette.background}>
      <div 
        className="min-h-screen flex flex-col"
        style={{
          '--eg-primary': theme.palette.primary,
          '--eg-secondary': theme.palette.secondary,
          '--eg-accent': theme.palette.accent,
          '--eg-background': theme.palette.background,
        } as React.CSSProperties}
      >
      <div 
        className="relative overflow-hidden"
        style={{ background: theme.palette.primary }}
      >
        <div 
          className="absolute inset-0 opacity-20"
          style={patternStyle}
        />
        
        <div className="relative container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-full object-cover border-3 border-white"
            style={{ border: '3px solid white' }}
          />
          
          <div className="flex-1">
            <h2 className="font-bold text-white text-lg">
              {profile.name}, {profile.age}
            </h2>
            {profile.isChaos && (
              <div className="flex items-center gap-1 text-white/80 text-sm">
                <Sparkles className="w-3 h-3" />
                <span>Chaos Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

        <div className="flex-1 container mx-auto px-4 py-4 max-w-2xl flex flex-col overflow-hidden">
          <ChatInterface matchId={matchId} messages={messages} onNewMessage={handleNewMessage} />
        </div>
      </div>
    </PatternBackground>
  );
}
