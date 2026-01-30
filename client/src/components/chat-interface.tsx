import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ChatInterface({
  matchId,
  messages,
  onNewMessage,
}: {
  matchId: number;
  messages: Message[];
  onNewMessage: () => void;
}) {
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const threadKey = useMemo(() => [`/api/messages/${matchId}`], [matchId]);

  // Typing bubble heuristic:
  // if last message is from user and we do not yet have a later AI message, show bubble.
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
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: threadKey });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Message[]>(threadKey) || [];

      // Optimistically add the user's message so it appears immediately
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

      // Poll a few times so the delayed AI reply appears without user refreshing.
      // This avoids the "stuck typing forever" feeling.
      const start = Date.now();
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: threadKey });

        if (Date.now() - start > 9000) {
          clearInterval(interval);
        }
      }, 900);

      // Safety cleanup
      setTimeout(() => clearInterval(interval), 10000);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, showTyping]);

  return (
    <div className="border rounded-lg p-4">
      <div className="h-[60vh] overflow-y-auto space-y-3 pr-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.isAI ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.isAI ? "bg-muted" : "bg-primary text-primary-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {showTyping && (
          <div className="flex justify-start">
            <div className="max-w-[60%] rounded-2xl px-3 py-2 text-sm bg-muted">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">•</span>
                <span className="animate-bounce [animation-delay:120ms]">•</span>
                <span className="animate-bounce [animation-delay:240ms]">•</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          if (sendMutation.isPending) return;
          sendMutation.mutate(trimmed);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
        />
        <Button type="submit" disabled={sendMutation.isPending}>
          Send
        </Button>
      </form>
    </div>
  );
}
