import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle, ArrowLeft, Heart, Sparkles } from "lucide-react";
import { getSessionPalette, getProfileTheme } from "@/styles/theme";
import { getPatternStyle } from "@/styles/patterns";

interface InboxItem {
  matchId: number;
  profileId: number;
  createdAt: string;
  profile: {
    name: string;
    age: number;
    imageUrl: string;
  } | null;
  lastMessage: {
    content: string;
    isAI: boolean;
    createdAt: string;
  } | null;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const palette = getSessionPalette();
  const patternStyle = getPatternStyle('dots');

  const { data: inboxItems = [], isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/inbox/1"],
  });

  if (isLoading) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: palette.background }}
      >
        <div className="flex gap-2">
          <MessageCircle className="w-8 h-8 eg-bounce" style={{ color: palette.primary, animationDelay: '0ms' }} />
          <Heart className="w-8 h-8 eg-bounce" style={{ color: palette.secondary, animationDelay: '150ms' }} />
          <MessageCircle className="w-8 h-8 eg-bounce" style={{ color: palette.primary, animationDelay: '300ms' }} />
        </div>
        <p className="text-xl font-bold">Loading messages<span className="eg-loading-dots" /></p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        '--eg-primary': palette.primary,
        '--eg-secondary': palette.secondary,
        '--eg-accent': palette.accent,
        background: palette.background,
      } as React.CSSProperties}
    >
      <div 
        className="relative overflow-hidden"
        style={{ background: palette.primary }}
      >
        <div 
          className="absolute inset-0 opacity-20"
          style={patternStyle}
        />
        
        <div className="relative container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <h1 className="text-2xl font-black text-white uppercase tracking-wide flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            Messages
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {inboxItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="eg-card inline-block p-8">
              <Heart className="w-16 h-16 mx-auto mb-4" style={{ color: palette.primary }} />
              <h2 className="text-xl font-bold mb-2">No matches yet</h2>
              <p className="text-gray-600 mb-6">Start swiping to find your matches!</p>
              <button
                onClick={() => setLocation("/")}
                className="eg-button rounded-full"
                style={{ background: palette.primary }}
              >
                Start Swiping
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxItems.map((item) => {
              const itemTheme = getProfileTheme(item.profileId);
              return (
                <button
                  key={item.matchId}
                  onClick={() => setLocation(`/chat/${item.matchId}`)}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-xl eg-outline-thick eg-shadow-offset-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--eg-accent)] transition-all text-left"
                >
                  <div className="relative">
                    <img
                      src={item.profile?.imageUrl || "/placeholder.png"}
                      alt={item.profile?.name || "Match"}
                      className="w-14 h-14 rounded-full object-cover"
                      style={{ border: `3px solid ${itemTheme.palette.primary}` }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">
                        {item.profile?.name || "Unknown"}, {item.profile?.age}
                      </h3>
                      {item.lastMessage && (
                        <span 
                          className="text-xs font-bold px-2 py-1 rounded-full"
                          style={{ 
                            background: itemTheme.palette.secondary,
                            color: itemTheme.palette.accent,
                          }}
                        >
                          {formatTime(item.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {item.lastMessage
                        ? `${item.lastMessage.isAI ? "" : "You: "}${item.lastMessage.content}`
                        : "Say hello!"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
