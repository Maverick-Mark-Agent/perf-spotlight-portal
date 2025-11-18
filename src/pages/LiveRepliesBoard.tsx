/**
 * Live Replies Message Board
 *
 * Gmail-style message board showing ALL replies in real-time
 */

import { useLiveReplies, type LiveReply } from '@/hooks/useLiveReplies';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Mail, Building2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function LiveRepliesBoard() {
  const { replies, loading, error, newReplyCount, clearNewReplyCount } = useLiveReplies();

  // Clear new reply count when user focuses window
  if (newReplyCount > 0 && document.hasFocus()) {
    clearNewReplyCount();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading replies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading replies</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-semibold text-gray-900">Live Replies</h1>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-gray-600 font-medium">LIVE</span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </div>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {replies.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No replies yet</h3>
            <p className="text-gray-600">New replies will appear here automatically</p>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <ReplyCard key={reply.id} reply={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReplyCardProps {
  reply: LiveReply;
}

function ReplyCard({ reply }: ReplyCardProps) {
  const leadName = reply.first_name && reply.last_name
    ? `${reply.first_name} ${reply.last_name}`
    : reply.first_name || reply.last_name || 'Unknown';

  const timeAgo = formatDistanceToNow(new Date(reply.reply_date), { addSuffix: true });

  const getSentimentBadge = () => {
    if (!reply.sentiment) return null;

    const variants = {
      positive: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Interested' },
      negative: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Not Interested' },
      neutral: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Neutral' },
    };

    const variant = variants[reply.sentiment];
    return (
      <Badge variant="outline" className={variant.color}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500">
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{leadName}</h3>
                {getSentimentBadge()}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {reply.lead_email}
                </span>
                {reply.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {reply.company}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reply Text */}
        {reply.reply_text && (
          <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
            <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
              {reply.reply_text}
            </p>
          </div>
        )}

        {/* Footer Row */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="font-medium text-blue-600">{reply.workspace_name}</span>
            <span>{timeAgo}</span>
          </div>
          {reply.bison_conversation_url && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 text-xs"
            >
              <a
                href={reply.bison_conversation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                View in Bison
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
