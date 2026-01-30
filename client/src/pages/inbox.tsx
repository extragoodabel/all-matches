import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle, ArrowLeft, Heart } from "lucide-react";
import { Loader2 } from "lucide-react";

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

  const { data: inboxItems = [], isLoading } = useQuery<InboxItem[]>({
    queryKey: ["/api/inbox/1"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setLocation("/")}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-pink-500" />
          Messages
        </h1>
      </div>

      {inboxItems.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No matches yet</h2>
          <p className="text-gray-500 mb-4">Start swiping to find your matches!</p>
          <button
            onClick={() => setLocation("/")}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Start Swiping
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {inboxItems.map((item) => (
            <button
              key={item.matchId}
              onClick={() => setLocation(`/chat/${item.matchId}`)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors text-left"
            >
              <img
                src={item.profile?.imageUrl || "/placeholder.png"}
                alt={item.profile?.name || "Match"}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {item.profile?.name || "Unknown"}, {item.profile?.age}
                  </h3>
                  {item.lastMessage && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTime(item.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {item.lastMessage
                    ? `${item.lastMessage.isAI ? "" : "You: "}${item.lastMessage.content}`
                    : "Say hello!"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
