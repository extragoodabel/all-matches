import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "@/components/chat-interface";
import type { Message, Profile, Match } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface ChatProps {
  params: {
    id: string; // this is profileId from the URL
  };
}

export default function Chat({ params }: ChatProps) {
  const profileId = parseInt(params.id);
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/profiles", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${profileId}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
  });

  // Find (or create) the match for this profile
  const { data: matches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches/1"],
  });

  const match = matches.find((m) => m.profileId === profileId);
  const matchId = match?.id;

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: matchId ? [`/api/messages/${matchId}`] : ["__no_match__"],
    enabled: !!matchId,
  });

  const handleNewMessage = () => {
    if (matchId) queryClient.invalidateQueries({ queryKey: [`/api/messages/${matchId}`] });
  };

  if (profileLoading || matchesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <div className="container mx-auto px-4 py-8 text-center">Profile not found</div>;
  }

  if (!matchId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        No match found for this profile yet. Go back and swipe right first.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <h2 className="text-2xl font-bold">{profile.name}</h2>
        </div>

        <ChatInterface matchId={matchId} messages={messages} onNewMessage={handleNewMessage} />
      </div>
    </div>
  );
}
