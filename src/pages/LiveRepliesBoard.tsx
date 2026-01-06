/**
 * Live Replies Message Board
 *
 * Gmail-style message board showing ALL replies in real-time
 */

import { useLiveReplies, type LiveReply } from '@/hooks/useLiveReplies';
import { AIReplyComposer } from '@/components/shared/AIReplyComposer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Mail, Building2, User, Sparkles, Check, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
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
  const [showComposer, setShowComposer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const leadName = reply.first_name && reply.last_name
    ? `${reply.first_name} ${reply.last_name}`
    : reply.first_name || reply.last_name || 'Unknown';

  const timeAgo = formatDistanceToNow(new Date(reply.reply_date), { addSuffix: true });

  // Check if we've replied to this conversation
  // PostgREST returns object for one-to-one, array for one-to-many
  const weHaveReplied = reply.sent_replies && (
    Array.isArray(reply.sent_replies) ? reply.sent_replies.length > 0 : !!reply.sent_replies
  );
  const replyStatus = Array.isArray(reply.sent_replies) ? reply.sent_replies[0] : reply.sent_replies;

  // Truncate reply text for preview
  const previewText = reply.reply_text && reply.reply_text.length > 100
    ? reply.reply_text.substring(0, 100) + '...'
    : reply.reply_text;

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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on a button or link
    if ((e.target as HTMLElement).closest('button, a')) return;
    setIsExpanded(!isExpanded);
  };

  return (
    <Card
      className={`hover:shadow-md transition-all duration-200 border-l-4 relative cursor-pointer ${
        weHaveReplied
          ? 'border-l-green-500 opacity-70'
          : 'border-l-blue-500'
      }`}
      onClick={handleCardClick}
    >
      {/* Replied Indicator Box - Top Right Corner */}
      {weHaveReplied && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-green-600 text-white border-green-700 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Check className="h-3.5 w-3.5 mr-1.5" />
            REPLIED
          </Badge>
        </div>
      )}
      <div className="p-4">
        {/* Compact Header Row */}
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          <div className="text-gray-400">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>

          {/* Avatar */}
          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            weHaveReplied ? 'bg-green-100' : 'bg-blue-100'
          }`}>
            {weHaveReplied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <User className="h-4 w-4 text-blue-600" />
            )}
          </div>

          {/* Name, Sentiment, Preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{leadName}</h3>
              {getSentimentBadge()}
              <span className="text-xs text-gray-500">{timeAgo}</span>
              <span className="text-xs text-blue-600 font-medium">{reply.workspace_name}</span>
            </div>
            {/* Preview text when collapsed */}
            {!isExpanded && previewText && (
              <p className="text-sm text-gray-600 truncate mt-0.5">
                {previewText}
              </p>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 ml-11">
            {/* Contact Info */}
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
              {weHaveReplied && replyStatus && (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  Replied {formatDistanceToNow(new Date(replyStatus.sent_at), { addSuffix: true })}
                </Badge>
              )}
            </div>

            {/* Full Reply Text */}
            {reply.reply_text && (
              <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {reply.reply_text}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!weHaveReplied ? (
                !reply.bison_reply_numeric_id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled
                    title="This reply was received before November 20, 2025 and cannot be responded to via AI. Please ask the lead to reply again."
                  >
                    <Sparkles className="h-3 w-3 mr-1 opacity-50" />
                    AI Reply Unavailable
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowComposer(true);
                    }}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Reply
                  </Button>
                )
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conversation Handled
                </Badge>
              )}
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    View in Bison
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Reply Composer Dialog */}
      <AIReplyComposer
        open={showComposer}
        onClose={() => setShowComposer(false)}
        reply={reply}
        leadName={leadName}
      />
    </Card>
  );
}

// AIReplyComposer is now imported from @/components/shared/AIReplyComposer
