import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, RotateCcw, History, X } from "lucide-react";
import { cn } from "@/lib/utils";
import AssistantChatInterface from "./AssistantChatInterface";
import ConversationHistory from "./ConversationHistory";
import { useExpenseAssistant } from "@/hooks/useExpenseAssistant";

export type AssistantContext = 'expenses' | 'bank_transactions';

export interface AssistantContextData {
  // For bank transactions context
  pendingCount?: number;
  categorizedCount?: number;
  recurringCount?: number;
  categories?: { id: string; name: string }[];
  // Can be extended for other contexts
}

interface ExpenseAssistantPanelProps {
  expanded?: boolean;
  onToggle?: () => void;
  onExpensesChanged?: () => void;
  context?: AssistantContext;
  contextData?: AssistantContextData;
}

export default function ExpenseAssistantPanel({
  onExpensesChanged,
  context = 'expenses',
  contextData,
}: ExpenseAssistantPanelProps) {
  const {
    messages,
    sessionId,
    loading,
    sessions,
    sessionsLoading,
    sendMessage,
    clearSession,
    loadSessions,
    loadSession,
  } = useExpenseAssistant({ context, contextData });

  // Dialog open state
  const [open, setOpen] = useState(false);
  // View state: 'chat' or 'history'
  const [view, setView] = useState<'chat' | 'history'>('chat');

  const handleSendMessage = async (message: string, attachments?: File[]) => {
    try {
      await sendMessage(message, attachments);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleClear = () => {
    clearSession();
  };

  const handleHistoryClick = () => {
    setView(view === 'history' ? 'chat' : 'history');
  };

  const handleSelectSession = (selectedSessionId: string) => {
    loadSession(selectedSessionId);
    setView('chat');
  };

  const handleNewConversation = () => {
    clearSession();
    setView('chat');
  };

  return (
    <>
      {/* Floating Action Button - Fixed to bottom-right */}
      <Button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "flex items-center justify-center z-50",
          "transition-transform hover:scale-105"
        )}
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
        {messages.length > 0 && (
          <Badge
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            variant="destructive"
          >
            {messages.length > 9 ? '9+' : messages.length}
          </Badge>
        )}
      </Button>

      {/* Chat Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg h-[600px] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="py-3 px-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-medium">AI Assistant</DialogTitle>
                {messages.length > 0 && view === 'chat' && (
                  <Badge variant="secondary" className="text-xs">
                    {messages.length}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant={view === 'history' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={handleHistoryClick}
                  className="h-8 w-8"
                  title="Conversation History"
                >
                  <History className="h-4 w-4" />
                </Button>
                {messages.length > 0 && view === 'chat' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClear}
                    className="h-8 w-8"
                    title="Clear conversation"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {view === 'chat' ? (
              <AssistantChatInterface
                messages={messages}
                loading={loading}
                onSendMessage={handleSendMessage}
              />
            ) : (
              <ConversationHistory
                sessions={sessions}
                loading={sessionsLoading}
                currentSessionId={sessionId}
                onLoadSessions={loadSessions}
                onSelectSession={handleSelectSession}
                onNewConversation={handleNewConversation}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
