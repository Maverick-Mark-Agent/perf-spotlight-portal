/**
 * Live Replies Message Board
 *
 * Gmail-style message board showing the most recent 300 replies in real-time,
 * with workspace filtering and triage-state stats.
 */

import { useLiveReplies, type LiveReply, getReplyState, getSentReply } from '@/hooks/useLiveReplies';
import { useReplyWorkspaces } from '@/hooks/useRealtimeReplies';
import { useAutoReplyQueue } from '@/hooks/useAutoReplyQueue';
import { AIReplyComposer } from '@/components/shared/AIReplyComposer';
import { AutoReplyReviewCard } from '@/components/shared/AutoReplyReviewCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Mail, Building2, User, Sparkles, Check, CheckCircle, ChevronDown, ChevronRight, MessageSquare, Flame, RefreshCw, AlertCircle, Clock, Inbox, Bot, Eye, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function LiveRepliesBoard() {
  const { workspaces } = useReplyWorkspaces();
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pass selectedWorkspace so the hook loads all-time leads when a workspace
  // is selected, instead of the default 7-day window.
  const { replies, loading, error, newReplyCount, clearNewReplyCount, refreshReplies, patchReplyAfterSend } = useLiveReplies(selectedWorkspace);

  // Auto-reply queue: shows items the audit gate flagged for human review,
  // plus today's auto-sent items (for visibility into what fired automatically).
  const {
    rows: autoReplyRows,
    patchRow: patchAutoReplyRow,
    removeRow: removeAutoReplyRow,
    autoSentTodayCount,
  } = useAutoReplyQueue({
    statuses: ['review_required', 'auto_sent'],
    workspaceName: selectedWorkspace,
  });

  const reviewRows = useMemo(
    () => autoReplyRows.filter((r) => r.status === 'review_required'),
    [autoReplyRows]
  );

  // Clear new reply count when user focuses the window
  useEffect(() => {
    if (newReplyCount === 0) return;
    const handleFocus = () => clearNewReplyCount();
    if (document.hasFocus()) clearNewReplyCount();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [newReplyCount, clearNewReplyCount]);

  // Filter by search query only — workspace filtering is done in the hook
  // (when a workspace is selected, the hook fetches all-time leads for it).
  const filteredReplies = useMemo(() => {
    if (!searchQuery.trim()) return replies;
    const q = searchQuery.trim().toLowerCase();
    return replies.filter((r) =>
      r.lead_email.toLowerCase().includes(q) ||
      (r.first_name || '').toLowerCase().includes(q) ||
      (r.last_name || '').toLowerCase().includes(q) ||
      (r.company || '').toLowerCase().includes(q)
    );
  }, [replies, searchQuery]);

  // Triage-state counts driven off the same state machine as the cards.
  // - "needResponse": positive-sentiment replies with no send attempted yet,
  //   plus leads with a queued auto-reply (still actionable — can override).
  //   Negatives ("not interested"), neutrals (OOO/auto-replies), and bounces
  //   are excluded — they don't need a reply.
  // - "pending": actual sent_replies row exists, awaiting Bison delivery confirmation.
  // - "replied": delivery verified.
  // - "failed": both send attempts errored — needs human intervention.
  const stateCounts = useMemo(() => {
    const counts = { needResponse: 0, pending: 0, replied: 0, failed: 0 };
    for (const r of filteredReplies) {
      const state = getReplyState(r);
      if (state === 'pending') counts.pending++;
      else if (state === 'replied') counts.replied++;
      else if (state === 'failed') counts.failed++;
      else if ((state === 'none' || state === 'queued') && r.sentiment === 'positive') counts.needResponse++;
    }
    return counts;
  }, [filteredReplies]);

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
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-semibold text-foreground">Live Replies</h1>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-muted-foreground font-medium">LIVE</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredReplies.length} of {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              {selectedWorkspace ? ` — ${selectedWorkspace}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Stats + Filter */}
      <div className="max-w-6xl mx-auto px-6 py-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<Inbox className="h-4 w-4" />}
            label="Need Response"
            value={stateCounts.needResponse}
            tone="blue"
          />
          <StatCard
            icon={<Eye className="h-4 w-4" />}
            label="Awaiting Review"
            value={reviewRows.length}
            tone="orange"
          />
          <StatCard
            icon={<Bot className="h-4 w-4" />}
            label="Auto-Sent Today"
            value={autoSentTodayCount}
            tone="purple"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Pending"
            value={stateCounts.pending}
            tone="yellow"
          />
          <StatCard
            icon={<CheckCircle className="h-4 w-4" />}
            label="Replied"
            value={stateCounts.replied}
            tone="green"
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Failed"
            value={stateCounts.failed}
            tone="red"
          />
        </div>

        {/* Search + Workspace filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search by email / name / company */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, name, or company…"
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <span className="text-sm text-muted-foreground hidden sm:block">Workspace:</span>
          <Select
            value={selectedWorkspace || 'all'}
            onValueChange={(value) => setSelectedWorkspace(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="All workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {workspaces.map((ws) => (
                <SelectItem key={ws} value={ws}>
                  {ws}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedWorkspace && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedWorkspace(null)}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Awaiting Review section — auto-reply drafts the audit gate flagged
          for human approval. Sits above the main replies list because each
          one is actively blocking an outbound send and deserves attention. */}
      {reviewRows.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-2">
          <div className="flex items-center gap-2 mb-3 mt-2">
            <Eye className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Awaiting Review
            </h2>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
              {reviewRows.length} draft{reviewRows.length === 1 ? '' : 's'}
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              Auto-reply drafts that need a human eye before sending
            </span>
          </div>
          <div className="space-y-3">
            {reviewRows.map((row) => (
              <AutoReplyReviewCard
                key={row.id}
                row={row}
                patchRow={patchAutoReplyRow}
                removeRow={removeAutoReplyRow}
              />
            ))}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="max-w-6xl mx-auto px-6 pb-6">
        {filteredReplies.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {selectedWorkspace ? `No replies for ${selectedWorkspace}` : 'No replies yet'}
            </h3>
            <p className="text-muted-foreground">
              {selectedWorkspace
                ? 'Try clearing the workspace filter or wait for new replies'
                : 'New replies will appear here automatically'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReplies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onReplySent={refreshReplies}
                patchReplyAfterSend={patchReplyAfterSend}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tone colors map to the same scheme as the card border-l states so the dashboard
// reads as a single visual language: blue=needs-action, yellow=pending,
// green=verified, red=failed, orange=awaiting human review, purple=AI auto-sent.
const STAT_TONES = {
  blue: { ring: 'border-l-blue-500', text: 'text-blue-500' },
  yellow: { ring: 'border-l-yellow-500', text: 'text-yellow-500' },
  green: { ring: 'border-l-green-500', text: 'text-green-500' },
  red: { ring: 'border-l-red-500', text: 'text-red-500' },
  orange: { ring: 'border-l-orange-500', text: 'text-orange-500' },
  purple: { ring: 'border-l-purple-500', text: 'text-purple-500' },
} as const;

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  const t = STAT_TONES[tone];
  return (
    <Card className={`border-l-4 ${t.ring}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </span>
          <span className={t.text}>{icon}</span>
        </div>
        <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

interface ReplyCardProps {
  reply: LiveReply;
  onReplySent: () => void;
  patchReplyAfterSend: (replyUuid: string, sentReply: any) => void;
}

function ReplyCard({ reply, onReplySent, patchReplyAfterSend }: ReplyCardProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const leadName = reply.first_name && reply.last_name
    ? `${reply.first_name} ${reply.last_name}`
    : reply.first_name || reply.last_name || 'Unknown';

  const timeAgo = formatDistanceToNow(new Date(reply.reply_date), { addSuffix: true });

  // Reply state: 'none' | 'queued' | 'pending' | 'replied' | 'failed'
  // - none    = no send attempted → show AI Reply button
  // - queued  = auto_reply_queue row in-flight but NO sent_replies yet → still actionable
  // - pending = sent_replies row exists, verified_at NULL (awaiting Bison confirmation)
  // - replied = verified_at IS NOT NULL (Bison confirmed delivery)
  // - failed  = status='failed'
  const replyState = getReplyState(reply);
  const replyStatus = getSentReply(reply);

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

  const getConversationBadge = () => {
    const replyCount = reply.conversation_reply_count;
    const status = reply.conversation_status;

    // Don't show badge for single replies or if data is not available
    if (!replyCount || replyCount <= 1 || status === 'single_reply') {
      return null;
    }

    if (status === 'hot') {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
          <Flame className="h-3 w-3 mr-1" />
          Hot ({replyCount})
        </Badge>
      );
    }

    if (status === 'in_conversation' || replyCount > 1) {
      return (
        <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-xs">
          <MessageSquare className="h-3 w-3 mr-1" />
          {replyCount} replies
        </Badge>
      );
    }

    return null;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on a button or link
    if ((e.target as HTMLElement).closest('button, a')) return;
    setIsExpanded(!isExpanded);
  };

  const cardBorderClass = {
    none: 'border-l-blue-500',
    queued: 'border-l-orange-400',
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
      {replyState === 'none' && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-blue-600 text-white border-blue-700 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Inbox className="h-3.5 w-3.5 mr-1.5" />
            NEW
          </Badge>
        </div>
      )}
      {replyState === 'queued' && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-orange-400 text-white border-orange-500 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            SCHEDULED
          </Badge>
        </div>
      )}
      <div className="p-4">
        {/* Compact Header Row */}
        <div className="flex items-center gap-3">
          {/* Expand/Collapse Icon */}
          <div className="text-muted-foreground">
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
            replyState === 'queued' ? 'bg-orange-100' :
            'bg-blue-100'
          }`}>
            {replyState === 'replied' ? <Check className="h-4 w-4 text-green-600" /> :
             replyState === 'pending' ? <Clock className="h-4 w-4 text-yellow-600 animate-pulse" /> :
             replyState === 'failed' ? <AlertCircle className="h-4 w-4 text-red-600" /> :
             replyState === 'queued' ? <Bot className="h-4 w-4 text-orange-500" /> :
             <User className="h-4 w-4 text-blue-600" />}
          </div>

          {/* Name, Sentiment, Conversation Status, Preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{leadName}</h3>
              {getSentimentBadge()}
              {getConversationBadge()}
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              <span className="text-xs text-blue-500 font-medium">{reply.workspace_name}</span>
            </div>
            {/* Preview text when collapsed */}
            {!isExpanded && replyState === 'failed' && replyStatus?.error_message ? (
              <p className="text-xs text-red-500 truncate mt-0.5 font-medium">
                Send failed: {replyStatus.error_message.replace(/Email Bison API error.*?body=/, '').replace(/attempt \d+: status=\d+ body=/g, '').slice(0, 120)}
              </p>
            ) : !isExpanded && previewText ? (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {previewText}
              </p>
            ) : null}
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
              {replyState === 'queued' && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  <Bot className="h-3 w-3 mr-1" />
                  Auto-reply scheduled — not sent yet
                </Badge>
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
                  Sent {formatDistanceToNow(new Date(replyStatus.sent_at), { addSuffix: true })} — awaiting Bison delivery confirmation
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
            <div className="flex items-center gap-2 flex-wrap">
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
              ) : replyState === 'queued' ? (
                <>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    <Bot className="h-3 w-3 mr-1" />
                    Auto-reply scheduled
                  </Badge>
                  {reply.bison_reply_numeric_id && (
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
                      Override & Reply Now
                    </Button>
                  )}
                </>
              ) : replyState === 'replied' ? (
                <>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Replied & Delivered
                  </Badge>
                  {reply.bison_reply_numeric_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowComposer(true);
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reply Again
                    </Button>
                  )}
                </>
              ) : replyState === 'pending' ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                  <Clock className="h-3 w-3 mr-1 animate-pulse" />
                  Sent — awaiting delivery confirmation
                </Badge>
              ) : (
                /* failed — show error + retry button */
                <>
                  <Badge variant="secondary" className="bg-red-100 text-red-700 max-w-xs truncate">
                    <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {replyStatus?.error_message
                        ? replyStatus.error_message.replace(/Email Bison API error.*?body=/, '').replace(/attempt \d+: status=\d+ body=/g, '').slice(0, 80)
                        : 'Send failed'}
                    </span>
                  </Badge>
                  {reply.bison_reply_numeric_id && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowComposer(true);
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Send
                    </Button>
                  )}
                </>
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

