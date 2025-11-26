import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import AssistantChatInterface from "./AssistantChatInterface";
import { useExpenseAssistant } from "@/hooks/useExpenseAssistant";

interface ExpenseAssistantSheetProps {
  open: boolean;
  onClose: () => void;
  onExpensesChanged?: () => void;
}

export default function ExpenseAssistantSheet({
  open,
  onClose,
  onExpensesChanged,
}: ExpenseAssistantSheetProps) {
  const {
    messages,
    loading,
    sendMessage,
    clearSession,
  } = useExpenseAssistant();

  const handleSendMessage = async (message: string, attachments?: File[]) => {
    try {
      await sendMessage(message, attachments);
      // Don't auto-refresh - user can manually refresh if needed
      // This prevents the page from reloading after each message
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleClear = () => {
    clearSession();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>AI Expense Assistant</SheetTitle>
              <SheetDescription>
                Upload statements & receipts to auto-create expenses
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <AssistantChatInterface
            messages={messages}
            loading={loading}
            onSendMessage={handleSendMessage}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
