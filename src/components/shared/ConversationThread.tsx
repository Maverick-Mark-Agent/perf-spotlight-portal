/**
 * Conversation Thread Component
 *
 * Displays a chronological thread of messages between a lead and the team.
 * Shows incoming messages (from lead) on the left, outgoing (from team) on the right.
 */

import { useConversationThread } from '@/hooks/useConversationThread';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Users, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ConversationThreadProps {
  leadEmail: string;
  workspaceName: string;
  leadName: string;
}

export function ConversationThread({ leadEmail, workspaceName, leadName }: ConversationThreadProps) {
  const { messages, loading, error } = useConversationThread({
    leadEmail,
    workspaceName,
    enabled: true,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading conversation...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-red-600">Failed to load conversation</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">No messages in this conversation</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Thread Header */}
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Conversation Thread</span>
          <Badge variant="outline" className="text-xs">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {messages.map((message, index) => {
          const isIncoming = message.type === 'incoming';
          const showDateSeparator = index === 0 ||
            new Date(message.timestamp).toDateString() !==
            new Date(messages[index - 1].timestamp).toDateString();

          return (
            <div key={message.id}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 border-t border-dashed" />
                  <span className="text-xs text-muted-foreground px-2">
                    {format(new Date(message.timestamp), 'MMM d, yyyy')}
                  </span>
                  <div className="flex-1 border-t border-dashed" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    isIncoming
                      ? 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {/* Message Header */}
                  <div className={`flex items-center gap-2 mb-1.5 ${isIncoming ? '' : 'justify-end'}`}>
                    {isIncoming ? (
                      <>
                        <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <User className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {message.sender.name}
                        </span>
                        <ArrowDownLeft className="h-3 w-3 text-gray-400" />
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-3 w-3 text-blue-400" />
                        <span className="text-xs font-medium text-foreground">
                          Your Team
                        </span>
                        <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                          <Users className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Message Text */}
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {message.text}
                  </p>

                  {/* Message Footer */}
                  <div className={`flex items-center gap-2 mt-2 ${isIncoming ? '' : 'justify-end'}`}>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.timestamp), 'h:mm a')}
                    </span>
                    {isIncoming && message.sentiment && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          message.sentiment === 'positive' ? 'bg-green-50 text-green-700 border-green-200' :
                          message.sentiment === 'negative' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {message.sentiment}
                      </Badge>
                    )}
                    {!isIncoming && message.status && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {message.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
