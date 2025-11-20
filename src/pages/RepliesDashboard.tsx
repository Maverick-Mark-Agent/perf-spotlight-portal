/**
 * Live Replies Dashboard
 *
 * Real-time dashboard showing ALL replies (positive and negative)
 * from Email Bison workspaces with filtering and search capabilities
 */

import { useState, useMemo } from 'react';
import { useRealtimeReplies, useReplyWorkspaces, type LeadReply } from '@/hooks/useRealtimeReplies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, Search, Filter, Sparkles, Send, X } from 'lucide-react';
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

export default function RepliesDashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReplyForAI, setSelectedReplyForAI] = useState<LeadReply | null>(null);
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);

  const { workspaces, loading: workspacesLoading } = useReplyWorkspaces();
  const {
    data: replies,
    loading,
    error,
    newReplyCount,
    clearNewReplyCount,
    refreshData,
  } = useRealtimeReplies({
    workspaceName: selectedWorkspace,
    sentiment: selectedSentiment,
    limit: 200,
  });

  // Filter replies by search query
  const filteredReplies = useMemo(() => {
    if (!searchQuery.trim()) return replies;

    const query = searchQuery.toLowerCase();
    return replies.filter((reply) => {
      const leadName = [reply.first_name, reply.last_name].filter(Boolean).join(' ').toLowerCase();
      const email = reply.lead_email?.toLowerCase() || '';
      const company = reply.company?.toLowerCase() || '';
      const replyText = reply.reply_text?.toLowerCase() || '';

      return (
        leadName.includes(query) ||
        email.includes(query) ||
        company.includes(query) ||
        replyText.includes(query)
      );
    });
  }, [replies, searchQuery]);

  // Count by sentiment
  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    replies.forEach((reply) => {
      counts[reply.sentiment]++;
    });
    return counts;
  }, [replies]);

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-green-500 hover:bg-green-600">Positive</Badge>;
      case 'negative':
        return <Badge className="bg-red-500 hover:bg-red-600">Negative</Badge>;
      case 'neutral':
        return <Badge className="bg-gray-500 hover:bg-gray-600">Neutral</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Live Replies Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Real-time feed of all replies from Email Bison workspaces
            </p>
          </div>
          <Button onClick={refreshData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Replies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{replies.length}</div>
              {newReplyCount > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  +{newReplyCount} new
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Positive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{sentimentCounts.positive}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.positive / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Negative</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{sentimentCounts.negative}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.negative / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Neutral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{sentimentCounts.neutral}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.neutral / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, company, or reply text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Workspace Filter */}
              <div className="w-full md:w-64">
                <Select
                  value={selectedWorkspace || 'all'}
                  onValueChange={(value) => setSelectedWorkspace(value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws} value={ws}>
                        {ws}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sentiment Filter */}
              <div className="w-full md:w-48">
                <Select
                  value={selectedSentiment}
                  onValueChange={(value: any) => setSelectedSentiment(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replies List */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">Error loading replies: {error}</p>
            </CardContent>
          </Card>
        )}

        {loading && replies.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredReplies.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No replies found
                </h3>
                <p className="text-gray-500">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Replies will appear here as they come in from Email Bison'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredReplies.map((reply) => {
              const leadName = [reply.first_name, reply.last_name].filter(Boolean).join(' ') || 'Unknown Lead';
              const isExpanded = expandedReplyId === reply.id;
              const replyPreview = reply.reply_text
                ? reply.reply_text.slice(0, 100) + (reply.reply_text.length > 100 ? '...' : '')
                : 'No reply text available';

              return (
                <Card
                  key={reply.id}
                  className={`overflow-hidden transition-all cursor-pointer ${
                    isExpanded ? 'shadow-lg ring-2 ring-blue-500/50' : 'hover:shadow-md hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => setExpandedReplyId(isExpanded ? null : reply.id)}
                >
                  <CardHeader className={`${isExpanded ? 'pb-3' : 'py-3'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base font-semibold truncate">{leadName}</CardTitle>
                          {getSentimentBadge(reply.sentiment)}
                        </div>

                        {!isExpanded && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                            {replyPreview}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{reply.workspace_name}</span>
                          <span>•</span>
                          <span>{formatDate(reply.reply_date)}</span>
                          {reply.company && (
                            <>
                              <span>•</span>
                              <span className="truncate">{reply.company}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReplyForAI(reply);
                            }}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            AI Reply
                          </Button>
                          {reply.bison_conversation_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(reply.bison_conversation_url!, '_blank');
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {reply.reply_text || 'No reply text available'}
                        </p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Show "new replies" notification */}
        {newReplyCount > 0 && (
          <div className="fixed bottom-6 right-6">
            <Button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                clearNewReplyCount();
              }}
              className="shadow-lg"
            >
              {newReplyCount} new {newReplyCount === 1 ? 'reply' : 'replies'}
            </Button>
          </div>
        )}

        {/* AI Reply Composer Modal */}
        {selectedReplyForAI && (
          <AIReplyComposer
            reply={selectedReplyForAI}
            onClose={() => setSelectedReplyForAI(null)}
          />
        )}
      </div>
    </div>
  );
}

// AI Reply Composer Component
interface AIReplyComposerProps {
  reply: LeadReply;
  onClose: () => void;
}

function AIReplyComposer({ reply, onClose }: AIReplyComposerProps) {
  const [generatedReply, setGeneratedReply] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const leadName = [reply.first_name, reply.last_name].filter(Boolean).join(' ') || 'Unknown Lead';

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-reply`,
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
            preview_mode: true,
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

  // Auto-generate when component mounts
  if (!generatedReply && !isGenerating) {
    generateReply();
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reply-via-bison`,
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
        const errorData = await response.json();
        console.error('Send reply error response:', errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
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
    <Dialog open={true} onOpenChange={onClose}>
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
