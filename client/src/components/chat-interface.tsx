import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { type Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ChatInterfaceProps {
  matchId: number;
  messages: Message[];
  onNewMessage: () => void;
}

export function ChatInterface({ matchId, messages, onNewMessage }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      await apiRequest("POST", "/api/messages", {
        matchId,
        content: message,
        isAI: false,
      });
      setMessage("");
      onNewMessage();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isAI ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                msg.isAI
                  ? "bg-gray-100 text-gray-900"
                  : "bg-blue-500 text-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </CardContent>
      <div className="p-4 border-t flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
