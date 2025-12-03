import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import InfraMessageBubble from "./InfraMessageBubble";
import type { InfraAssistantMessage } from "@/types/infraAssistant";

interface InfraAssistantChatProps {
  messages: InfraAssistantMessage[];
  loading: boolean;
  onSendMessage: (message: string) => Promise<void>;
}

const QUICK_ACTIONS = [
  { label: "Show issues", message: "What issues need attention right now?" },
  { label: "Get metrics", message: "Show me the overall infrastructure metrics" },
  { label: "Disconnected accounts", message: "Show me all disconnected accounts" },
  { label: "High bounce rate", message: "Which accounts have high bounce rates?" },
];

export default function InfraAssistantChat({
  messages,
  loading,
  onSendMessage,
}: InfraAssistantChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    setInput("");

    try {
      await onSendMessage(trimmedInput);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
    }
  };

  const handleQuickAction = async (message: string) => {
    if (loading) return;
    try {
      await onSendMessage(message);
    } catch (err) {
      console.error('Error in quick action:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
              <MessageSquareText className="h-8 w-8 text-white" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Email Infrastructure Assistant</h3>
            <p className="text-sm max-w-[280px] mb-6">
              I can help you monitor and troubleshoot your email sending infrastructure. Ask me about issues, metrics, or how to fix problems.
            </p>

            {/* Quick Actions */}
            <div className="w-full max-w-[320px] space-y-2">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" /> Quick actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3"
                    onClick={() => handleQuickAction(action.message)}
                    disabled={loading}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <InfraMessageBubble key={message.id} message={message} />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Analyzing infrastructure...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your email infrastructure..."
            disabled={loading}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            size="icon"
            className="bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
