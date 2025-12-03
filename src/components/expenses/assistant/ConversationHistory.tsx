import { useEffect } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSession } from "@/hooks/useExpenseAssistant";

interface ConversationHistoryProps {
  sessions: ConversationSession[];
  loading: boolean;
  currentSessionId: string | null;
  onLoadSessions: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
}

export default function ConversationHistory({
  sessions,
  loading,
  currentSessionId,
  onLoadSessions,
  onSelectSession,
  onNewConversation,
}: ConversationHistoryProps) {
  // Load sessions when component mounts
  useEffect(() => {
    onLoadSessions();
  }, [onLoadSessions]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button
          onClick={onNewConversation}
          className="w-full"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversation history</p>
              <p className="text-xs mt-1">Start a new conversation to get started</p>
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors",
                  "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
                  currentSessionId === session.id && "bg-muted border border-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {session.first_message || "New conversation"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                      </span>
                      <span className="text-muted-foreground/50">•</span>
                      <span>{session.message_count} messages</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
