import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "@/components/chat-interface";
import { mockProfiles } from "@/lib/mock-profiles";
import type { Message } from "@shared/schema";

interface ChatProps {
  params: {
    id: string;
  };
}

export default function Chat({ params }: ChatProps) {
  const profileId = parseInt(params.id);
  const profile = mockProfiles.find((p) => p.id === profileId);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/messages/${profileId}`],
  });

  const handleNewMessage = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/messages/${profileId}`] });
  };

  if (!profile) {
    return <div>Profile not found</div>;
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
        <ChatInterface
          matchId={profileId}
          messages={messages}
          onNewMessage={handleNewMessage}
        />
      </div>
    </div>
  );
}