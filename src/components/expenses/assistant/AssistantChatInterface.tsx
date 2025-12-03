import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import AssistantMessageBubble from "./AssistantMessageBubble";
import AssistantFileUpload from "./AssistantFileUpload";
import type { AssistantMessage } from "@/types/expenses";

interface AssistantChatInterfaceProps {
  messages: AssistantMessage[];
  loading: boolean;
  onSendMessage: (message: string, attachments?: File[]) => Promise<void>;
}

export default function AssistantChatInterface({
  messages,
  loading,
  onSendMessage,
}: AssistantChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && selectedFiles.length === 0) return;
    if (loading) return;

    const message = trimmedInput || (selectedFiles.length > 0 ? "Process these files" : "");
    const files = selectedFiles.length > 0 ? [...selectedFiles] : undefined;

    setInput("");
    setSelectedFiles([]);

    try {
      await onSendMessage(message, files);
    } catch (err) {
      console.error('Error in handleSubmit:', err);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Send className="h-8 w-8" />
            </div>
            <h3 className="font-medium text-foreground mb-2">AI Expense Assistant</h3>
            <p className="text-sm max-w-[280px]">
              Upload bank statements or receipts, and I'll help you create and categorize expenses automatically.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>Try:</p>
              <p className="text-primary">"Process this bank statement"</p>
              <p className="text-primary">"Match these receipts"</p>
              <p className="text-primary">"What expenses are pending?"</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <AssistantMessageBubble key={message.id} message={message} />
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <p className="text-sm text-muted-foreground">Processing...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* File Upload */}
      <div className="px-4 pb-2">
        <AssistantFileUpload
          selectedFiles={selectedFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={handleRemoveFile}
          disabled={loading}
        />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or upload files..."
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
            disabled={loading || (!input.trim() && selectedFiles.length === 0)}
            size="icon"
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
