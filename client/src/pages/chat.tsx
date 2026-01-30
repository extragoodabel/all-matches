import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChatInterface } from "@/components/chat-interface";
import type { Message, Profile, Match } from "@shared/schema";
import { Loader2, ArrowLeft } from "lucide-react";

interface MatchWithProfile {
  match: Match;
  profile: Profile;
}

interface ChatProps {
  params: {
    id: string; // this is matchId from the URL
  };
}

export default function Chat({ params }: ChatProps) {
  const matchId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch match and profile together using the dedicated endpoint
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
    retry: 3, // Retry a few times in case of race conditions
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 2000),
  });

  const match = data?.match;
  const profile = data?.profile;

  // Load messages for this match
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="mb-4">Match not found</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg"
        >
          Back to Messages
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="mb-4">Profile not found</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-pink-500 text-white rounded-lg"
        >
          Back to Messages
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-2xl h-screen flex flex-col">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img
          src={profile.imageUrl}
          alt={profile.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <h2 className="font-semibold">{profile.name}, {profile.age}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ChatInterface matchId={matchId} messages={messages} onNewMessage={handleNewMessage} />
      </div>
    </div>
  );
}
