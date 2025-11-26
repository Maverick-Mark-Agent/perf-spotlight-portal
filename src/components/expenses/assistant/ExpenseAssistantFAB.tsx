import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";

interface ExpenseAssistantFABProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export default function ExpenseAssistantFAB({
  onClick,
  hasUnread = false,
}: ExpenseAssistantFABProps) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50"
      size="icon"
    >
      <Bot className="h-6 w-6" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
      )}
    </Button>
  );
}
