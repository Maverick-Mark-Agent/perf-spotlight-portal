import { Bot, User, AlertTriangle, CheckCircle, AlertCircle, Info, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InfraAssistantMessage, InfraIssue } from "@/types/infraAssistant";
import ReactMarkdown from 'react-markdown';

interface InfraMessageBubbleProps {
  message: InfraAssistantMessage;
}

export default function InfraMessageBubble({ message }: InfraMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'}
      `}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className={`
          inline-block rounded-lg px-4 py-2 text-left
          ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
        `}>
          {/* Intent Badge */}
          {message.intent && !isUser && message.intent !== 'general_question' && (
            <div className="mb-2">
              <Badge variant="outline" className="text-xs capitalize">
                {message.intent.replace(/_/g, ' ')}
              </Badge>
            </div>
          )}

          {/* Message Text with Markdown */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="whitespace-pre-wrap text-sm mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 text-sm">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 text-sm">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                h1: ({ children }) => <h3 className="font-bold text-base mt-2 mb-1">{children}</h3>,
                h2: ({ children }) => <h4 className="font-bold text-sm mt-2 mb-1">{children}</h4>,
                h3: ({ children }) => <h5 className="font-semibold text-sm mt-2 mb-1">{children}</h5>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="text-xs border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="border border-border px-2 py-1 bg-muted font-medium">{children}</th>,
                td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Actions/Metadata Summary */}
        {message.metadata && !isUser && (
          <MetadataSummary metadata={message.metadata} />
        )}

        {/* Timestamp */}
        <p className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

function MetadataSummary({ metadata }: { metadata: any }) {
  const hasData =
    metadata.accounts_found !== undefined ||
    (metadata.issues_found && metadata.issues_found.length > 0) ||
    metadata.comparison_result ||
    metadata.guidance_provided;

  if (!hasData) return null;

  return (
    <div className="mt-2 space-y-1">
      {/* Accounts Found */}
      {metadata.accounts_found !== undefined && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <Info className="h-3 w-3" />
          <span>{metadata.accounts_found} account{metadata.accounts_found !== 1 ? 's' : ''} found</span>
        </div>
      )}

      {/* Issues Found */}
      {metadata.issues_found && metadata.issues_found.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          {metadata.issues_found.some((i: InfraIssue) => i.type === 'critical') ? (
            <>
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-red-600 dark:text-red-400">
                {metadata.issues_found.filter((i: InfraIssue) => i.type === 'critical').length} critical issue(s)
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">
                {metadata.issues_found.length} warning(s)
              </span>
            </>
          )}
        </div>
      )}

      {/* Comparison Made */}
      {metadata.comparison_result && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <TrendingUp className="h-3 w-3" />
          <span>Compared: {metadata.comparison_result.subject}</span>
        </div>
      )}

      {/* Guidance Provided */}
      {metadata.guidance_provided && (
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
          <CheckCircle className="h-3 w-3" />
          <span>Guidance provided</span>
        </div>
      )}
    </div>
  );
}
