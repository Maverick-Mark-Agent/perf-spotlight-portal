import { Bot, User, CheckCircle, AlertCircle, XCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AssistantMessage, AssistantActionsTaken } from "@/types/expenses";

interface AssistantMessageBubbleProps {
  message: AssistantMessage;
}

export default function AssistantMessageBubble({ message }: AssistantMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
      `}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`
          inline-block rounded-lg px-4 py-2
          ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
        `}>
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-1 mb-2 ${isUser ? 'justify-end' : ''}`}>
              {message.attachments.map((att, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {att.file_name}
                </Badge>
              ))}
            </div>
          )}

          {/* Message Text */}
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>

        {/* Actions Taken */}
        {message.metadata && !isUser && (
          <ActionsSummary actions={message.metadata} />
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function ActionsSummary({ actions }: { actions: AssistantActionsTaken }) {
  const hasActions =
    (actions.expenses_created?.length || 0) > 0 ||
    (actions.expenses_matched?.length || 0) > 0 ||
    (actions.duplicates_skipped?.length || 0) > 0 ||
    (actions.items_needing_review?.length || 0) > 0;

  if (!hasActions) return null;

  return (
    <div className="mt-2 space-y-1">
      {/* Created */}
      {actions.expenses_created && actions.expenses_created.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle className="h-3 w-3" />
          <span>{actions.expenses_created.length} expense{actions.expenses_created.length > 1 ? 's' : ''} created</span>
        </div>
      )}

      {/* Matched */}
      {actions.expenses_matched && actions.expenses_matched.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <CheckCircle className="h-3 w-3" />
          <span>{actions.expenses_matched.length} receipt{actions.expenses_matched.length > 1 ? 's' : ''} matched</span>
        </div>
      )}

      {/* Skipped */}
      {actions.duplicates_skipped && actions.duplicates_skipped.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600">
          <AlertCircle className="h-3 w-3" />
          <span>{actions.duplicates_skipped.length} duplicate{actions.duplicates_skipped.length > 1 ? 's' : ''} skipped</span>
        </div>
      )}

      {/* Needs Review */}
      {actions.items_needing_review && actions.items_needing_review.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <XCircle className="h-3 w-3" />
          <span>{actions.items_needing_review.length} item{actions.items_needing_review.length > 1 ? 's' : ''} need review</span>
        </div>
      )}
    </div>
  );
}
