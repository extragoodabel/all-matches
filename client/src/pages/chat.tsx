import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChatInterface } from "@/components/chat-interface";
import type { Message, Profile, Match } from "@shared/schema";
import { Loader2, ArrowLeft } from "lucide-react";

interface ChatProps {
  params: {
    id: string; // this is matchId from the URL
  };
}

export default function Chat({ params }: ChatProps) {
  const matchId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Get the match to find profileId
  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches/1"],
  });

  const match = matches.find((m) => m.id === matchId);
  const profileId = match?.profileId;

  // Load the profile
  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${profileId}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
    enabled: !!profileId,
  });

  // Load messages for this match
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/messages/${matchId}`],
    enabled: !!matchId,
  });

  const handleNewMessage = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/messages/${matchId}`] });
  };

  const handleBack = () => {
    setLocation("/inbox");
  };

  if (matchesLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
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
