import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Send } from "lucide-react";
import { getContrastTextColor, COLORS } from "@/styles/theme";

interface ChatTheme {
  primary: string;
  secondary: string;
  accent: string;
}

export function ChatInterface({
  matchId,
  messages,
  onNewMessage,
  theme,
}: {
  matchId: number;
  messages: Message[];
  onNewMessage: () => void;
  theme?: ChatTheme;
}) {
  const primaryBg = theme?.primary || '#FF1493';
  const secondaryBg = theme?.secondary || '#FFDC00';
  const accentColor = theme?.accent || COLORS.ink;
  
  const userTextColor = getContrastTextColor(primaryBg);
  const aiTextColor = getContrastTextColor(secondaryBg);
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threadKey = useMemo(() => [`/api/messages/${matchId}`], [matchId]);

  const showTyping = useMemo(() => {
    if (!messages.length) return false;
    const last = messages[messages.length - 1];
    if (last.isAI) return false;
    return true;
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/messages", {
        matchId,
        content,
        isAI: false,
      });
      return res.json();
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: threadKey });
      const previous = queryClient.getQueryData<Message[]>(threadKey) || [];
      const optimistic: Message = {
        id: Date.now(),
        matchId,
        content,
        isAI: false,
        createdAt: new Date(),
      } as any;
      queryClient.setQueryData<Message[]>(threadKey, [...previous, optimistic]);
      setText("");
      return { previous };
    },
    onError: (_err, _content, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(threadKey, ctx.previous);
    },
    onSuccess: () => {
      onNewMessage();
      const start = Date.now();
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: threadKey });
        if (Date.now() - start > 9000) {
          clearInterval(interval);
        }
      }, 900);
      setTimeout(() => clearInterval(interval), 10000);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, showTyping]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 px-2 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 font-medium">Say hi to start the conversation!</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.isAI ? "justify-start" : "justify-end"}`}
          >
            <div 
              className={`rounded-2xl px-4 py-3 max-w-[80%] ${m.isAI ? "rounded-bl-sm" : "rounded-br-sm"}`}
              style={{
                background: m.isAI ? secondaryBg : primaryBg,
                color: m.isAI ? aiTextColor : userTextColor,
                border: `2px solid ${accentColor}`,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {showTyping && (
          <div className="flex justify-start">
            <div 
              className="rounded-2xl rounded-bl-sm px-4 py-4 flex items-center gap-1.5"
              style={{
                background: secondaryBg,
                border: `2px solid ${accentColor}`,
              }}
            >
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor, animationDelay: '-0.32s' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor, animationDelay: '-0.16s' }} />
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="pt-4 border-t-2 border-[var(--eg-accent)] flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          if (sendMutation.isPending) return;
          sendMutation.mutate(trimmed);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 rounded-full eg-outline bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--eg-primary)]"
        />
        <button 
          type="submit" 
          disabled={sendMutation.isPending || !text.trim()}
          className="rounded-full px-4 py-3 disabled:opacity-50 transition-all font-bold"
          style={{
            background: primaryBg,
            color: userTextColor,
            border: `2px solid ${accentColor}`,
          }}
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
