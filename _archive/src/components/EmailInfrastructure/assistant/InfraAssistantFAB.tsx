import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";

interface InfraAssistantFABProps {
  onClick: () => void;
  hasIssues?: boolean;
  issueCount?: number;
}

export default function InfraAssistantFAB({
  onClick,
  hasIssues = false,
  issueCount = 0,
}: InfraAssistantFABProps) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
      size="icon"
    >
      <MessageSquareText className="h-6 w-6" />
      {hasIssues && issueCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
          {issueCount > 9 ? '9+' : issueCount}
        </span>
      )}
    </Button>
  );
}
