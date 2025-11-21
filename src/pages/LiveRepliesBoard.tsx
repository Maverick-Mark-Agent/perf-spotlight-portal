/**
 * Live Replies Message Board
 *
 * Gmail-style message board showing ALL replies in real-time
 */

import { useLiveReplies, type LiveReply } from '@/hooks/useLiveReplies';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Mail, Building2, User, Sparkles, Send, RefreshCw, X, Check, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
    <Card className={`hover:shadow-md transition-shadow duration-200 border-l-4 relative ${
      weHaveReplied
        ? 'border-l-green-500 opacity-70'
        : 'border-l-blue-500'
    }`}>
      {/* Replied Indicator Box - Top Right Corner */}
      {weHaveReplied && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className="bg-green-600 text-white border-green-700 shadow-md px-3 py-1.5 text-xs font-semibold">
            <Check className="h-3.5 w-3.5 mr-1.5" />
            REPLIED
          </Badge>
        </div>
      )}
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              weHaveReplied ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              {weHaveReplied ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <User className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{leadName}</h3>
                {getSentimentBadge()}
                {weHaveReplied && replyStatus && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Replied {formatDistanceToNow(new Date(replyStatus.sent_at), { addSuffix: true })}
                  </Badge>
                )}
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
                  onClick={() => setShowComposer(true)}
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
                >
                  View in Bison
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
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

interface AIReplyComposerProps {
  open: boolean;
  onClose: () => void;
  reply: LiveReply;
  leadName: string;
}

function AIReplyComposer({ open, onClose, reply, leadName }: AIReplyComposerProps) {
  const [generatedReply, setGeneratedReply] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Generate reply when dialog opens
  const generateReply = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to generate replies',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/generate-ai-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reply_uuid: reply.id,
            workspace_name: reply.workspace_name,
            lead_name: leadName,
            lead_email: reply.lead_email,
            lead_phone: reply.phone || undefined,
            original_message: reply.reply_text || '',
            preview_mode: true, // Don't save to DB yet
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate reply');
      }

      const data = await response.json();
      setGeneratedReply(data.generated_reply);
      setCcEmails(data.cc_emails || []);

      toast({
        title: 'Reply Generated',
        description: 'AI has generated a personalized reply based on the template',
      });
    } catch (error: any) {
      console.error('Error generating reply:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate reply',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate when dialog opens
  if (open && !generatedReply && !isGenerating) {
    generateReply();
  }

  // Reset state when dialog closes
  if (!open && generatedReply) {
    setGeneratedReply('');
    setCcEmails([]);
  }

  const handleSend = async () => {
    if (!generatedReply.trim()) {
      toast({
        title: 'Empty Reply',
        description: 'Please generate a reply first',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to send replies',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/send-reply-via-bison`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reply_uuid: reply.id,
            workspace_name: reply.workspace_name,
            generated_reply_text: generatedReply,
            cc_emails: ccEmails,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      toast({
        title: 'Reply Sent!',
        description: `Reply sent to ${leadName} with ${ccEmails.length} CC(s)`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Send Failed',
        description: error.message || 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Reply to {leadName}
          </DialogTitle>
          <DialogDescription>
            Review and edit the AI-generated reply before sending. CC emails are automatically included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Original Message */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Original Message from {leadName}
            </label>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {reply.reply_text || '(No message text)'}
              </p>
            </div>
          </div>

          {/* Generated Reply */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              AI-Generated Reply
            </label>
            {isGenerating ? (
              <div className="bg-gray-50 rounded-lg p-8 border border-gray-200 flex flex-col items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600 mb-2" />
                <p className="text-sm text-gray-600">Generating personalized reply...</p>
              </div>
            ) : (
              <Textarea
                value={generatedReply}
                onChange={(e) => setGeneratedReply(e.target.value)}
                className="min-h-[200px] font-sans text-sm"
                placeholder="AI-generated reply will appear here..."
              />
            )}
          </div>

          {/* CC Emails */}
          {ccEmails.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                CC Recipients ({ccEmails.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {ccEmails.map((email, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 text-xs"
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={generateReply}
              disabled={isGenerating || isSending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isSending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isGenerating || isSending || !generatedReply}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
