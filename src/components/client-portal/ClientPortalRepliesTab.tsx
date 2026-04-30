/**
 * Client Portal Replies Tab
 *
 * Displays real-time replies for the client's workspace with AI reply functionality.
 * Strictly filtered by workspace to ensure clients only see their own data.
 */

import { useMemo, useState } from 'react';
import { useRealtimeReplies, LeadReply } from '@/hooks/useRealtimeReplies';
import { AIReplyComposer } from '@/components/shared/AIReplyComposer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  ExternalLink,
  Mail,
  Building2,
  User,
  Sparkles,
  RefreshCw,
  Check,
  CheckCircle,
  MessageSquare,
  Settings2,
  ChevronDown,
  ChevronRight,
  Flame,
  AlertCircle,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { LiveReply } from '@/hooks/useLiveReplies';
import { getReplyState, getSentReply } from '@/hooks/useLiveReplies';

interface ClientPortalRepliesTabProps {
  workspaceName: string;
  onSwitchToTemplates?: () => void;
}

export function ClientPortalRepliesTab({ workspaceName, onSwitchToTemplates }: ClientPortalRepliesTabProps) {
  const {
    data: replies,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    newReplyCount,
    clearNewReplyCount,
    refreshData,
    patchReplyAfterSend,
  } = useRealtimeReplies({ workspaceName });

  const [searchQuery, setSearchQuery] = useState('');

  // Clear new reply count when user focuses window
  if (newReplyCount > 0 && document.hasFocus()) {
    clearNewReplyCount();
  }

  // Client-side search across name / email / company. Runs over whatever's
  // currently loaded — instant, no DB hit. Users can click "Load older
  // replies" to expand the search pool.
  const filteredReplies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return replies;
    return replies.filter((r) => {
      const fullName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (r.lead_email || '').toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q)
      );
    });
  }, [replies, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading replies...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading replies</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Live Replies</h2>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? `${filteredReplies.length} of ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'} match "${searchQuery}"`
                : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'} for ${workspaceName}`}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium">LIVE</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search bar — filters loaded replies by name / email / company */}
      {replies.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Replies List */}
      {replies.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No replies yet</h3>
            <p className="text-muted-foreground mb-4">
              New replies from your leads will appear here automatically
            </p>
            {onSwitchToTemplates && (
              <Button variant="outline" onClick={onSwitchToTemplates}>
                <Settings2 className="h-4 w-4 mr-2" />
                Configure Reply Templates
              </Button>
            )}
          </div>
        </Card>
      ) : filteredReplies.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-medium mb-1">No matches</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No replies match "{searchQuery}" in the loaded results.
              {hasMore && ' Try loading older replies.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
              {hasMore && (
                <Button variant="default" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
                  Load older replies
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filteredReplies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply as unknown as LiveReply}
                onSwitchToTemplates={onSwitchToTemplates}
                onReplySent={refreshData}
                patchReplyAfterSend={patchReplyAfterSend}
              />
            ))}
          </div>
          {/* Load older — paginates back through history without slowing first paint */}
          {hasMore && !searchQuery && (
            <div className="flex justify-center pt-2 pb-4">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load older replies'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ReplyCardProps {
  reply: LiveReply;
  onSwitchToTemplates?: () => void;
  onReplySent: () => void;
  patchReplyAfterSend: (replyUuid: string, sentReply: any) => void;
}

function ReplyCard({ reply, onSwitchToTemplates, onReplySent, patchReplyAfterSend }: ReplyCardProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const leadName = reply.first_name && reply.last_name
    ? `${reply.first_name} ${reply.last_name}`
    : reply.first_name || reply.last_name || 'Unknown';

  const timeAgo = formatDistanceToNow(new Date(reply.reply_date), { addSuffix: true });

  // Reply state — see useLiveReplies.ts for state machine
  const replyState = getReplyState(reply);
  const replyStatus = getSentReply(reply);

  // Conversation tracking (from view, optional for backward compatibility)
  const replyCount = (reply as any).conversation_reply_count;
  const conversationStatus = (reply as any).conversation_status;

  // Truncate reply text for preview
  const previewText = reply.reply_text && reply.reply_text.length > 100
    ? reply.reply_text.substring(0, 100) + '...'
    : reply.reply_text;

  const getConversationBadge = () => {
    // Don't show badge for single replies or if data is not available
    if (!replyCount || replyCount <= 1 || conversationStatus === 'single_reply') {
      return null;
    }

    if (conversationStatus === 'hot') {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
          <Flame className="h-3 w-3 mr-1" />
          Hot ({replyCount})
        </Badge>
      );
    }

    if (conversationStatus === 'in_conversation' || replyCount > 1) {
      return (
        <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          {replyCount} replies
        </Badge>
      );
    }

    return null;
  };

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

  const cardBorderClass = {
    none: 'border-l-blue-500',
    pending: 'border-l-yellow-500',
    replied: 'border-l-green-500 opacity-70',
    failed: 'border-l-red-500',
  }[replyState];

  return (
    <Card
      className={`hover:shadow-md transition-all duration-200 border-l-4 relative cursor-pointer ${cardBorderClass}`}
      onClick={handleCardClick}
    >
      {/* State Indicator Badge - Top Right Corner */}
      {replyState === 'replied' && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-green-600 text-white border-green-700 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Check className="h-3.5 w-3.5 mr-1.5" />
            REPLIED
          </Badge>
        </div>
      )}
      {replyState === 'pending' && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-yellow-500 text-white border-yellow-600 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
            PENDING
          </Badge>
        </div>
      )}
      {replyState === 'failed' && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-red-600 text-white border-red-700 shadow-md px-3 py-1.5 text-xs font-semibold">
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            FAILED
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
            replyState === 'replied' ? 'bg-green-100' :
            replyState === 'pending' ? 'bg-yellow-100' :
            replyState === 'failed' ? 'bg-red-100' :
            'bg-blue-100'
          }`}>
            {replyState === 'replied' ? <Check className="h-4 w-4 text-green-600" /> :
             replyState === 'pending' ? <Clock className="h-4 w-4 text-yellow-600 animate-pulse" /> :
             replyState === 'failed' ? <AlertCircle className="h-4 w-4 text-red-600" /> :
             <User className="h-4 w-4 text-blue-600" />}
          </div>

          {/* Name, Sentiment, Conversation Status, Preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{leadName}</h3>
              {getSentimentBadge()}
              {getConversationBadge()}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
            {/* Preview text when collapsed */}
            {!isExpanded && previewText && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {previewText}
              </p>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 ml-11">
            {/* Contact Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
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
              {replyState === 'replied' && replyStatus?.verified_at && (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  Delivered {formatDistanceToNow(new Date(replyStatus.verified_at), { addSuffix: true })}
                </Badge>
              )}
              {replyState === 'pending' && replyStatus && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                  <Clock className="h-3 w-3 mr-1 animate-pulse" />
                  Sent {formatDistanceToNow(new Date(replyStatus.sent_at), { addSuffix: true })} — awaiting delivery confirmation
                </Badge>
              )}
              {replyState === 'failed' && replyStatus && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed{replyStatus.retry_count > 0 ? ` (after ${replyStatus.retry_count} retry)` : ''}
                </Badge>
              )}
            </div>

            {/* Full Reply Text */}
            {reply.reply_text && (
              <div className="bg-muted rounded-lg p-4 mb-3 border">
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {reply.reply_text}
                </p>
              </div>
            )}

            {/* Show error message expanded for failed sends */}
            {replyState === 'failed' && replyStatus?.error_message && (
              <div className="bg-red-50 rounded-lg p-3 mb-3 border border-red-200">
                <p className="text-xs font-semibold text-red-800 mb-1">Send failed:</p>
                <p className="text-xs text-red-700 font-mono break-words">{replyStatus.error_message}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {replyState === 'none' ? (
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
              ) : replyState === 'replied' ? (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Replied & Delivered
                </Badge>
              ) : replyState === 'pending' ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                  <Clock className="h-3 w-3 mr-1 animate-pulse" />
                  Sent — awaiting delivery confirmation
                </Badge>
              ) : (
                /* failed */
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Send failed — team has been alerted
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
        onReplySent={onReplySent}
        patchReplyAfterSend={patchReplyAfterSend}
      />
    </Card>
  );
}
