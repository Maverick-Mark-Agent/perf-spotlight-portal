import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RotateCcw, Server } from "lucide-react";
import InfraAssistantChat from "./InfraAssistantChat";
import type { InfraAssistantMessage } from "@/types/infraAssistant";

interface InfraAssistantSheetProps {
  isOpen: boolean;
  onClose: () => void;
  messages: InfraAssistantMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onClearHistory: () => void;
  detectedIssues?: { type: string; severity: string; message: string }[];
}

export default function InfraAssistantSheet({
  isOpen,
  onClose,
  messages,
  isLoading,
  onSendMessage,
  onClearHistory,
}: InfraAssistantSheetProps) {
  const handleSendMessage = async (message: string) => {
    try {
      await onSendMessage(message);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleClear = () => {
    onClearHistory();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Server className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-base">Infrastructure Assistant</SheetTitle>
                <SheetDescription className="text-xs">
                  AI-powered email infrastructure support
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-muted-foreground h-8 px-2"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  New
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <InfraAssistantChat
            messages={messages}
            loading={isLoading}
            onSendMessage={handleSendMessage}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
